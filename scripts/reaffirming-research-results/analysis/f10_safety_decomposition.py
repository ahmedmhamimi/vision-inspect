"""
ESWA-F10: decomposes safety performance into two distinct failure modes
using real sample-level outputs and real ground truth:

1. Ground-truth critical-defect recall / false-negative rate: of the samples
   whose REAL defect type is safety-critical, what fraction did the upstream
   VLM correctly classify into a critical/escalate category at all (upstream
   perception failure, occurs before the routing rule ever runs)?
2. Rule-conditional policy violation rate (PVR): of the samples the upstream
   VLM DID classify into a critical type, what fraction did the deterministic
   routing rule fail to escalate to 'high' (should be structurally 0, since
   the rule is a pure set-membership check -- this is measured anyway as a
   sanity check on the routing implementation)?

- safety_decomposition(records, critical_types_by_category) -> dict
"""

import argparse
import json


def safety_decomposition(records, critical_types_by_category: dict):
    valid = [r for r in records if r.get("h1", {}).get("api_call_succeeded")]

    gt_critical = [r for r in valid if r["defect_type"] in critical_types_by_category.get(r["category"], [])]
    n_gt_critical = len(gt_critical)

    upstream_flagged = [
        r for r in gt_critical
        if r["h1"]["defect_type"] in critical_types_by_category.get(r["category"], [])
    ]
    n_upstream_flagged = len(upstream_flagged)

    gt_recall = (n_upstream_flagged / n_gt_critical) if n_gt_critical else None
    gt_fnr = (1 - gt_recall) if gt_recall is not None else None

    predicted_critical = [
        r for r in valid
        if r["h1"]["defect_type"] in critical_types_by_category.get(r["category"], [])
    ]
    n_predicted_critical = len(predicted_critical)
    rule_violations = [r for r in predicted_critical if r.get("severity") != "high"]
    n_violations = len(rule_violations)
    rule_conditional_pvr = (n_violations / n_predicted_critical) if n_predicted_critical else None

    return {
        "n_total_valid_samples": len(valid),
        "n_ground_truth_critical": n_gt_critical,
        "n_upstream_correctly_flagged_critical": n_upstream_flagged,
        "ground_truth_critical_recall": gt_recall,
        "ground_truth_critical_false_negative_rate": gt_fnr,
        "n_predicted_critical_by_upstream": n_predicted_critical,
        "n_rule_conditional_violations": n_violations,
        "rule_conditional_pvr": rule_conditional_pvr,
        "explanatory_note": (
            "Ground-truth critical recall/FNR characterizes upstream VLM perception "
            "failure: real critical defects the model itself misclassified into a "
            "non-critical type, which the deterministic routing rule can never see or "
            "correct, since it only inspects the model's own output label. "
            "Rule-conditional PVR characterizes routing-implementation failure: cases "
            "the model DID label as critical but which the routing rule then failed to "
            "escalate to 'high' severity. If the routing implementation is correct, "
            "rule_conditional_pvr should be exactly 0.0 by construction -- a nonzero "
            "value here would indicate a bug in route_severity(), not a modeling "
            "limitation, and should be investigated before reporting these numbers."
        ),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--frozen-config", default="uavi_sample_level_frozen_config.json",
                         help="Frozen run config written by run_pipeline.py, used to read critical_types_by_category")
    parser.add_argument("--out-json", default="f10_safety_decomposition.json")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)
    with open(args.frozen_config) as f:
        frozen_config = json.load(f)

    result = safety_decomposition(records, frozen_config["critical_types_by_category"])

    for k, v in result.items():
        if k == "explanatory_note":
            continue
        print(f"{k}: {v}")
    print(f"\n{result['explanatory_note']}")

    with open(args.out_json, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nWrote {args.out_json}")
