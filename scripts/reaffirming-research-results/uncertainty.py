"""
Combines a primary VLM hypothesis (and, when the borderline-sampling
protocol is triggered, repeated hypotheses) into the four manuscript
uncertainty signals and the composite fusion score. Also implements the
deterministic severity-routing rule and ground-truth correctness labeling.

- u_prediction_single(h1) -> float: confidence-derived proxy, current production-path definition.
- u_prediction_self_consistency(hypotheses) -> float: agreement-based term when repeat sampling is used.
- u_lexical(hypotheses) -> float: mean pairwise Jaccard distance over evidence+location token sets; 0 if <2 hypotheses.
- u_evidence(h1, verifier_available) -> float: confidence + verifier-availability penalty term.
- fuse(u_pred, u_image, u_lex, u_evid, weights) -> float: clamped weighted composite.
- route_severity(predicted_defect_type, critical_types) -> str: deterministic 'high' vs 'normal' rule.
- is_correct(predicted_defect_present, predicted_defect_type, gt_is_defect, gt_defect_type) -> bool: classification correctness.
"""

from itertools import combinations

from config import VERIFIER_AVAILABLE_DEFAULT, EVIDENCE_UNAVAILABLE_PENALTY, FUSION_WEIGHTS_DEPLOYED


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def u_prediction_single(h1: dict) -> float:
    """Eq. u_pred: current production path, single call. U_prediction = clamp(1 - confidence)."""
    if h1.get("confidence") is None:
        return None
    return _clamp01(1.0 - h1["confidence"])


def u_prediction_self_consistency(hypotheses):
    """
    Agreement-based term for the borderline repeat-sampling protocol: the
    fraction of the N samples that DISAGREE with the plurality-vote label
    is used as the uncertainty proxy (0 = unanimous agreement, higher =
    more disagreement across real repeated calls).
    """
    labels = [h["defect_type"] for h in hypotheses if h.get("defect_type") is not None]
    if not labels:
        return None
    from collections import Counter
    counts = Counter(labels)
    _, top_count = counts.most_common(1)[0]
    disagreement_fraction = 1.0 - (top_count / len(labels))
    return _clamp01(disagreement_fraction)


def _tokenize(text: str):
    if not text:
        return set()
    return set(text.lower().replace(",", " ").replace(".", " ").split())


def u_lexical(hypotheses):
    """Eq. u_sem: mean pairwise Jaccard distance over evidence+location token sets. 0 if <2 hypotheses."""
    if len(hypotheses) < 2:
        return 0.0
    token_sets = [_tokenize((h.get("evidence") or "") + " " + (h.get("location") or "")) for h in hypotheses]
    distances = []
    for a, b in combinations(token_sets, 2):
        union = a | b
        if not union:
            distances.append(0.0)
            continue
        jaccard_sim = len(a & b) / len(union)
        distances.append(1.0 - jaccard_sim)
    return _clamp01(sum(distances) / len(distances)) if distances else 0.0


def u_evidence(h1: dict, verifier_available: bool = VERIFIER_AVAILABLE_DEFAULT) -> float:
    """Eq. u_evid: confidence-derived term plus verifier-availability penalty s."""
    if h1.get("confidence") is None:
        return None
    s = 0.0 if verifier_available else EVIDENCE_UNAVAILABLE_PENALTY
    return _clamp01(0.5 * (1.0 - h1["confidence"]) + 0.5 * s)


def fuse(u_pred, u_image, u_lex, u_evid, weights: dict = None) -> float:
    """Eq. u_comp: fixed weighted composite, clamped to [0,1]."""
    weights = weights or FUSION_WEIGHTS_DEPLOYED
    if any(v is None for v in (u_pred, u_image, u_lex, u_evid)):
        return None
    composite = (
        weights["prediction"] * u_pred
        + weights["image"] * u_image
        + weights["lexical"] * u_lex
        + weights["evidence"] * u_evid
    )
    return _clamp01(composite)


def route_severity(predicted_defect_type: str, critical_types) -> str:
    """
    Deterministic routing rule: any predicted defect type in the configured
    always-escalate set maps unconditionally to 'high' severity, independent
    of confidence or composite score.
    """
    if predicted_defect_type in set(critical_types):
        return "high"
    return "normal"


def is_correct(predicted_defect_present, predicted_defect_type, gt_is_defect, gt_defect_type) -> bool:
    """
    Classification correctness against real ground truth: for non-defective
    ground truth, correct iff the model also predicted no defect. For
    defective ground truth, correct iff the model predicted a defect AND
    named the same defect_type as ground truth.
    """
    if predicted_defect_present is None:
        return None
    if not gt_is_defect:
        return predicted_defect_present is False
    return bool(predicted_defect_present) and (predicted_defect_type == gt_defect_type)
