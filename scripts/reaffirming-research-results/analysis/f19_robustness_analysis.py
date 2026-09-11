"""
ESWA-F19 (analysis half): compares a real clean-image uavi_sample_level.json
against a real corrupted-image run (produced by running run_pipeline.py
against the manifest from f19_generate_corruptions.py), reporting accuracy
and ECE degradation per corruption type and severity.

- robustness_table(clean_records, corrupted_records) -> pandas.DataFrame
"""

import argparse
import json

import pandas as pd

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "analysis"))
from f12_classwise_diagnostics import expected_calibration_error  # noqa: E402


def robustness_table(clean_records, corrupted_records):
    clean_valid = [r for r in clean_records if r.get("correct") is not None and r.get("U_composite") is not None]
    clean_acc = sum(r["correct"] for r in clean_valid) / len(clean_valid) if clean_valid else None
    clean_ece = expected_calibration_error(
        [1 - r["U_composite"] for r in clean_valid], [r["correct"] for r in clean_valid]
    ) if clean_valid else None

    rows = [{"corruption_type": "none (clean baseline)", "severity": 0,
             "n": len(clean_valid), "accuracy": clean_acc, "ece": clean_ece,
             "accuracy_delta": 0.0, "ece_delta": 0.0}]

    by_group = {}
    for r in corrupted_records:
        if r.get("correct") is None or r.get("U_composite") is None:
            continue
        key = (r.get("corruption_type"), r.get("corruption_severity"))
        by_group.setdefault(key, []).append(r)

    for (corruption_type, severity), group in sorted(by_group.items(), key=lambda kv: (str(kv[0][0]), kv[0][1])):
        acc = sum(r["correct"] for r in group) / len(group)
        ece = expected_calibration_error([1 - r["U_composite"] for r in group], [r["correct"] for r in group])
        rows.append({
            "corruption_type": corruption_type, "severity": severity, "n": len(group),
            "accuracy": acc, "ece": ece,
            "accuracy_delta": (acc - clean_acc) if clean_acc is not None else None,
            "ece_delta": (ece - clean_ece) if clean_ece is not None else None,
        })

    return pd.DataFrame(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--clean-input", default="uavi_sample_level.json")
    parser.add_argument("--corrupted-input", default="uavi_sample_level_corrupted.json")
    parser.add_argument("--out-csv", default="f19_robustness_table.csv")
    args = parser.parse_args()

    with open(args.clean_input) as f:
        clean_records = json.load(f)
    with open(args.corrupted_input) as f:
        corrupted_records = json.load(f)

    table = robustness_table(clean_records, corrupted_records)
    pd.set_option("display.float_format", lambda x: f"{x:.4f}")
    print(table.to_string(index=False))
    table.to_csv(args.out_csv, index=False)
    print(f"\nWrote {args.out_csv}")
