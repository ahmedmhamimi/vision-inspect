"""
Central configuration for the UAVI real-data evaluation pipeline. Holds the
exact constants stated in the manuscript (blur/exposure/resolution formula
parameters, fusion weights, routing rule) plus a few values that must be
supplied by the user rather than assumed (critical defect types for a given
dataset, current Gemini API pricing).

- get_critical_types(category) -> list[str]: returns the always-escalate
  defect-type names for a given MVTec category; raises if not configured.
"""

# ---------------------------------------------------------------------------
# Image-quality term constants (Eq. blur/exposure/u_img in the manuscript)
# ---------------------------------------------------------------------------
BLUR_LAPLACIAN_NORM = 1500.0        # b = 1 - min(1, Var(Laplacian)/1500)
EXPOSURE_SHADOW_THRESHOLD = 5        # pixels <= 5 counted as extreme shadow
EXPOSURE_HIGHLIGHT_THRESHOLD = 250   # pixels >= 250 counted as extreme highlight
RESOLUTION_MIN_PX = 800              # penalized below this (per side)
RESOLUTION_MAX_PX = 3000             # penalized above this (per side)

U_IMAGE_WEIGHTS = {"blur": 0.45, "exposure": 0.35, "resolution": 0.20}

# NOTE ON RHO: the manuscript describes the *qualitative* penalty behavior
# for resolution (penalize <800x800 and >3000x3000) but does not give an
# explicit closed-form equation for rho in the text extracted from code.tex.
# image_quality.py implements a linear-penalty formalization of that
# description. This formalization -- not just the 1500/0.45/0.35/0.20/800/3000
# constants -- is exactly what F14's threshold sweep (analysis/f14_*.py) is
# meant to interrogate: run the sweep on your real data and either confirm
# the constants are reasonable or replace them with justified alternatives.

# ---------------------------------------------------------------------------
# Fusion weights (Eq. u_comp). Deployed config per the manuscript is
# (0.70, 0.10, 0.10, 0.10) for (prediction, image, lexical, evidence).
# Alternatives are kept here so f14/ablation-style scripts can compare.
# ---------------------------------------------------------------------------
FUSION_WEIGHTS_DEPLOYED = {"prediction": 0.70, "image": 0.10, "lexical": 0.10, "evidence": 0.10}
FUSION_WEIGHTS_EQUAL = {"prediction": 0.25, "image": 0.25, "lexical": 0.25, "evidence": 0.25}
FUSION_WEIGHTS_ORIGINAL_HEURISTIC = {"prediction": 0.35, "image": 0.25, "lexical": 0.20, "evidence": 0.20}

# ---------------------------------------------------------------------------
# Evidence term default verifier-availability flag. The manuscript states the
# current production path does not dispatch an image-conditioned verifier
# call, so the default flag value applies: s = 0.6.
# ---------------------------------------------------------------------------
VERIFIER_AVAILABLE_DEFAULT = False
EVIDENCE_UNAVAILABLE_PENALTY = 0.6

# ---------------------------------------------------------------------------
# VLM configuration
# ---------------------------------------------------------------------------
GEMINI_MODEL = "gemini-3.5-flash-lite"
# NOTE: the key goes in the x-goog-api-key header (see vlm_client.py), not in
# this URL. Google AI Studio now issues "AQ."-prefixed Authentication Keys by
# default, which the older `?key=...` query-param auth method rejects (404/401
# depending on account); the header method works for both AQ. and legacy
# AIzaSy... keys. See https://ai.google.dev/gemini-api/docs/api-key
GEMINI_API_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)
REQUEST_TIMEOUT_SECONDS = 60
MAX_RETRIES = 3

# ---------------------------------------------------------------------------
# Borderline repeat-sampling protocol (the manuscript's *proposed* extension,
# genuinely implemented and executed here against real images so F13's
# sensitivity sweep has real repeated-call data to sweep over).
# ---------------------------------------------------------------------------
DEFAULT_TAU_BORDERLINE_LOW = 0.01
DEFAULT_TAU_BORDERLINE_HIGH = 0.99
DEFAULT_N_REPEAT_SAMPLES = 5
DEFAULT_SAMPLING_TEMPERATURE = 0.8

# ---------------------------------------------------------------------------
# CRITICAL DEFECT TYPES -- must be set per dataset. This is a configuration
# / labeling decision, not something that can be inferred automatically, so
# it is deliberately left empty by default and will raise if unset. Document
# your choice (and rationale) in your manuscript's methods section, since
# MVTec's defect taxonomy per category differs from the original "crack /
# missing-component" always-escalate set assumed in the manuscript text.
# ---------------------------------------------------------------------------
CRITICAL_DEFECT_TYPES_BY_CATEGORY = {
    # bottle: MVTec's real defect taxonomy for this category is
    # broken_large, broken_small, contamination. broken_large/broken_small
    # are structural breaks (always-escalate); contamination is treated as
    # non-critical (quality-only) here. This is a judgement call made for
    # this run -- revise it and state the rationale in the manuscript's
    # methods section if you disagree.
    "bottle": ["broken_large", "broken_small"],
}


def get_critical_types(category: str):
    """Return the configured critical/always-escalate defect types for a category."""
    if category not in CRITICAL_DEFECT_TYPES_BY_CATEGORY:
        raise ValueError(
            f"No critical-defect-type configuration found for category '{category}'. "
            f"Edit config.py:CRITICAL_DEFECT_TYPES_BY_CATEGORY to specify which of "
            f"this category's real defect types should be treated as safety-critical "
            f"(always-escalate) before running the pipeline or F10 safety decomposition."
        )
    return CRITICAL_DEFECT_TYPES_BY_CATEGORY[category]


# ---------------------------------------------------------------------------
# GEMINI API PRICING -- confirmed via web search across multiple independent
# sources (Google's own "Introducing Gemini 3.6 Flash, 3.5 Flash-Lite, and
# 3.5 Flash Cyber" announcement blog post, OpenRouter, Artificial Analysis,
# and several pricing trackers, all agreeing) for gemini-3.5-flash-lite,
# Standard tier, as of September 2026. The numeric values happen to be
# identical to the older gemini-2.5-flash's pricing this file previously
# used -- that's a coincidence, not a stale reference; both models are
# separately priced at $0.30/$2.50 per million tokens. Re-verify at
# https://ai.google.dev/gemini-api/docs/pricing before final manuscript
# numbers, since Google revises pricing over time and ships new model
# generations frequently (3.6/3.7/3.8 Flash already exist at different
# price points as of this writing -- confirm GEMINI_MODEL above still
# matches these figures if you ever change it).
# ---------------------------------------------------------------------------
GEMINI_PRICING_USD_PER_1M_TOKENS = {
    "input": 0.30,   # gemini-3.5-flash-lite, Standard tier
    "output": 2.50,  # gemini-3.5-flash-lite, Standard tier, including thinking tokens
}
