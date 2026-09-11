"""
ESWA-F21 (analysis half): loads 2+ real run outputs (from run_repeatability.py)
over the SAME manifest and measures real run-to-run stochastic repeatability:
label agreement rate per sample, confidence standard deviation per sample,
and ECE/accuracy variability across runs at the aggregate level.

- load_runs(paths) -> list[list[dict]]
- per_sample_agreement(runs) -> pandas.DataFrame: one row per sample_id, majority-label agreement rate + confidence std across runs.
- aggregate_variability(runs) -> pandas.DataFrame: accuracy/ECE per run, to see aggregate-level spread.
"""

import argparse
import json
from collections import Counter, defaultdict

import numpy as np
import pandas as pd

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from f12_classwise_diagnostics import expected_calibration_error  # noqa: E402


def load_runs(paths):
    runs = []
    for p in paths:
        with open(p) as f:
            runs.append(json.load(f))
    return runs


def per_sample_agreement(runs):
    by_sample = defaultdict(list)
    for run in runs:
        for r in run:
            if r.get("h1", {}).get("api_call_succeeded"):
                by_sample[r["sample_id"]].append(r)

    rows = []
    for sample_id, records in by_sample.items():
        labels = [r["h1"]["defect_type"] for r in records]
        confidences = [r["h1"]["confidence"] for r in records]
        label_counts = Counter(labels)
        _, top_count = label_counts.most_common(1)[0]
        agreement_rate = top_count / len(labels)
        rows.append({
            "sample_id": sample_id,
            "n_runs_succeeded": len(records),
            "n_distinct_labels": len(label_counts),
            "label_agreement_rate": agreement_rate,
            "confidence_mean": float(np.mean(confidences)),
            "confidence_std": float(np.std(confidences)),
        })
    return pd.DataFrame(rows).sort_values("label_agreement_rate")


def aggregate_variability(runs):
    rows = []
    for i, run in enumerate(runs, start=1):
        valid = [r for r in run if r.get("correct") is not None and r.get("U_composite") is not None]
        if not valid:
            continue
        acc = float(np.mean([r["correct"] for r in valid]))
        ece = expected_calibration_error([1 - r["U_composite"] for r in valid], [r["correct"] for r in valid])
        rows.append({"run": i, "n": len(valid), "accuracy": acc, "ece": ece})
    return pd.DataFrame(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", nargs="+", required=True, help="Paths to 2+ uavi_sample_level_run{i}.json files")
    parser.add_argument("--out-per-sample-csv", default="f21_per_sample_agreement.csv")
    parser.add_argument("--out-aggregate-csv", default="f21_aggregate_variability.csv")
    args = parser.parse_args()

    if len(args.runs) < 2:
        raise SystemExit("Provide at least 2 run files to measure repeatability.")

    runs = load_runs(args.runs)

    agreement_df = per_sample_agreement(runs)
    pd.set_option("display.float_format", lambda x: f"{x:.4f}")
    print(f"=== Per-sample label agreement across {len(runs)} real runs ===")
    print(agreement_df.to_string(index=False))
    agreement_df.to_csv(args.out_per_sample_csv, index=False)

    overall_agreement = agreement_df["label_agreement_rate"].mean()
    print(f"\nMean per-sample label agreement rate across runs: {overall_agreement:.4f}")

    variability_df = aggregate_variability(runs)
    print(f"\n=== Aggregate accuracy/ECE per run ===")
    print(variability_df.to_string(index=False))
    variability_df.to_csv(args.out_aggregate_csv, index=False)

    print(f"\nWrote {args.out_per_sample_csv} and {args.out_aggregate_csv}")
