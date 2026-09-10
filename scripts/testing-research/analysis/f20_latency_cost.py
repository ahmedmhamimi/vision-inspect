"""
ESWA-F20: end-to-end latency, API-call-rate, and cost table from real
timing/token instrumentation recorded by run_pipeline.py, broken out by
fast path (single call) vs borderline path (primary + N repeats).

Cost figures require GEMINI_PRICING_USD_PER_1M_TOKENS in config.py to be
filled in from https://ai.google.dev/gemini-api/docs/pricing (left as None
placeholders when this pipeline was generated, since web search was
unavailable at generation time -- see config.py). Until filled in, this
script reports token/call counts and latency only, and marks cost columns
explicitly as not configured rather than guessing a number.

- latency_cost_table(records, pricing) -> pandas.DataFrame: one row per path (fast/borderline).
"""

import argparse
import json

import numpy as np
import pandas as pd

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import GEMINI_PRICING_USD_PER_1M_TOKENS  # noqa: E402


def _percentile(values, p):
    return float(np.percentile(values, p)) if values else None


def latency_cost_table(records, pricing):
    rows = []
    for path in ("fast", "borderline"):
        subset = [r for r in records if r.get("path") == path]
        if not subset:
            continue

        local_latencies = [r["latency_ms_local"] for r in subset if r.get("latency_ms_local") is not None]
        api_latencies = [r["latency_ms_api_total"] for r in subset if r.get("latency_ms_api_total") is not None]
        call_counts = [r["api_call_count"] for r in subset if r.get("api_call_count") is not None]

        prompt_tokens = [r["h1"].get("prompt_tokens") for r in subset if r["h1"].get("prompt_tokens") is not None]
        output_tokens = [r["h1"].get("output_tokens") for r in subset if r["h1"].get("output_tokens") is not None]
        for r in subset:
            for rep in r.get("repeat_hypotheses", []):
                if rep.get("prompt_tokens") is not None:
                    prompt_tokens.append(rep["prompt_tokens"])
                if rep.get("output_tokens") is not None:
                    output_tokens.append(rep["output_tokens"])

        total_prompt_tokens = sum(prompt_tokens) if prompt_tokens else None
        total_output_tokens = sum(output_tokens) if output_tokens else None

        row = {
            "path": path,
            "n_samples": len(subset),
            "mean_api_calls_per_sample": float(np.mean(call_counts)) if call_counts else None,
            "mean_local_latency_ms": float(np.mean(local_latencies)) if local_latencies else None,
            "mean_api_latency_ms": float(np.mean(api_latencies)) if api_latencies else None,
            "p95_api_latency_ms": _percentile(api_latencies, 95),
            "total_prompt_tokens": total_prompt_tokens,
            "total_output_tokens": total_output_tokens,
        }

        input_price = pricing.get("input")
        output_price = pricing.get("output")
        if input_price is not None and output_price is not None and total_prompt_tokens is not None:
            row["estimated_cost_usd"] = (
                total_prompt_tokens / 1_000_000 * input_price
                + (total_output_tokens or 0) / 1_000_000 * output_price
            )
        else:
            row["estimated_cost_usd"] = "PRICING NOT CONFIGURED -- fill in config.GEMINI_PRICING_USD_PER_1M_TOKENS"

        rows.append(row)

    return pd.DataFrame(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--out-csv", default="f20_latency_cost.csv")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    table = latency_cost_table(records, GEMINI_PRICING_USD_PER_1M_TOKENS)
    pd.set_option("display.float_format", lambda x: f"{x:.4f}")
    print(table.to_string(index=False))

    if GEMINI_PRICING_USD_PER_1M_TOKENS.get("input") is None:
        print(
            "\nNOTE: cost column not computed -- verify current Gemini pricing at "
            "https://ai.google.dev/gemini-api/docs/pricing and fill in "
            "config.GEMINI_PRICING_USD_PER_1M_TOKENS, then re-run this script."
        )

    table.to_csv(args.out_csv, index=False)
    print(f"\nWrote {args.out_csv}")
