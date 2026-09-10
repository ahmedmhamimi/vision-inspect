#!/usr/bin/env python3
"""
run.py -- single entry point for the whole UAVI real-data evaluation pipeline.

Replaces the multi-step README dance (ingest_mvtec.py -> run_pipeline.py ->
each analysis/f*.py by hand) with one command:

    export GEMINI_API_KEY=your_key_here
    python run.py --dataset-root .. --out-dir results --max-samples 10   # smoke test
    python run.py --dataset-root .. --out-dir results --enable-repeat-sampling  # real run

Given the folder layout in the prompt this was written for:

    gulag/
      bottle/{train,test,ground_truth}/...
      eswa_pipeline/
        run.py   <-- this file
        config.py, run_pipeline.py, ingest_mvtec.py, ...

`--dataset-root ..` (the default) points at `gulag/`, which contains the
`bottle/` category folder in the standard MVTec train/test/ground_truth
layout. Add more category folders next to `bottle/` and they'll be picked
up automatically.

What this script does, in order:
  1. Discover real MVTec category folders under --dataset-root and build a
     manifest (ingest_mvtec.build_manifest).
  2. Resolve the safety-critical defect-type taxonomy for every discovered
     category (see TAXONOMY CONFIGURATION below) and apply it to
     config.CRITICAL_DEFECT_TYPES_BY_CATEGORY for this run.
  3. Run the real pipeline over the manifest (run_pipeline.run), writing
     <out-dir>/uavi_sample_level.json and its frozen-config sibling.
  4. Run every analysis/f*.py script over that output (unless
     --skip-analysis), writing their tables/CSVs into <out-dir>/analysis/.

Nothing here invents data: every step operates on real images and (if you
provide GEMINI_API_KEY) real API calls, exactly as the individual scripts
already did -- this just chains them together and fills in the one
configuration value (taxonomy) the pipeline otherwise refuses to run
without.

TAXONOMY CONFIGURATION
-----------------------
`config.py` already hardcodes the taxonomy for `bottle` (its real MVTec
defect types are broken_large, broken_small, contamination; broken_large/
broken_small are treated as safety-critical/always-escalate here, and
contamination is not -- see the comment in config.py). That is a labeling
judgement call, not a fact inferred from the data, so re-check it against
your own safety criteria before citing results.

For any *other* MVTec category you point --dataset-root at, this script
will look it up in DEFAULT_CRITICAL_TYPES below (a few more MVTec
categories are pre-filled as a starting point -- again, judgement calls,
not ground truth). If a discovered category isn't in config.py or in
DEFAULT_CRITICAL_TYPES, the run stops and tells you exactly which
category/defect-types need a decision, via --critical-types.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import config  # noqa: E402
import ingest_mvtec  # noqa: E402
import run_pipeline  # noqa: E402


# Starting-point judgement calls for MVTec categories beyond "bottle" (which
# is already configured in config.py). Only used for categories that are
# NOT already present in config.CRITICAL_DEFECT_TYPES_BY_CATEGORY. Edit
# freely -- these are defaults, not verified safety determinations.
DEFAULT_CRITICAL_TYPES = {
    "bottle": ["broken_large", "broken_small"],
    "cable": ["cable_swap", "cut_inner_insulation", "missing_wire"],
    "capsule": ["crack", "squeeze"],
    "carpet": ["hole", "cut"],
    "grid": ["broken", "thread"],
    "hazelnut": ["crack", "hole"],
    "leather": ["cut", "glue"],
    "metal_nut": ["bent", "flip"],
    "pill": ["crack", "faulty_imprint"],
    "screw": ["thread_top", "thread_side"],
    "tile": ["crack", "gray_stroke"],
    "toothbrush": ["defective"],
    "transistor": ["bent_lead", "misplaced", "damaged_case"],
    "wood": ["hole", "scratch"],
    "zipper": ["broken_teeth", "fabric_border"],
}


def resolve_taxonomy(categories):
    """Fill config.CRITICAL_DEFECT_TYPES_BY_CATEGORY for every discovered
    category, preferring whatever's already hardcoded in config.py, falling
    back to DEFAULT_CRITICAL_TYPES, and raising with a clear message for
    anything genuinely unconfigured."""
    unresolved = []
    for category in categories:
        if category in config.CRITICAL_DEFECT_TYPES_BY_CATEGORY:
            continue  # already configured in config.py -- leave it alone
        if category in DEFAULT_CRITICAL_TYPES:
            config.CRITICAL_DEFECT_TYPES_BY_CATEGORY[category] = DEFAULT_CRITICAL_TYPES[category]
            print(
                f"[run.py] '{category}' not in config.py -- applied default "
                f"critical-type judgement call: {DEFAULT_CRITICAL_TYPES[category]}. "
                f"Review this before citing results."
            )
        else:
            unresolved.append(category)

    if unresolved:
        raise SystemExit(
            "No critical-defect-type configuration for: "
            f"{unresolved}. Add entries to config.py:CRITICAL_DEFECT_TYPES_BY_CATEGORY, "
            f"or pass --critical-types path/to/overrides.json with "
            f'{{"category": ["defect_type", ...]}} entries for these categories.'
        )


def apply_critical_types_override(path):
    with open(path) as f:
        overrides = json.load(f)
    config.CRITICAL_DEFECT_TYPES_BY_CATEGORY.update(overrides)
    print(f"[run.py] Applied critical-type overrides from {path}: {list(overrides)}")


def ensure_dependencies():
    required = ["numpy", "scipy", "sklearn", "pandas", "PIL", "cv2", "requests", "tqdm"]
    missing = []
    for mod in required:
        try:
            if mod == "sklearn":
                import sklearn  # noqa: F401
            elif mod == "PIL":
                import PIL  # noqa: F401
            elif mod == "cv2":
                import cv2  # noqa: F401
            else:
                __import__(mod)
        except ImportError:
            missing.append(mod)
    if missing:
        print(f"[run.py] Missing required packages: {missing}. Installing from requirements.txt ...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(HERE / "requirements.txt")], check=True)


def run_analysis_scripts(sample_level_path, frozen_config_path, out_dir, enable_repeat_sampling):
    analysis_dir = HERE / "analysis"
    out_dir.mkdir(parents=True, exist_ok=True)

    scripts = [
        ["f07_bootstrap_ci.py", ["--input", str(Path(sample_level_path).resolve()), "--out-json", str((out_dir / "f07_bootstrap_ci.json").resolve())]],
        ["f08_spearman_matrix.py", ["--input", str(Path(sample_level_path).resolve()), "--out-csv", str((out_dir / "f08_spearman_matrix.csv").resolve())]],
        ["f10_safety_decomposition.py", ["--input", str(Path(sample_level_path).resolve()), "--frozen-config", str(Path(frozen_config_path).resolve()), "--out-json", str((out_dir / "f10_safety_decomposition.json").resolve())]],
        ["f11_paired_tests.py", ["--input", str(Path(sample_level_path).resolve()), "--out-json", str((out_dir / "f11_paired_tests.json").resolve())]],
        ["f12_classwise_diagnostics.py", ["--input", str(Path(sample_level_path).resolve()), "--out-csv", str((out_dir / "f12_classwise_diagnostics.csv").resolve())]],
        ["f14_image_quality_sweep.py", ["--input", str(Path(sample_level_path).resolve()), "--out-prefix", str((out_dir / "f14").resolve())]],
        ["f20_latency_cost.py", ["--input", str(Path(sample_level_path).resolve()), "--out-csv", str((out_dir / "f20_latency_cost.csv").resolve())]],
    ]

    if enable_repeat_sampling:
        scripts.append(
            ["f13_threshold_budget_sensitivity.py", ["--input", str(Path(sample_level_path).resolve()), "--out-csv", str((out_dir / "f13_threshold_budget_sensitivity.csv").resolve())]]
        )
    else:
        print(
            "[run.py] Skipping F13 (threshold/budget sensitivity): it needs "
            "repeat-sampling data cached by --enable-repeat-sampling. Re-run "
            "with that flag, then run.py --skip-ingest --skip-run to just "
            "redo analysis."
        )

    for script_name, script_args in scripts:
        script_path = analysis_dir / script_name
        print(f"\n[run.py] Running {script_name} ...")
        result = subprocess.run([sys.executable, str(script_path)] + script_args, cwd=str(HERE))
        if result.returncode != 0:
            print(f"[run.py] WARNING: {script_name} exited with code {result.returncode}")


def main():
    parser = argparse.ArgumentParser(
        description="Run the whole UAVI real-data evaluation pipeline end to end.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--dataset-root", default="..", help="Folder containing MVTec category folders (default: .., i.e. the parent of eswa_pipeline/)")
    parser.add_argument("--categories", nargs="*", default=None, help="Subset of categories to include (default: all discovered)")
    parser.add_argument("--include-train", action="store_true", help="Include train/good images in the manifest")
    parser.add_argument("--out-dir", default="results", help="Where to write manifest, sample-level output, frozen config, and analysis outputs")
    parser.add_argument("--critical-types", default=None, help="Path to a JSON file of {category: [defect_type, ...]} overrides/additions")

    parser.add_argument("--api-key", default=None, help="Gemini API key; falls back to GEMINI_API_KEY env var")
    parser.add_argument("--max-samples", type=int, default=None, help="Cap samples processed (cost control while testing)")
    parser.add_argument("--tau-low", type=float, default=config.DEFAULT_TAU_BORDERLINE_LOW)
    parser.add_argument("--tau-high", type=float, default=config.DEFAULT_TAU_BORDERLINE_HIGH)
    parser.add_argument("--enable-repeat-sampling", action="store_true", help="Exercise the borderline N-sample protocol")
    parser.add_argument("--n-repeat", type=int, default=config.DEFAULT_N_REPEAT_SAMPLES)
    parser.add_argument("--temperature", type=float, default=config.DEFAULT_SAMPLING_TEMPERATURE)

    parser.add_argument("--skip-ingest", action="store_true", help="Reuse an existing manifest in --out-dir instead of rebuilding it")
    parser.add_argument("--skip-run", action="store_true", help="Skip the pipeline run and reuse existing sample-level output in --out-dir (e.g. to just redo analysis)")
    parser.add_argument("--skip-analysis", action="store_true", help="Skip the analysis/f*.py scripts")
    parser.add_argument("--install-deps", action="store_true", help="pip install -r requirements.txt before doing anything else")

    args = parser.parse_args()

    if args.install_deps:
        print("[run.py] Installing dependencies from requirements.txt ...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(HERE / "requirements.txt")], check=True)
    else:
        ensure_dependencies()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.json"
    sample_level_path = out_dir / "uavi_sample_level.json"
    frozen_config_path = out_dir / "uavi_sample_level_frozen_config.json"

    # --- 1. Ingest ---------------------------------------------------------
    if args.skip_ingest:
        if not manifest_path.exists():
            raise SystemExit(f"--skip-ingest given but {manifest_path} does not exist.")
        with open(manifest_path) as f:
            manifest = json.load(f)
        print(f"[run.py] Reusing existing manifest: {manifest_path} ({len(manifest)} samples)")
    else:
        print(f"[run.py] Building manifest from {args.dataset_root} ...")
        manifest = ingest_mvtec.build_manifest(args.dataset_root, args.categories, args.include_train)
        ingest_mvtec.summarize_manifest(manifest)
        ingest_mvtec.save_manifest(manifest, str(manifest_path))
        print(f"[run.py] Wrote manifest: {manifest_path}")

    categories = sorted({m["category"] for m in manifest})

    # --- 2. Configure taxonomy ---------------------------------------------
    if args.critical_types:
        apply_critical_types_override(args.critical_types)
    resolve_taxonomy(categories)

    # --- 3. Run the pipeline ------------------------------------------------
    if args.skip_run:
        if not sample_level_path.exists():
            raise SystemExit(f"--skip-run given but {sample_level_path} does not exist.")
        print(f"[run.py] Reusing existing pipeline output: {sample_level_path}")
    else:
        api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise SystemExit("Provide --api-key or set the GEMINI_API_KEY environment variable.")

        pipeline_args = argparse.Namespace(
            manifest=str(manifest_path),
            out=str(sample_level_path),
            api_key=api_key,
            max_samples=args.max_samples,
            tau_low=args.tau_low,
            tau_high=args.tau_high,
            enable_repeat_sampling=args.enable_repeat_sampling,
            n_repeat=args.n_repeat,
            temperature=args.temperature,
        )
        print("[run.py] Running the pipeline (real Gemini calls) ...")
        run_pipeline.run(pipeline_args)

    # --- 4. Analysis ---------------------------------------------------------
    if args.skip_analysis:
        print("[run.py] --skip-analysis given, stopping here.")
        return

    run_analysis_scripts(sample_level_path, frozen_config_path, out_dir / "analysis", args.enable_repeat_sampling)

    print(f"\n[run.py] Done. Frozen evidence base: {sample_level_path} + {frozen_config_path}")
    print(f"[run.py] Analysis outputs: {out_dir / 'analysis'}")


if __name__ == "__main__":
    main()
