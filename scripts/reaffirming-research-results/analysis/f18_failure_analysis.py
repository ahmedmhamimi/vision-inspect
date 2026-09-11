"""
ESWA-F18: systematic real-world failure analysis. Mines misclassified
samples out of an already-collected real uavi_sample_level.json -- no new
API calls or images needed. Groups failures by (ground-truth class,
predicted class) confusion pair, prints the model's own evidence/location
rationale for each failure so you can manually code recurring failure
patterns (e.g. "confuses reflection with contamination"), and writes a CSV
of every failure plus a starter coding sheet for your qualitative labels.

- confusion_pairs(records) -> pandas.DataFrame: (true, predicted) counts, sorted by frequency.
- failure_detail_rows(records) -> pandas.DataFrame: one row per misclassified sample with its rationale.
- write_coding_sheet(records, out_path) -> None: a CSV with an empty 'failure_pattern' column for you to fill in by hand.
"""

import argparse
import json
from collections import Counter

import pandas as pd


def confusion_pairs(records):
    valid = [r for r in records if r.get("correct") is False and r.get("h1", {}).get("api_call_succeeded")]
    pairs = Counter((r["defect_type"], r["h1"]["defect_type"]) for r in valid)
    rows = [{"ground_truth": gt, "predicted": pred, "count": n} for (gt, pred), n in pairs.items()]
    df = pd.DataFrame(rows).sort_values("count", ascending=False).reset_index(drop=True)
    return df


def failure_detail_rows(records):
    valid = [r for r in records if r.get("correct") is False and r.get("h1", {}).get("api_call_succeeded")]
    rows = []
    for r in valid:
        rows.append({
            "sample_id": r["sample_id"],
            "category": r["category"],
            "ground_truth": r["defect_type"],
            "predicted": r["h1"]["defect_type"],
            "confidence": r["h1"]["confidence"],
            "evidence": r["h1"].get("evidence"),
            "location": r["h1"].get("location"),
            "image_path": r.get("image_path"),
            "mask_path": r.get("mask_path"),
        })
    return pd.DataFrame(rows)


def write_coding_sheet(records, out_path: str):
    df = failure_detail_rows(records)
    df["failure_pattern"] = ""  # you fill this in by hand after reviewing each row + its image
    df.to_csv(out_path, index=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--out-confusion-csv", default="f18_confusion_pairs.csv")
    parser.add_argument("--out-coding-sheet", default="f18_failure_coding_sheet.csv")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    confusion_df = confusion_pairs(records)
    print("=== Confusion pairs (ground truth -> predicted), misclassified samples only ===")
    print(confusion_df.to_string(index=False))
    confusion_df.to_csv(args.out_confusion_csv, index=False)

    write_coding_sheet(records, args.out_coding_sheet)
    print(f"\nWrote {args.out_confusion_csv}")
    print(f"Wrote {args.out_coding_sheet} -- open it, look at each image_path/mask_path pair, "
          f"read the model's evidence/location text, and fill in 'failure_pattern' by hand "
          f"(e.g. 'texture mistaken for contamination', 'defect too small relative to image'). "
          f"This qualitative coding step is inherently manual -- no script can do it for you "
          f"without either fabricating categories or requiring a second model call whose own "
          f"judgement would need the same validation problem this analysis exists to avoid.")
