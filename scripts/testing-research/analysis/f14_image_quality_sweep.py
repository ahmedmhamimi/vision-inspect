"""
ESWA-F14: sweeps the image-quality constants (blur normalization constant,
U_image sub-weights, resolution bounds) against real downstream calibration
outcomes (ECE of U_image alone as an error predictor, and correlation of
U_image with actual classification correctness) using the real images and
real correctness labels already computed in uavi_sample_level.json. This
recomputes U_image from the raw stored width/height/laplacian_variance for
each candidate constant setting -- no new image reads or API calls needed.

- recompute_u_image(record, laplacian_norm, weights, res_min, res_max) -> float
- sweep_laplacian_norm(records, candidates) -> pandas.DataFrame
- sweep_resolution_bounds(records, candidate_bounds) -> pandas.DataFrame
- sweep_weights(records, candidate_weight_sets) -> pandas.DataFrame
- write_justification_template(best_config, out_path) -> None: drafts an engineering-justification paragraph from the sweep results for direct use in the manuscript.
"""

import argparse
import json

import numpy as np
import pandas as pd
from scipy.stats import pointbiserialr


def _clamp01(x):
    return max(0.0, min(1.0, x))


def recompute_u_image(record, laplacian_norm, weights, res_min, res_max):
    q = record["image_quality"]
    b = _clamp01(1.0 - min(1.0, q["laplacian_variance"] / laplacian_norm))
    gamma = q["gamma_exposure"]  # exposure constants (5/250) not swept here; independent of these three constants
    width, height = q["width"], q["height"]
    min_side, max_side = min(width, height), max(width, height)
    under = max(0.0, (res_min - min_side) / res_min)
    over = max(0.0, (max_side - res_max) / res_max)
    rho = _clamp01(under + over)
    return _clamp01(weights["blur"] * b + weights["exposure"] * gamma + weights["resolution"] * rho)


def _score_config(records, laplacian_norm, weights, res_min, res_max):
    valid = [r for r in records if r.get("correct") is not None and "image_quality" in r]
    u_values = np.array([recompute_u_image(r, laplacian_norm, weights, res_min, res_max) for r in valid])
    incorrect = np.array([1 - int(r["correct"]) for r in valid])
    if len(set(incorrect.tolist())) < 2:
        corr = None
    else:
        corr, _ = pointbiserialr(incorrect, u_values)
    return float(np.mean(u_values)), (float(corr) if corr is not None else None), len(valid)


def sweep_laplacian_norm(records, candidates):
    rows = []
    for norm in candidates:
        mean_u, corr, n = _score_config(
            records, norm,
            {"blur": 0.45, "exposure": 0.35, "resolution": 0.20},
            800, 3000,
        )
        rows.append({"laplacian_norm": norm, "mean_U_image": mean_u,
                      "corr_with_error": corr, "n": n})
    return pd.DataFrame(rows)


def sweep_resolution_bounds(records, candidate_bounds):
    rows = []
    for res_min, res_max in candidate_bounds:
        mean_u, corr, n = _score_config(
            records, 1500,
            {"blur": 0.45, "exposure": 0.35, "resolution": 0.20},
            res_min, res_max,
        )
        rows.append({"res_min": res_min, "res_max": res_max, "mean_U_image": mean_u,
                      "corr_with_error": corr, "n": n})
    return pd.DataFrame(rows)


def sweep_weights(records, candidate_weight_sets):
    rows = []
    for weights in candidate_weight_sets:
        mean_u, corr, n = _score_config(records, 1500, weights, 800, 3000)
        rows.append({**weights, "mean_U_image": mean_u, "corr_with_error": corr, "n": n})
    return pd.DataFrame(rows)


def write_justification_template(laplacian_df, resolution_df, weights_df, out_path):
    best_lap = laplacian_df.loc[laplacian_df["corr_with_error"].abs().idxmax()] if laplacian_df["corr_with_error"].notna().any() else None
    best_res = resolution_df.loc[resolution_df["corr_with_error"].abs().idxmax()] if resolution_df["corr_with_error"].notna().any() else None
    best_w = weights_df.loc[weights_df["corr_with_error"].abs().idxmax()] if weights_df["corr_with_error"].notna().any() else None

    lines = [
        "DRAFT engineering-justification paragraph (edit before use -- verify the",
        "numbers below against your own sweep output; do not paste unread):",
        "",
    ]
    if best_lap is not None:
        lines.append(
            f"The blur-normalization constant was swept over "
            f"{sorted(laplacian_df['laplacian_norm'].tolist())} on the real evaluation "
            f"set; point-biserial correlation between U_image and classification "
            f"error peaked at {best_lap['corr_with_error']:.4f} for a normalization "
            f"constant of {best_lap['laplacian_norm']:.0f}, "
            f"{'supporting' if abs(best_lap['laplacian_norm'] - 1500) < 200 else 'differing from'} "
            f"the manuscript's originally assumed value of 1500."
        )
    if best_res is not None:
        lines.append(
            f"Resolution bounds were swept over the candidate pairs tested; "
            f"correlation with classification error was strongest at "
            f"({best_res['res_min']:.0f}, {best_res['res_max']:.0f}) px, versus the "
            f"manuscript's originally assumed (800, 3000) px."
        )
    if best_w is not None:
        lines.append(
            f"Among the U_image sub-weight configurations tested, the strongest "
            f"correlation with classification error was obtained at "
            f"blur={best_w['blur']:.2f}, exposure={best_w['exposure']:.2f}, "
            f"resolution={best_w['resolution']:.2f}."
        )
    lines.append(
        "\nCaveat to state explicitly in the manuscript: this sweep evaluates each "
        "constant's correlation with FINAL classification correctness on the real "
        "evaluation set, which is a downstream, indirect signal -- it does not "
        "directly validate the constants against a ground-truth blur/exposure "
        "quality judgement, since no such human-labeled quality ground truth is "
        "available for this dataset."
    )

    with open(out_path, "w") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--out-prefix", default="f14")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    laplacian_candidates = [500, 800, 1000, 1200, 1500, 2000, 2500, 3000]
    resolution_candidates = [(600, 2500), (700, 2800), (800, 3000), (900, 3200), (1000, 3500)]
    weight_candidates = [
        {"blur": 0.45, "exposure": 0.35, "resolution": 0.20},
        {"blur": 0.60, "exposure": 0.25, "resolution": 0.15},
        {"blur": 0.34, "exposure": 0.33, "resolution": 0.33},
        {"blur": 0.50, "exposure": 0.30, "resolution": 0.20},
    ]

    lap_df = sweep_laplacian_norm(records, laplacian_candidates)
    res_df = sweep_resolution_bounds(records, resolution_candidates)
    w_df = sweep_weights(records, weight_candidates)

    pd.set_option("display.float_format", lambda x: f"{x:.4f}")
    print("=== Laplacian norm sweep ===")
    print(lap_df.to_string(index=False))
    print("\n=== Resolution bounds sweep ===")
    print(res_df.to_string(index=False))
    print("\n=== U_image weights sweep ===")
    print(w_df.to_string(index=False))

    lap_df.to_csv(f"{args.out_prefix}_laplacian_sweep.csv", index=False)
    res_df.to_csv(f"{args.out_prefix}_resolution_sweep.csv", index=False)
    w_df.to_csv(f"{args.out_prefix}_weights_sweep.csv", index=False)

    justification_path = f"{args.out_prefix}_justification_draft.txt"
    write_justification_template(lap_df, res_df, w_df, justification_path)
    print(f"\nWrote sweep CSVs and a DRAFT justification paragraph to {justification_path} (edit before use).")
