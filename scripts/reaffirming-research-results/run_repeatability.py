"""
ESWA-F21: runs the real pipeline (real Gemini calls, same manifest) R times
in a row and saves each run's output separately, so run-to-run stochastic
repeatability can be measured for real rather than assumed. Reuses
run_pipeline.process_sample directly rather than re-implementing it.

- run_multiple(args) -> None: executes R real passes, writing uavi_sample_level_run{i}.json each time.
"""

import argparse
import json
import os

from tqdm import tqdm

import config
from run_pipeline import process_sample, build_taxonomy_for_category


def run_multiple(args):
    with open(args.manifest) as f:
        manifest = json.load(f)
    if args.max_samples:
        manifest = manifest[: args.max_samples]

    api_key = args.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("Provide --api-key or set the GEMINI_API_KEY environment variable.")

    cfg = {
        "tau_low": config.DEFAULT_TAU_BORDERLINE_LOW,
        "tau_high": config.DEFAULT_TAU_BORDERLINE_HIGH,
        "enable_repeat_sampling": False,  # repeatability of the audited single-call path specifically
        "n_repeat": 0,
        "temperature": 0.0,
        "fusion_weights": config.FUSION_WEIGHTS_DEPLOYED,
    }

    taxonomy_by_category = {
        category: build_taxonomy_for_category(manifest, category)
        for category in sorted({m["category"] for m in manifest})
    }
    critical_types_by_category = {
        category: config.get_critical_types(category) for category in taxonomy_by_category
    }

    for run_idx in range(1, args.n_runs + 1):
        print(f"\n=== Run {run_idx}/{args.n_runs} ===")
        results = []
        for sample in tqdm(manifest, desc=f"Run {run_idx}"):
            taxonomy = taxonomy_by_category[sample["category"]]
            critical_types = critical_types_by_category[sample["category"]]
            results.append(process_sample(sample, api_key, taxonomy, critical_types, cfg))

        out_path = f"{args.out_prefix}_run{run_idx}.json"
        with open(out_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the real pipeline R times for repeatability measurement.")
    parser.add_argument("--manifest", default="manifest.json")
    parser.add_argument("--n-runs", type=int, default=3)
    parser.add_argument("--out-prefix", default="uavi_sample_level")
    parser.add_argument("--api-key", default=None)
    parser.add_argument("--max-samples", type=int, default=None,
                         help="Cap samples (cost control -- this multiplies API cost by n_runs)")
    args = parser.parse_args()

    print(
        f"COST WARNING: this makes {args.n_runs}x the real Gemini calls of a single run "
        f"(one full pass per run, same images). Use --max-samples to control cost while testing."
    )
    run_multiple(args)
