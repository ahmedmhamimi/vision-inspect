"""
ESWA-F31 (partial -- real-validation figures only): generates real PNG
figure assets from the real uavi_sample_level.json for the Section 5.8
"Real-Imagery Validation" subsection added to code.tex. This does NOT
regenerate the original synthetic-benchmark figures (fig2's stale 5.50%
value, the grid-search landscape, the radar chart) -- those require the
synthetic benchmark's own sample-level data, which was never available as
a file, only as aggregate numbers in manuscript prose. Producing those
would mean either fabricating synthetic sample-level data to plot from
(not done here) or asking whoever generated the original synthetic
benchmark for its underlying per-sample export.

- plot_reliability_diagram(records, out_path) -> None
- plot_risk_coverage_curve(records, out_path) -> None
- plot_safety_bar_chart(n_ground_truth_critical, n_recalled, n_violations, n_predicted_critical, out_path) -> None
- plot_classwise_accuracy(classwise_df, out_path) -> None
"""

import argparse
import json

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from f12_classwise_diagnostics import classwise_diagnostics  # noqa: E402
from f07_bootstrap_ci import aurc as compute_aurc  # noqa: E402


def plot_reliability_diagram(records, out_path, n_bins: int = 10):
    valid = [r for r in records if r.get("correct") is not None and r.get("U_composite") is not None]
    confidences = np.array([1.0 - r["U_composite"] for r in valid])
    corrects = np.array([float(r["correct"]) for r in valid])

    bin_edges = np.linspace(0, 1, n_bins + 1)
    bin_accs, bin_confs, bin_counts = [], [], []
    for i in range(n_bins):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        mask = (confidences > lo) & (confidences <= hi) if i > 0 else (confidences >= lo) & (confidences <= hi)
        if np.any(mask):
            bin_accs.append(corrects[mask].mean())
            bin_confs.append(confidences[mask].mean())
            bin_counts.append(mask.sum())
        else:
            bin_accs.append(np.nan)
            bin_confs.append((lo + hi) / 2)
            bin_counts.append(0)

    fig, ax = plt.subplots(figsize=(6, 6))
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", label="Perfect calibration")
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    ax.bar(bin_centers, bin_accs, width=1.0 / n_bins * 0.9, edgecolor="black",
           alpha=0.7, label="Empirical accuracy per bin", color="#4C72B0")
    ax.set_xlabel("Mean predicted confidence (bin)")
    ax.set_ylabel("Empirical accuracy (bin)")
    ax.set_title(f"Reliability Diagram -- Real MVTec AD Validation (n={len(valid)})")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.legend()
    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)


def plot_risk_coverage_curve(records, out_path):
    valid = [r for r in records if r.get("correct") is not None and r.get("U_composite") is not None]
    confidences = np.array([1.0 - r["U_composite"] for r in valid])
    corrects = np.array([float(r["correct"]) for r in valid])

    order = np.argsort(-confidences)
    sorted_correct = corrects[order]
    n = len(sorted_correct)
    coverages = np.arange(1, n + 1) / n
    cumulative_correct = np.cumsum(sorted_correct)
    risks = 1.0 - (cumulative_correct / np.arange(1, n + 1))

    aurc_value = compute_aurc(confidences, corrects)

    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(coverages, risks, color="#C44E52", linewidth=2)
    ax.set_xlabel("Coverage (fraction auto-accepted)")
    ax.set_ylabel("Risk (error rate on accepted subset)")
    ax.set_title(f"Risk-Coverage Curve -- Real MVTec AD Validation (n={n})\nFull-range AURC = {aurc_value:.4f}")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, max(risks.max() * 1.1, 0.05))
    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)


def plot_safety_bar_chart(n_ground_truth_critical, n_recalled, n_violations, n_predicted_critical, out_path):
    fig, ax = plt.subplots(figsize=(6, 5))
    categories = ["Ground-truth critical\nrecall", "Rule-conditional\nPVR"]
    values = [n_recalled / n_ground_truth_critical if n_ground_truth_critical else 0,
              n_violations / n_predicted_critical if n_predicted_critical else 0]
    colors = ["#55A868", "#C44E52"]
    bars = ax.bar(categories, values, color=colors, edgecolor="black")
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, val + 0.02, f"{val:.1%}", ha="center", fontweight="bold")
    ax.set_ylim(0, 1.1)
    ax.set_ylabel("Rate")
    ax.set_title("Safety Decomposition -- Real MVTec AD Validation")
    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)


def plot_classwise_accuracy(classwise_df, out_path):
    fig, ax = plt.subplots(figsize=(7, 5))
    labels = [f"{row.defect_type}\n(n={row.n})" for row in classwise_df.itertuples()]
    ax.bar(labels, classwise_df["accuracy"], color="#4C72B0", edgecolor="black")
    ax.set_ylabel("Accuracy")
    ax.set_ylim(0, 1.05)
    ax.set_title("Class-Wise Accuracy -- Real MVTec AD Validation")
    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--frozen-config", default="uavi_sample_level_frozen_config.json")
    parser.add_argument("--safety-json", default="../f10_safety_decomposition.json",
                         help="Output of f10_safety_decomposition.py")
    parser.add_argument("--out-prefix", default="fig_real_validation")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    plot_reliability_diagram(records, f"{args.out_prefix}_reliability.png")
    plot_risk_coverage_curve(records, f"{args.out_prefix}_risk_coverage.png")

    classwise_df = classwise_diagnostics(records)
    plot_classwise_accuracy(classwise_df, f"{args.out_prefix}_classwise.png")

    try:
        with open(args.safety_json) as f:
            safety = json.load(f)
        plot_safety_bar_chart(
            safety["n_ground_truth_critical"],
            safety["n_upstream_correctly_flagged_critical"],
            safety["n_rule_conditional_violations"],
            safety["n_predicted_critical_by_upstream"],
            f"{args.out_prefix}_safety.png",
        )
    except FileNotFoundError:
        print(f"Skipped safety chart -- {args.safety_json} not found. Run f10_safety_decomposition.py first.")

    print(f"Wrote {args.out_prefix}_reliability.png, {args.out_prefix}_risk_coverage.png, "
          f"{args.out_prefix}_classwise.png (and _safety.png if the safety JSON was found).")
