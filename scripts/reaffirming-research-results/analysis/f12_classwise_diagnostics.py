"""
ESWA-F12: computes classification accuracy and Expected Calibration Error
(ECE) per real defect class (including 'good') from a real
uavi_sample_level.json produced by run_pipeline.py.

- expected_calibration_error(confidences, corrects, n_bins=10) -> float: standard binned ECE.
- classwise_diagnostics(records) -> pandas.DataFrame: one row per (category, defect_type).
"""

import argparse
import json

import numpy as np
import pandas as pd


def expected_calibration_error(confidences, corrects, n_bins: int = 10) -> float:
    confidences = np.asarray(confidences, dtype=float)
    corrects = np.asarray(corrects, dtype=float)
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    n = len(confidences)
    if n == 0:
        return float("nan")
    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        in_bin = (confidences > lo) & (confidences <= hi) if i > 0 else (confidences >= lo) & (confidences <= hi)
        if not np.any(in_bin):
            continue
        bin_conf = confidences[in_bin].mean()
        bin_acc = corrects[in_bin].mean()
        ece += (np.sum(in_bin) / n) * abs(bin_acc - bin_conf)
    return float(ece)


def classwise_diagnostics(records):
    rows = []
    valid = [r for r in records if r.get("correct") is not None and r.get("U_composite") is not None]
    df = pd.DataFrame(valid)
    df["confidence"] = 1.0 - df["U_composite"]

    for (category, defect_type), group in df.groupby(["category", "defect_type"]):
        acc = group["correct"].mean()
        ece = expected_calibration_error(group["confidence"].tolist(), group["correct"].tolist())
        rows.append({
            "category": category,
            "defect_type": defect_type,
            "n": len(group),
            "accuracy": acc,
            "ece": ece,
        })
    return pd.DataFrame(rows).sort_values(["category", "defect_type"]).reset_index(drop=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--out-csv", default="f12_classwise_diagnostics.csv")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    result = classwise_diagnostics(records)
    pd.set_option("display.float_format", lambda x: f"{x:.4f}")
    print(result.to_string(index=False))
    result.to_csv(args.out_csv, index=False)
    print(f"\nWrote {args.out_csv}")
