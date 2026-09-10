"""
Walks one or more MVTec-AD-style category folders (train/good, test/good,
test/<defect_type>, ground_truth/<defect_type>) and builds a flat manifest of
real samples with real ground truth. No labels or images are invented here --
everything comes from the folder structure MVTec ships.

- discover_categories(dataset_root) -> list[str]: finds category subfolders
  that contain the expected train/test/ground_truth layout.
- build_manifest(dataset_root, categories, include_train=False) -> list[dict]:
  returns one record per image with category, split, defect_type, is_defect,
  image_path, mask_path (if applicable).
- save_manifest(manifest, out_path) -> None: writes the manifest as JSON.
"""

import json
import os
from pathlib import Path


def discover_categories(dataset_root: str):
    root = Path(dataset_root)
    categories = []
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        if (child / "test").is_dir() and (child / "ground_truth").is_dir():
            categories.append(child.name)
    return categories


def _mask_path_for(ground_truth_dir: Path, defect_type: str, stem: str):
    # MVTec convention: <stem>_mask.png under ground_truth/<defect_type>/
    candidate = ground_truth_dir / defect_type / f"{stem}_mask.png"
    return str(candidate) if candidate.exists() else None


def build_manifest(dataset_root: str, categories=None, include_train: bool = False):
    root = Path(dataset_root)
    if categories is None:
        categories = discover_categories(dataset_root)
    if not categories:
        raise ValueError(
            f"No MVTec-style categories found under {dataset_root}. Expected "
            f"subfolders each containing test/ and ground_truth/ directories."
        )

    manifest = []
    sample_idx = 0

    for category in categories:
        cat_dir = root / category
        test_dir = cat_dir / "test"
        gt_dir = cat_dir / "ground_truth"
        train_dir = cat_dir / "train"

        if not test_dir.is_dir():
            raise ValueError(f"Category '{category}' has no test/ directory under {cat_dir}")

        # test/good -> non-defective real images
        good_dir = test_dir / "good"
        if good_dir.is_dir():
            for img_path in sorted(good_dir.glob("*.png")):
                manifest.append({
                    "sample_id": f"{category}_test_good_{sample_idx:05d}",
                    "category": category,
                    "split": "test",
                    "defect_type": "good",
                    "is_defect": False,
                    "image_path": str(img_path),
                    "mask_path": None,
                })
                sample_idx += 1

        # test/<defect_type> for defect_type != good -> real defective images
        for defect_dir in sorted(test_dir.iterdir()):
            if not defect_dir.is_dir() or defect_dir.name == "good":
                continue
            defect_type = defect_dir.name
            for img_path in sorted(defect_dir.glob("*.png")):
                stem = img_path.stem
                manifest.append({
                    "sample_id": f"{category}_test_{defect_type}_{sample_idx:05d}",
                    "category": category,
                    "split": "test",
                    "defect_type": defect_type,
                    "is_defect": True,
                    "image_path": str(img_path),
                    "mask_path": _mask_path_for(gt_dir, defect_type, stem),
                })
                sample_idx += 1

        if include_train and train_dir.is_dir():
            train_good = train_dir / "good"
            if train_good.is_dir():
                for img_path in sorted(train_good.glob("*.png")):
                    manifest.append({
                        "sample_id": f"{category}_train_good_{sample_idx:05d}",
                        "category": category,
                        "split": "train",
                        "defect_type": "good",
                        "is_defect": False,
                        "image_path": str(img_path),
                        "mask_path": None,
                    })
                    sample_idx += 1

    return manifest


def save_manifest(manifest, out_path: str):
    with open(out_path, "w") as f:
        json.dump(manifest, f, indent=2)


def summarize_manifest(manifest):
    from collections import Counter
    by_category = Counter(m["category"] for m in manifest)
    by_class = Counter((m["category"], m["defect_type"]) for m in manifest)
    n_defect = sum(1 for m in manifest if m["is_defect"])
    print(f"Total samples: {len(manifest)}")
    print(f"Defective: {n_defect}  Non-defective: {len(manifest) - n_defect}")
    print(f"Categories: {dict(by_category)}")
    print("Classes (category, defect_type) -> count:")
    for k, v in sorted(by_class.items()):
        print(f"  {k}: {v}")
    n_distinct_classes = len(set(m["defect_type"] for m in manifest if m["is_defect"]))
    print(f"\nDistinct real defect-type classes (excluding 'good'): {n_distinct_classes}")
    if n_distinct_classes < 10:
        print(
            "NOTE: the manuscript's F12 item refers to '10 defect classes' from its "
            "original synthetic benchmark taxonomy. You have fewer than 10 distinct "
            "real defect classes here -- add more MVTec categories to dataset_root "
            "if you want a comparable class count, or report class-wise diagnostics "
            "honestly at whatever real class count you have (this is still a "
            "legitimate real-data analysis, just at smaller class breadth)."
        )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build a manifest from MVTec-AD-style folders.")
    parser.add_argument("dataset_root", help="Path to folder containing one or more MVTec category folders")
    parser.add_argument("--categories", nargs="*", default=None, help="Subset of categories to include")
    parser.add_argument("--include-train", action="store_true")
    parser.add_argument("--out", default="manifest.json")
    args = parser.parse_args()

    manifest = build_manifest(args.dataset_root, args.categories, args.include_train)
    summarize_manifest(manifest)
    save_manifest(manifest, args.out)
    print(f"\nWrote manifest: {args.out}")
