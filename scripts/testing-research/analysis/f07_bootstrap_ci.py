"""
ESWA-F07: bootstrap confidence intervals (default 2000 resamples) for ECE,
Brier score, error-prediction AUROC, and AURC, computed from a real
uavi_sample_level.json.

- brier_score(confidences, corrects) -> float
- auroc_error_prediction(confidences, corrects) -> float | None: AUROC of (1-confidence) as an error-score against (not correct). None if degenerate (single class).
- aurc(confidences, corrects) -> float: full-range area under the risk-coverage curve via trapezoidal integration.
- bootstrap_ci(records, n_resamples=2000, alpha=0.05) -> dict: point estimate + percentile CI for each metric.
"""

import argparse
import json
import sys
import os

import numpy as np
from sklearn.metrics import roc_auc_score

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from f12_classwise_diagnostics import expected_calibration_error  # noqa: E402


def brier_score(confidences, corrects) -> float:
    confidences = np.asarray(confidences, dtype=float)
    corrects = np.asarray(corrects, dtype=float)
    return float(np.mean((confidences - corrects) ** 2))


def auroc_error_prediction(confidences, corrects):
    confidences = np.asarray(confidences, dtype=float)
    corrects = np.asarray(corrects, dtype=float)
    error_indicator = 1.0 - corrects  # 1 = model was wrong
    error_score = 1.0 - confidences   # higher = model expects more likely to be wrong
    if len(set(error_indicator.tolist())) < 2:
        return None  # degenerate: only one class present, AUROC undefined
    return float(roc_auc_score(error_indicator, error_score))


def aurc(confidences, corrects) -> float:
    confidences = np.asarray(confidences, dtype=float)
    corrects = np.asarray(corrects, dtype=float)
    order = np.argsort(-confidences)  # most confident first
    sorted_correct = corrects[order]
    n = len(sorted_correct)

    coverages = np.arange(1, n + 1) / n
    cumulative_correct = np.cumsum(sorted_correct)
    risks = 1.0 - (cumulative_correct / np.arange(1, n + 1))

    # prepend the (0, risk[0]) point for a well-defined integral from 0 coverage
    coverages_full = np.concatenate(([0.0], coverages))
    risks_full = np.concatenate(([risks[0]], risks))

    trapz_fn = getattr(np, "trapezoid", None) or np.trapz  # numpy>=2.0 renamed trapz to trapezoid
    return float(trapz_fn(risks_full, coverages_full))


def _bootstrap_metric(fn, confidences, corrects, n_resamples, rng):
    n = len(confidences)
    estimates = []
    for _ in range(n_resamples):
        idx = rng.integers(0, n, size=n)
        c = confidences[idx]
        y = corrects[idx]
        value = fn(c, y)
        if value is not None:
            estimates.append(value)
    return np.array(estimates)


def bootstrap_ci(records, n_resamples: int = 2000, alpha: float = 0.05, n_bins: int = 10, seed: int = 42):
    valid = [r for r in records if r.get("correct") is not None and r.get("U_composite") is not None]
    confidences = np.array([1.0 - r["U_composite"] for r in valid], dtype=float)
    corrects = np.array([float(r["correct"]) for r in valid], dtype=float)

    rng = np.random.default_rng(seed)

    metrics = {
        "ece": lambda c, y: expected_calibration_error(c, y, n_bins=n_bins),
        "brier": brier_score,
        "auroc": auroc_error_prediction,
        "aurc": aurc,
    }

    results = {}
    for name, fn in metrics.items():
        point = fn(confidences, corrects)
        boot = _bootstrap_metric(fn, confidences, corrects, n_resamples, rng)
        if len(boot) == 0:
            results[name] = {"point_estimate": point, "ci_low": None, "ci_high": None, "n_valid_resamples": 0}
            continue
        lo = float(np.percentile(boot, 100 * (alpha / 2)))
        hi = float(np.percentile(boot, 100 * (1 - alpha / 2)))
        results[name] = {
            "point_estimate": point,
            "ci_low": lo,
            "ci_high": hi,
            "n_valid_resamples": len(boot),
        }
    results["_n_samples"] = len(valid)
    results["_n_resamples_requested"] = n_resamples
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--n-resamples", type=int, default=2000)
    parser.add_argument("--out-json", default="f07_bootstrap_ci.json")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    results = bootstrap_ci(records, n_resamples=args.n_resamples)

    print(f"N samples: {results['_n_samples']}  (bootstrap resamples requested: {results['_n_resamples_requested']})\n")
    for metric in ("ece", "brier", "auroc", "aurc"):
        r = results[metric]
        if r["ci_low"] is None:
            print(f"{metric.upper():6s}: point={r['point_estimate']}  (CI unavailable -- degenerate on {r['n_valid_resamples']} valid resamples)")
        else:
            print(f"{metric.upper():6s}: point={r['point_estimate']:.4f}  95% CI=[{r['ci_low']:.4f}, {r['ci_high']:.4f}]  (n_valid_resamples={r['n_valid_resamples']})")

    with open(args.out_json, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote {args.out_json}")
