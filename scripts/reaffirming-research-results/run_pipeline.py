"""
End-to-end orchestrator: for each real image in a manifest, computes the
local image-quality signal, makes one real primary Gemini call, optionally
triggers real repeated Gemini calls when the primary confidence falls in the
borderline band, fuses all signals into U_composite, applies the
deterministic routing rule, and writes one JSON record per sample to
uavi_sample_level.json. This is the single frozen run that F01/F31/F33
depend on -- re-run it once, with one fixed config, and treat that run's
output as the source of truth for every downstream table/figure.

- run(args) -> None: drives the full pipeline and writes output + a frozen run-config snapshot.
- process_sample(sample, api_key, taxonomy, critical_types, cfg) -> dict: full per-sample record.
"""

import argparse
import json
import os
import time
from datetime import datetime, timezone

from tqdm import tqdm

import config
from image_quality import compute_u_image
from vlm_client import call_gemini_once, call_gemini_repeated
from uncertainty import (
    u_prediction_single,
    u_prediction_self_consistency,
    u_lexical,
    u_evidence,
    fuse,
    route_severity,
    is_correct,
)


def build_taxonomy_for_category(manifest, category):
    return sorted({m["defect_type"] for m in manifest if m["category"] == category and m["is_defect"]})


def process_sample(sample, api_key, taxonomy, critical_types, cfg):
    record = dict(sample)  # carries sample_id, category, split, defect_type, is_defect, image_path, mask_path

    t0 = time.perf_counter()
    quality = compute_u_image(sample["image_path"])
    local_latency_ms = (time.perf_counter() - t0) * 1000.0
    record["image_quality"] = quality

    h1 = call_gemini_once(sample["image_path"], api_key, taxonomy, temperature=0.0)
    record["h1"] = h1
    api_call_count = 1
    api_latency_ms_total = h1.get("latency_ms") or 0.0

    u_pred_single = u_prediction_single(h1) if h1.get("api_call_succeeded") else None

    borderline = (
        u_pred_single is not None
        and cfg["tau_low"] <= u_pred_single <= cfg["tau_high"]
        and cfg["enable_repeat_sampling"]
    )
    record["borderline_triggered"] = bool(borderline)

    hypotheses_for_lexical = [h1]
    u_pred_final = u_pred_single

    if borderline:
        repeats = call_gemini_repeated(
            sample["image_path"], api_key, taxonomy, n=cfg["n_repeat"], temperature=cfg["temperature"]
        )
        record["repeat_hypotheses"] = repeats
        successful_repeats = [h1] + [h for h in repeats if h.get("api_call_succeeded")]
        api_call_count += len(repeats)
        api_latency_ms_total += sum((h.get("latency_ms") or 0.0) for h in repeats)
        u_pred_final = u_prediction_self_consistency(successful_repeats)
        hypotheses_for_lexical = successful_repeats
    else:
        record["repeat_hypotheses"] = []

    record["U_prediction"] = u_pred_final
    record["U_image"] = quality["U_image"]
    record["U_lexical"] = u_lexical(hypotheses_for_lexical)
    record["U_evidence"] = u_evidence(h1, verifier_available=config.VERIFIER_AVAILABLE_DEFAULT) if h1.get("api_call_succeeded") else None
    record["U_composite"] = fuse(
        record["U_prediction"], record["U_image"], record["U_lexical"], record["U_evidence"],
        weights=cfg["fusion_weights"],
    )

    predicted_type = h1.get("defect_type")
    record["severity"] = route_severity(predicted_type, critical_types) if h1.get("api_call_succeeded") else None
    record["correct"] = is_correct(
        h1.get("defect_present"), predicted_type, sample["is_defect"], sample["defect_type"]
    ) if h1.get("api_call_succeeded") else None

    record["latency_ms_local"] = local_latency_ms
    record["latency_ms_api_total"] = api_latency_ms_total
    record["api_call_count"] = api_call_count
    record["path"] = "borderline" if borderline else "fast"

    return record


def run(args):
    with open(args.manifest) as f:
        manifest = json.load(f)

    if args.max_samples:
        manifest = manifest[: args.max_samples]

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("Provide --api-key or set the GEMINI_API_KEY environment variable.")

    cfg = {
        "tau_low": args.tau_low,
        "tau_high": args.tau_high,
        "enable_repeat_sampling": args.enable_repeat_sampling,
        "n_repeat": args.n_repeat,
        "temperature": args.temperature,
        "fusion_weights": config.FUSION_WEIGHTS_DEPLOYED,
    }

    taxonomy_by_category = {
        category: build_taxonomy_for_category(manifest, category)
        for category in sorted({m["category"] for m in manifest})
    }

    critical_types_by_category = {}
    for category in taxonomy_by_category:
        try:
            critical_types_by_category[category] = config.get_critical_types(category)
        except ValueError as e:
            raise SystemExit(str(e))

    results = []
    for sample in tqdm(manifest, desc="Running pipeline"):
        taxonomy = taxonomy_by_category[sample["category"]]
        critical_types = critical_types_by_category[sample["category"]]
        results.append(process_sample(sample, api_key, taxonomy, critical_types, cfg))

    with open(args.out, "w") as f:
        json.dump(results, f, indent=2)

    run_config_snapshot = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "manifest": args.manifest,
        "n_samples": len(results),
        "gemini_model": config.GEMINI_MODEL,
        "fusion_weights": cfg["fusion_weights"],
        "tau_low": cfg["tau_low"],
        "tau_high": cfg["tau_high"],
        "enable_repeat_sampling": cfg["enable_repeat_sampling"],
        "n_repeat": cfg["n_repeat"],
        "temperature": cfg["temperature"],
        "critical_types_by_category": critical_types_by_category,
        "blur_laplacian_norm": config.BLUR_LAPLACIAN_NORM,
        "resolution_bounds_px": [config.RESOLUTION_MIN_PX, config.RESOLUTION_MAX_PX],
        "u_image_weights": config.U_IMAGE_WEIGHTS,
    }
    frozen_config_path = os.path.splitext(args.out)[0] + "_frozen_config.json"
    with open(frozen_config_path, "w") as f:
        json.dump(run_config_snapshot, f, indent=2)

    print(f"\nWrote {len(results)} sample records to {args.out}")
    print(f"Wrote frozen run config to {frozen_config_path}")
    print("This frozen config + output file is what F01/F31/F33 should treat as the single source of truth.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the real UAVI pipeline over a real MVTec manifest.")
    parser.add_argument("--manifest", default="manifest.json")
    parser.add_argument("--out", default="uavi_sample_level.json")
    parser.add_argument("--api-key", default=None, help="Gemini API key; falls back to GEMINI_API_KEY env var")
    parser.add_argument("--max-samples", type=int, default=None, help="Cap samples processed (cost control while testing)")
    parser.add_argument("--tau-low", type=float, default=config.DEFAULT_TAU_BORDERLINE_LOW)
    parser.add_argument("--tau-high", type=float, default=config.DEFAULT_TAU_BORDERLINE_HIGH)
    parser.add_argument("--enable-repeat-sampling", action="store_true", help="Actually exercise the borderline N-sample protocol")
    parser.add_argument("--n-repeat", type=int, default=config.DEFAULT_N_REPEAT_SAMPLES)
    parser.add_argument("--temperature", type=float, default=config.DEFAULT_SAMPLING_TEMPERATURE)
    args = parser.parse_args()
    run(args)
