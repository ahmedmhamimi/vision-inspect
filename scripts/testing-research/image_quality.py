"""
Computes the local, API-free U_image uncertainty signal from a real image
file: blur (variance-of-Laplacian), exposure (shadow/highlight histogram
saturation), and resolution density, combined per the manuscript's fixed
linear weighting. No model calls; pure pixel-data computation.

- compute_blur_score(gray) -> tuple[float, float]: (raw Laplacian variance, normalized b in [0,1]).
- compute_exposure_score(gray) -> float: gamma, proportion of extreme-shadow/highlight pixels.
- compute_resolution_score(width, height) -> float: rho, linear penalty outside [800,3000]px per side.
- compute_u_image(image_path, weights=None) -> dict: all sub-signals plus the clamped composite U_image.
"""

import numpy as np
from PIL import Image
import cv2

from config import (
    BLUR_LAPLACIAN_NORM,
    EXPOSURE_SHADOW_THRESHOLD,
    EXPOSURE_HIGHLIGHT_THRESHOLD,
    RESOLUTION_MIN_PX,
    RESOLUTION_MAX_PX,
    U_IMAGE_WEIGHTS,
)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def compute_blur_score(gray: np.ndarray):
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = float(laplacian.var())
    b = 1.0 - min(1.0, variance / BLUR_LAPLACIAN_NORM)
    return variance, _clamp01(b)


def compute_exposure_score(gray: np.ndarray) -> float:
    total = gray.size
    extreme = np.sum((gray <= EXPOSURE_SHADOW_THRESHOLD) | (gray >= EXPOSURE_HIGHLIGHT_THRESHOLD))
    gamma = float(extreme) / float(total)
    return _clamp01(gamma)


def compute_resolution_score(width: int, height: int) -> float:
    """
    Linear-penalty formalization of the manuscript's qualitative description
    (penalize below 800x800, penalize above 3000x3000). This exact functional
    form is an interpretation, not a verbatim equation from the manuscript --
    see config.py's note on RHO. F14's threshold sweep should be used to
    check whether this formalization (and its bounds) behaves sensibly on
    your real data.
    """
    min_side = min(width, height)
    max_side = max(width, height)
    under = max(0.0, (RESOLUTION_MIN_PX - min_side) / RESOLUTION_MIN_PX)
    over = max(0.0, (max_side - RESOLUTION_MAX_PX) / RESOLUTION_MAX_PX)
    return _clamp01(under + over)


def compute_u_image(image_path: str, weights: dict = None) -> dict:
    weights = weights or U_IMAGE_WEIGHTS
    pil_img = Image.open(image_path).convert("RGB")
    width, height = pil_img.size
    gray = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2GRAY)

    laplacian_var, b = compute_blur_score(gray)
    gamma = compute_exposure_score(gray)
    rho = compute_resolution_score(width, height)

    u_image = _clamp01(weights["blur"] * b + weights["exposure"] * gamma + weights["resolution"] * rho)

    return {
        "width": width,
        "height": height,
        "laplacian_variance": laplacian_var,
        "b_blur": b,
        "gamma_exposure": gamma,
        "rho_resolution": rho,
        "U_image": u_image,
    }


if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Compute U_image for a single image (smoke test).")
    parser.add_argument("image_path")
    args = parser.parse_args()
    print(json.dumps(compute_u_image(args.image_path), indent=2))
