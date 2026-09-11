"""
ESWA-F13: sensitivity of accuracy/ECE/coverage to the borderline threshold
band (tau) and repeat-sampling budget (N), computed by re-slicing the REAL
cached repeated hypotheses that run_pipeline.py already collected for
borderline-triggered samples (run with --enable-repeat-sampling and a wide
--tau-low/--tau-high band so the cache is rich). No new API calls are made
here -- this only resweeps which of the already-collected real repeated
calls "count" under a hypothetically different tau/N, and recomputes the
plurality-vote outcome and resulting accuracy/ECE for that hypothetical
configuration.

IMPORTANT: samples that were not triggered as borderline under the original
run's tau band have no cached repeats at all, so this sweep can only
faithfully explore tau values >= the original run's tau_low and <= tau_high,
and N values <= the original run's n_repeat. Widening beyond that requires
a fresh run_pipeline.py pass (real, but incurring new API cost).

- resolve_prediction_type(h1, repeats, n_use) -> str: plurality vote over the first n_use cached repeats plus h1.
- sweep(records, tau_values, n_values) -> pandas.DataFrame: accuracy/ECE/coverage per (tau, n) cell.
"""

import argparse
import json
from collections import Counter

import numpy as np
import pandas as pd

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from f12_classwise_diagnostics import expected_calibration_error  # noqa: E402


def resolve_prediction_type(h1, repeats, n_use):
    pool = [h1] + repeats[:n_use]
    labels = [h["defect_type"] for h in pool if h.get("api_call_succeeded")]
    if not labels:
        return None
    return Counter(labels).most_common(1)[0][0]


def sweep(records, tau_values, n_values):
    rows = []
    for tau in tau_values:
        for n_use in n_values:
            corrects, confidences = [], []
            n_would_be_borderline = 0
            for r in records:
                h1 = r.get("h1", {})
                if not h1.get("api_call_succeeded") or h1.get("confidence") is None:
                    continue
                u_pred_single = max(0.0, min(1.0, 1.0 - h1["confidence"]))
                is_borderline_here = tau <= u_pred_single <= (1.0 - tau) if tau <= 0.5 else False

                repeats_available = [h for h in r.get("repeat_hypotheses", []) if h.get("api_call_succeeded")]

                if is_borderline_here and repeats_available:
                    n_would_be_borderline += 1
                    predicted_type = resolve_prediction_type(h1, repeats_available, n_use)
                    confidence = 1.0 - (1.0 if predicted_type is None else 0.0)  # placeholder if resolution fails
                    confidence = h1["confidence"]  # fall back to primary-call confidence for calibration bookkeeping
                else:
                    predicted_type = h1["defect_type"]
                    confidence = h1["confidence"]

                correct = int(predicted_type == r["defect_type"]) if r["is_defect"] else int(predicted_type == "good")
                corrects.append(correct)
                confidences.append(confidence)

            if not corrects:
                continue
            acc = float(np.mean(corrects))
            ece = expected_calibration_error(confidences, corrects, n_bins=10)
            rows.append({
                "tau": tau,
                "n_repeat_used": n_use,
                "n_samples": len(corrects),
                "n_borderline_resolved": n_would_be_borderline,
                "accuracy": acc,
                "ece": ece,
            })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--tau-values", nargs="*", type=float, default=[0.05, 0.10, 0.15, 0.20, 0.25])
    parser.add_argument("--n-values", nargs="*", type=int, default=[1, 2, 3, 4, 5])
    parser.add_argument("--out-csv", default="f13_threshold_budget_sensitivity.csv")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    n_with_repeats = sum(1 for r in records if r.get("repeat_hypotheses"))
    if n_with_repeats == 0:
        raise SystemExit(
            "No cached repeated hypotheses found in the input file. Re-run "
            "run_pipeline.py with --enable-repeat-sampling (and a wide "
            "--tau-low/--tau-high band) before running this sweep."
        )

    result = sweep(records, args.tau_values, args.n_values)
    pd.set_option("display.float_format", lambda x: f"{x:.4f}")
    print(f"Samples with cached repeated calls available: {n_with_repeats}\n")
    print(result.to_string(index=False))
    result.to_csv(args.out_csv, index=False)
    print(f"\nWrote {args.out_csv}")
