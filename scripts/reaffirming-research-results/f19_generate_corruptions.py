"""
ESWA-F19: generates real corrupted copies of real MVTec images (standard,
ImageNet-C-style corruptions: Gaussian blur, Gaussian noise, brightness
shift, JPEG compression, each at 3 severities) from an existing real
manifest.json, and writes a new manifest pointing at the corrupted files
with ground truth carried over unchanged (corruption does not change
whether/what defect is present). Run run_pipeline.py against the resulting
manifest to get a genuine, real robustness measurement -- this script only
prepares the images; it does not call any VLM itself.

- gaussian_blur(img, sigma) -> np.ndarray
- gaussian_noise(img, std) -> np.ndarray
- brightness_shift(img, factor) -> np.ndarray
- jpeg_compress(img, quality) -> np.ndarray
- generate_corrupted_manifest(manifest, out_dir, corruptions) -> list[dict]: new manifest with corrupted image_paths.
"""

import argparse
import json
import os

import cv2
import numpy as np
from PIL import Image

SEVERITIES = [1, 2, 3]  # 1=mild, 3=severe

CORRUPTION_PARAMS = {
    "gaussian_blur": {1: 1.0, 2: 2.5, 3: 5.0},        # sigma
    "gaussian_noise": {1: 8.0, 2: 20.0, 3: 40.0},      # std, 0-255 scale
    "brightness_shift": {1: 0.85, 2: 0.65, 3: 0.45},   # multiplicative factor (darker)
    "jpeg_compress": {1: 60, 2: 30, 3: 10},            # JPEG quality (lower = worse)
}


def gaussian_blur(img: np.ndarray, sigma: float) -> np.ndarray:
    ksize = max(3, int(sigma * 4) | 1)  # odd kernel size scaled to sigma
    return cv2.GaussianBlur(img, (ksize, ksize), sigma)


def gaussian_noise(img: np.ndarray, std: float) -> np.ndarray:
    noise = np.random.default_rng(0).normal(0, std, img.shape)
    return np.clip(img.astype(np.float64) + noise, 0, 255).astype(np.uint8)


def brightness_shift(img: np.ndarray, factor: float) -> np.ndarray:
    return np.clip(img.astype(np.float64) * factor, 0, 255).astype(np.uint8)


def jpeg_compress(img: np.ndarray, quality: int) -> np.ndarray:
    success, encoded = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not success:
        return img
    return cv2.imdecode(encoded, cv2.IMREAD_COLOR)


CORRUPTION_FNS = {
    "gaussian_blur": gaussian_blur,
    "gaussian_noise": gaussian_noise,
    "brightness_shift": brightness_shift,
    "jpeg_compress": jpeg_compress,
}


def generate_corrupted_manifest(manifest, out_dir: str, corruptions=None):
    corruptions = corruptions or list(CORRUPTION_FNS.keys())
    os.makedirs(out_dir, exist_ok=True)

    new_manifest = []
    for sample in manifest:
        img_bgr = cv2.imread(sample["image_path"])
        if img_bgr is None:
            continue

        for corruption_name in corruptions:
            fn = CORRUPTION_FNS[corruption_name]
            for severity in SEVERITIES:
                param = CORRUPTION_PARAMS[corruption_name][severity]
                corrupted = fn(img_bgr, param)

                out_name = f"{sample['sample_id']}_{corruption_name}_sev{severity}.png"
                out_path = os.path.join(out_dir, out_name)
                cv2.imwrite(out_path, corrupted)

                new_record = dict(sample)
                new_record["sample_id"] = f"{sample['sample_id']}_{corruption_name}_sev{severity}"
                new_record["image_path"] = out_path
                new_record["corruption_type"] = corruption_name
                new_record["corruption_severity"] = severity
                new_record["source_sample_id"] = sample["sample_id"]
                new_manifest.append(new_record)

    return new_manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="manifest.json")
    parser.add_argument("--out-dir", default="corrupted_images")
    parser.add_argument("--out-manifest", default="manifest_corrupted.json")
    parser.add_argument("--corruptions", nargs="*", default=None,
                         choices=list(CORRUPTION_FNS.keys()), help="Subset of corruption types (default: all)")
    parser.add_argument("--max-samples", type=int, default=None,
                         help="Cap source samples before corrupting (cost control -- corruption multiplies image count)")
    args = parser.parse_args()

    with open(args.manifest) as f:
        manifest = json.load(f)
    if args.max_samples:
        manifest = manifest[: args.max_samples]

    new_manifest = generate_corrupted_manifest(manifest, args.out_dir, args.corruptions)

    with open(args.out_manifest, "w") as f:
        json.dump(new_manifest, f, indent=2)

    n_types = len(args.corruptions or CORRUPTION_FNS)
    print(f"Generated {len(new_manifest)} corrupted images from {len(manifest)} source images "
          f"({n_types} corruption types x {len(SEVERITIES)} severities).")
    print(f"Wrote {args.out_manifest}")
    print(
        f"\nCOST WARNING: running run_pipeline.py against this manifest makes "
        f"{len(new_manifest)} real Gemini calls (one per corrupted image, more if "
        f"repeat-sampling triggers) -- {n_types * len(SEVERITIES)}x your original per-image "
        f"cost. Use --max-samples above and/or --corruptions to control scope, and consider "
        f"--max-samples on run_pipeline.py too while testing."
    )
