"""
ESWA-F08: computes the 4x4 Spearman rank-correlation matrix among the four
uncertainty signals (U_prediction, U_image, U_lexical, U_evidence) from a
real uavi_sample_level.json, using scipy.stats.spearmanr.

- spearman_signal_matrix(records) -> tuple[pandas.DataFrame, pandas.DataFrame]: (rho matrix, p-value matrix).
"""

import argparse
import json

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

SIGNALS = ["U_prediction", "U_image", "U_lexical", "U_evidence"]


def spearman_signal_matrix(records):
    df = pd.DataFrame(records)
    df = df.dropna(subset=SIGNALS)
    values = df[SIGNALS].to_numpy(dtype=float)

    n = len(SIGNALS)
    rho_matrix = np.eye(n)
    p_matrix = np.zeros((n, n))

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            rho, p = spearmanr(values[:, i], values[:, j])
            rho_matrix[i, j] = rho
            p_matrix[i, j] = p

    rho_df = pd.DataFrame(rho_matrix, index=SIGNALS, columns=SIGNALS)
    p_df = pd.DataFrame(p_matrix, index=SIGNALS, columns=SIGNALS)
    return rho_df, p_df, len(df)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="uavi_sample_level.json")
    parser.add_argument("--out-csv", default="f08_spearman_matrix.csv")
    args = parser.parse_args()

    with open(args.input) as f:
        records = json.load(f)

    rho_df, p_df, n_used = spearman_signal_matrix(records)
    pd.set_option("display.float_format", lambda x: f"{x:.4f}")
    print(f"N samples used (non-missing on all 4 signals): {n_used}\n")
    print("Spearman rho:")
    print(rho_df.to_string())
    print("\np-values:")
    print(p_df.to_string())

    rho_df.to_csv(args.out_csv)
    print(f"\nWrote {args.out_csv}")
