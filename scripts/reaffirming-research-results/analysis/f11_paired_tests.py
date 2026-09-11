"""
ESWA-F11: paired statistical comparison between the raw single-shot VLM
confidence baseline and the fused U_composite score, from real sample-level
outputs. Uses the DeLong test for paired AUROC comparison when both AUROCs
are non-degenerate; automatically falls back to a paired bootstrap
difference test on ECE and Brier score when AUROC is degenerate (e.g. sits
at exactly 1.000, which makes DeLong's variance estimate collapse to zero
and the test statistic undefined).

- delong_roc_variance(ground_truth, predictions) -> tuple[float, float]: AUC and its variance (Sun & Xu fast DeLong).
- paired_delong_test(y_true, scores_a, scores_b) -> dict: z-stat, p-value for AUC_a vs AUC_b.
- bootstrap_paired_difference(metric_fn, y_true, conf_a, conf_b, n_resamples=2000) -> dict: CI + p-value for the paired difference.
- run_f11(records, n_resamples=2000) -> dict: full result including which method was used and why.
"""

import argparse
import json

import numpy as np
from scipy import stats

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from f12_classwise_diagnostics import expected_calibration_error  # noqa: E402
from f07_bootstrap_ci import brier_score, auroc_error_prediction  # noqa: E402


# --- Fast DeLong implementation (Sun & Xu, 2014) -----------------------------

def _compute_midrank(x):
    J = np.argsort(x)
    Z = x[J]
    N = len(x)
    T = np.zeros(N, dtype=float)
    i = 0
    while i < N:
        j = i
        while j < N and Z[j] == Z[i]:
            j += 1
        T[i:j] = 0.5 * (i + j - 1) + 1
        i = j
    T2 = np.empty(N, dtype=float)
    T2[J] = T
    return T2


def _delong_variance(ground_truth, predictions):
    order = np.argsort(-ground_truth)
    predictions_sorted = predictions[order]
    ground_truth_sorted = ground_truth[order]

    m = int(np.sum(ground_truth_sorted))  # positives (errors)
    n = len(ground_truth_sorted) - m       # negatives (corrects)
    if m == 0 or n == 0:
        return None, None  # degenerate: one class absent

    positive_scores = predictions_sorted[:m]
    negative_scores = predictions_sorted[m:]

    tx = _compute_midrank(positive_scores)
    ty = _compute_midrank(negative_scores)
    tz = _compute_midrank(predictions_sorted)

    v01 = (tz[:m] - tx) / n
    v10 = 1.0 - (tz[m:] - ty) / m

    auc = np.mean(v01)  # equivalent to standard AUC estimator here
    var = np.var(v01, ddof=1) / m + np.var(v10, ddof=1) / n
    return float(auc), float(var)


def delong_roc_variance(ground_truth, predictions):
    return _delong_variance(np.asarray(ground_truth, dtype=float), np.asarray(predictions, dtype=float))


def paired_delong_test(y_true, scores_a, scores_b):
    auc_a, var_a = delong_roc_variance(y_true, scores_a)
    auc_b, var_b = delong_roc_variance(y_true, scores_b)
    if auc_a is None or auc_b is None or var_a == 0 or var_b == 0:
        return {"usable": False, "reason": "degenerate AUROC or zero variance in at least one arm"}

    var_diff = var_a + var_b  # conservative (ignores covariance term); flags degeneracy regardless
    if var_diff <= 0:
        return {"usable": False, "reason": "zero combined variance"}

    z = (auc_a - auc_b) / np.sqrt(var_diff)
    p = 2 * (1 - stats.norm.cdf(abs(z)))
    return {"usable": True, "auc_a": auc_a, "auc_b": auc_b, "z": float(z), "p_value": float(p)}


def bootstrap_paired_difference(metric_fn, y_true, conf_a, conf_b, n_resamples: int = 2000, seed: int = 42):
    rng = np.random.default_rng(seed)
    y_true = np.asarray(y_true)
    conf_a = np.asarray(conf_a)
    conf_b = np.asarray(conf_b)
    n = len(y_true)

    point_diff = metric_fn(conf_a, y_true) - metric_fn(conf_b, y_true)

    diffs = []
    for _ in range(n_resamples):
        idx = rng.integers(0, n, size=n)
        diffs.append(metric_fn(conf_a[idx], y_true[idx]) - metric_fn(conf_b[idx], y_true[idx]))
    diffs = np.array(diffs)

    ci_low, ci_high = np.percentile(diffs, [2.5, 97.5])
    # two-sided bootstrap p-value: proportion of resamples on the other side of 0 from the point estimate, doubled
    p_value = 2 * min(np.mean(diffs <= 0), np.mean(diffs >= 0))
    p_value = min(p_value, 1.0)

    return {
        "point_diff": float(point_diff),
        "ci_low": float(ci_low),
        "ci_high": float(ci_high),
        "p_value": float(p_value),
        "n_resamples": n_resamples,
    }


def run_f11(records, n_resamples: int = 2000):
    valid = [r for r in records if r.get("correct") is not None and r.get("U_composite") is not None and r["h1"].get("confidence") is not None]
    y_true = np.array([1 - r["correct"] for r in valid], dtype=float)  # 1 = model was wrong
    baseline_conf = np.array([r["h1"]["confidence"] for r in valid], dtype=float)
    composite_conf = np.array([1.0 - r["U_composite"] for r in valid], dtype=float)

    baseline_error_score = 1.0 - baseline_conf
    composite_error_score = 1.0 - composite_conf

    delong_result = paired_delong_test(y_true, baseline_error_score, composite_error_score)

    result = {"n_samples": len(valid), "delong": delong_result}

    if not delong_result.get("usable"):
        ece_fallback = bootstrap_paired_difference(
            lambda conf, y: expected_calibration_error(conf, 1 - y, n_bins=10),
            y_true, baseline_conf, composite_conf, n_resamples=n_resamples,
        )
        brier_fallback = bootstrap_paired_difference(
            lambda conf, y: brier_score(conf, 1 - y),
            y_true, baseline_conf, composite_conf, n_resamples=n_resamples,
        )
        result["fallback_used"] = True
        result["fallback_reason"] = delong_result.get("reason")
        result["bootstrap_ece_difference"] = ece_fallback
        result["bootstrap_brier_difference"] = brier_fallback
    else:
        result["fallback_used"] = False

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--n-resamples", type=int, default=2000)
    parser.add_argument("--out-json", default="f11_paired_tests.json")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    result = run_f11(records, n_resamples=args.n_resamples)

    print(f"N samples: {result['n_samples']}")
    if not result["fallback_used"]:
        d = result["delong"]
        print(f"DeLong test usable. AUROC_baseline={d['auc_a']:.4f} AUROC_composite={d['auc_b']:.4f} z={d['z']:.4f} p={d['p_value']:.4g}")
    else:
        print(f"DeLong degenerate ({result['fallback_reason']}) -- using paired bootstrap fallback on ECE/Brier.\n")
        ece = result["bootstrap_ece_difference"]
        brier = result["bootstrap_brier_difference"]
        print(f"ECE difference (baseline - composite): {ece['point_diff']:.4f}  95% CI=[{ece['ci_low']:.4f}, {ece['ci_high']:.4f}]  p={ece['p_value']:.4g}")
        print(f"Brier difference (baseline - composite): {brier['point_diff']:.4f}  95% CI=[{brier['ci_low']:.4f}, {brier['ci_high']:.4f}]  p={brier['p_value']:.4g}")

    with open(args.out_json, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nWrote {args.out_json}")
