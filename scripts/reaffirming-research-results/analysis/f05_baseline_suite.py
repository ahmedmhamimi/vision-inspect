"""
ESWA-F05: journal-grade black-box baseline suite. Adds two additional
black-box uncertainty baselines from the literature already cited in the
manuscript's literature review -- semantic entropy over the discrete
defect-type label distribution (Kuhn et al.), and embedding-dispersion
uncertainty over the free-text evidence/location rationale (Lin, Trivedi &
Sun) -- computed from REAL repeat-sampling hypotheses already collected by
run_pipeline.py --enable-repeat-sampling (F13's rerun). No new API calls:
this only requires sentence-transformers to run locally for the embedding
baseline. Compares all baselines' AUROC/ECE/Brier against raw confidence
and the fused composite score on samples where repeat hypotheses exist.

- semantic_entropy(hypotheses) -> float: Shannon entropy (bits) of the defect_type label distribution.
- embedding_dispersion(hypotheses, model) -> float: mean pairwise cosine distance of evidence+location embeddings.
- baseline_comparison(records, model) -> pandas.DataFrame: AUROC/ECE/Brier per baseline, borderline samples only.
"""

import argparse
import json
import math
from collections import Counter

import numpy as np
import pandas as pd

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from f12_classwise_diagnostics import expected_calibration_error  # noqa: E402
from f07_bootstrap_ci import brier_score, auroc_error_prediction  # noqa: E402


def semantic_entropy(hypotheses) -> float:
    labels = [h["defect_type"] for h in hypotheses if h.get("api_call_succeeded")]
    if not labels:
        return None
    counts = Counter(labels)
    n = len(labels)
    probs = [c / n for c in counts.values()]
    return float(-sum(p * math.log2(p) for p in probs))


def embedding_dispersion(hypotheses, model) -> float:
    texts = [
        (h.get("evidence") or "") + " " + (h.get("location") or "")
        for h in hypotheses if h.get("api_call_succeeded")
    ]
    if len(texts) < 2:
        return 0.0
    embeddings = model.encode(texts, normalize_embeddings=True)
    n = len(embeddings)
    dists = []
    for i in range(n):
        for j in range(i + 1, n):
            cos_sim = float(np.dot(embeddings[i], embeddings[j]))
            dists.append(1.0 - cos_sim)
    return float(np.mean(dists))


def _bootstrap_baseline_metrics(confidences, corrects, n_resamples=1000, seed=42):
    rng = np.random.default_rng(seed)
    confidences = np.asarray(confidences, dtype=float)
    corrects = np.asarray(corrects, dtype=float)
    n = len(confidences)

    point_ece = expected_calibration_error(confidences, corrects)
    point_brier = brier_score(confidences, corrects)
    point_auroc = auroc_error_prediction(confidences, corrects)

    return {"n": n, "ece": point_ece, "brier": point_brier, "auroc": point_auroc}


def baseline_comparison(records, model=None):
    borderline = [r for r in records if r.get("repeat_hypotheses") and r.get("correct") is not None]
    if not borderline:
        raise ValueError(
            "No samples with repeat_hypotheses found. Run run_pipeline.py with "
            "--enable-repeat-sampling first (F13's rerun) so there is real repeat-sampling "
            "data for the semantic-entropy and embedding-dispersion baselines to use."
        )

    raw_confidence = [r["h1"]["confidence"] for r in borderline]
    composite_confidence = [1.0 - r["U_composite"] for r in borderline]
    corrects = [r["correct"] for r in borderline]

    entropies = []
    dispersions = []
    for r in borderline:
        all_hyps = [r["h1"]] + r["repeat_hypotheses"]
        entropies.append(semantic_entropy(all_hyps))
        if model is not None:
            dispersions.append(embedding_dispersion(all_hyps, model))

    max_entropy = max((e for e in entropies if e is not None), default=1.0) or 1.0
    entropy_confidence = [1.0 - (e / max_entropy if e is not None else 0.0) for e in entropies]

    rows = []
    for name, confidences in [
        ("Raw single-call confidence", raw_confidence),
        ("Fused composite (UAVI)", composite_confidence),
        ("Semantic entropy (label distribution)", entropy_confidence),
    ]:
        m = _bootstrap_baseline_metrics(confidences, corrects)
        rows.append({"baseline": name, **m})

    if model is not None and dispersions:
        max_disp = max(dispersions) or 1.0
        dispersion_confidence = [1.0 - (d / max_disp) for d in dispersions]
        m = _bootstrap_baseline_metrics(dispersion_confidence, corrects)
        rows.append({"baseline": "Embedding dispersion (evidence+location)", **m})

    return pd.DataFrame(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--out-csv", default="f05_baseline_comparison.csv")
    parser.add_argument("--skip-embedding-baseline", action="store_true",
                         help="Skip the sentence-transformers embedding-dispersion baseline (no model download needed)")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    model = None
    if not args.skip_embedding_baseline:
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer("all-MiniLM-L6-v2")
        except ImportError:
            print("sentence-transformers not installed -- skipping embedding-dispersion baseline. "
                  "Install with: pip install sentence-transformers")

    result = baseline_comparison(records, model)
    pd.set_option("display.float_format", lambda x: f"{x:.4f}")
    print(result.to_string(index=False))
    result.to_csv(args.out_csv, index=False)
    print(f"\nWrote {args.out_csv}")
    print(
        "\nNOTE: this comparison runs only on samples where repeat sampling was actually "
        "triggered (borderline path) since the new baselines require multiple hypotheses per "
        "sample. This is typically a small subset of your full sample -- report the subset size "
        "(the 'n' column) alongside these numbers rather than presenting them as full-dataset "
        "results."
    )
