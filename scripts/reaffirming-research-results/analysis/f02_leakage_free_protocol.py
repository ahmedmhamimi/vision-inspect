"""
ESWA-F02 / ESWA-F06: introduces a leakage-free calibration/test protocol.
Splits real sample-level records into a calibration split and a held-out
test split (stratified by category+defect_type so both splits see every
real class), selects the selective-review threshold on the calibration
split ONLY (targeting a user-specified minimum accuracy on the
non-escalated subset), then applies that exact, frozen threshold to the
test split and reports accuracy/coverage there -- demonstrating that no
information from the test split influenced the threshold choice.

- stratified_split(records, calibration_frac=0.5, seed=42) -> tuple[list, list]
- select_threshold_for_target_accuracy(records, target_accuracy=0.99) -> float | None
- evaluate_at_threshold(records, threshold) -> dict: coverage, accuracy, risk on that split at that threshold.
"""

import argparse
import json
from collections import defaultdict

import numpy as np


def stratified_split(records, calibration_frac: float = 0.5, seed: int = 42):
    rng = np.random.default_rng(seed)
    by_class = defaultdict(list)
    for r in records:
        by_class[(r["category"], r["defect_type"])].append(r)

    calibration, test = [], []
    for key, group in by_class.items():
        group = list(group)
        rng.shuffle(group)
        n_calib = max(1, round(len(group) * calibration_frac)) if len(group) > 1 else (1 if rng.random() < calibration_frac else 0)
        calibration.extend(group[:n_calib])
        test.extend(group[n_calib:])
    return calibration, test


def select_threshold_for_target_accuracy(records, target_accuracy: float = 0.99):
    """
    Selects the LOWEST U_composite threshold tau such that, among calibration
    samples with U_composite <= tau (i.e. the samples that would NOT be
    escalated to mandatory human review), accuracy is >= target_accuracy,
    maximizing coverage subject to that constraint. Returns None if no
    threshold on this calibration split achieves the target.
    """
    valid = [r for r in records if r.get("U_composite") is not None and r.get("correct") is not None]
    if not valid:
        return None
    candidates = sorted(set(r["U_composite"] for r in valid))

    best_tau = None
    best_coverage = -1
    for tau in candidates:
        non_escalated = [r for r in valid if r["U_composite"] <= tau]
        if not non_escalated:
            continue
        accuracy = np.mean([r["correct"] for r in non_escalated])
        coverage = len(non_escalated) / len(valid)
        if accuracy >= target_accuracy and coverage > best_coverage:
            best_tau = tau
            best_coverage = coverage
    return best_tau


def evaluate_at_threshold(records, threshold):
    valid = [r for r in records if r.get("U_composite") is not None and r.get("correct") is not None]
    if not valid:
        return {"n": 0, "coverage": None, "accuracy": None, "risk": None}
    if threshold is None:
        return {"n": len(valid), "coverage": None, "accuracy": None, "risk": None,
                "note": "no threshold selected on calibration split"}
    non_escalated = [r for r in valid if r["U_composite"] <= threshold]
    coverage = len(non_escalated) / len(valid)
    accuracy = float(np.mean([r["correct"] for r in non_escalated])) if non_escalated else None
    risk = (1 - accuracy) if accuracy is not None else None
    return {"n": len(valid), "n_non_escalated": len(non_escalated), "coverage": coverage,
            "accuracy": accuracy, "risk": risk}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--calibration-frac", type=float, default=0.5)
    parser.add_argument("--target-accuracy", type=float, default=0.99)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out-json", default="f02_leakage_free_protocol.json")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    calibration, test = stratified_split(records, args.calibration_frac, args.seed)
    print(f"Calibration split: {len(calibration)} samples. Test split: {len(test)} samples.")

    threshold = select_threshold_for_target_accuracy(calibration, args.target_accuracy)
    if threshold is None:
        print(f"\nNo threshold on the calibration split achieved {args.target_accuracy:.1%} accuracy "
              f"at any coverage level. This is a legitimate real result at this sample size -- "
              f"do not lower the target or peek at the test split to find one that works; report "
              f"this honestly (e.g. 'no threshold meeting the target accuracy was found on the "
              f"calibration split at n=...') rather than picking a threshold post hoc.")
    else:
        print(f"\nThreshold selected on CALIBRATION split only (target accuracy={args.target_accuracy:.1%}): "
              f"U_composite <= {threshold:.4f}")

    calib_eval = evaluate_at_threshold(calibration, threshold)
    test_eval = evaluate_at_threshold(test, threshold)

    print("\n=== Calibration split (threshold was fit here) ===")
    print(calib_eval)
    print("\n=== Test split (threshold applied unmodified, never seen during selection) ===")
    print(test_eval)

    result = {
        "threshold": threshold,
        "target_accuracy": args.target_accuracy,
        "calibration_frac": args.calibration_frac,
        "seed": args.seed,
        "calibration_eval": calib_eval,
        "test_eval": test_eval,
    }
    with open(args.out_json, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nWrote {args.out_json}")
    print(
        "\nReport the TEST split's accuracy/coverage as the leakage-free headline number -- "
        "the calibration split's accuracy is expected to look at least as good by construction "
        "(the threshold was chosen to satisfy it) and should not be reported as the deployment-"
        "representative figure."
    )
