#!/usr/bin/env python3
"""
Inject code + international_barcode from sheet coverage matches into the
normalized standard catalog used by the matcher and API.

Source mapping file (default):
  data/normalized/sheet_coverage_matched.xlsx
    source_id              → catalog product id
    dest_code              → code
    dest_international_barcode → international_barcode

Target (updated in place, with .bak backup):
  data/normalized/chefaa_products_eg_normalized.json

Run:
  cd backend
  python tools/inject_catalog_codes.py
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)

DEFAULT_CATALOG = os.path.join(project_root, "data", "normalized", "chefaa_products_eg_normalized.json")
DEFAULT_MATCHED = os.path.join(project_root, "data", "normalized", "sheet_coverage_matched.xlsx")


def fmt_cell(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    if text.endswith(".0"):
        try:
            return str(int(float(text)))
        except ValueError:
            pass
    return text


def load_code_lookup(matched_path: str) -> dict[str, dict[str, str]]:
    df = pd.read_excel(matched_path)
    required = {"source_id", "dest_code", "dest_international_barcode"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns in {matched_path}: {sorted(missing)}")

    lookup: dict[str, dict[str, str]] = {}
    for _, row in df.iterrows():
        source_id = fmt_cell(row["source_id"])
        if not source_id:
            continue
        lookup[source_id] = {
            "code": fmt_cell(row["dest_code"]),
            "international_barcode": fmt_cell(row["dest_international_barcode"]),
        }
    return lookup


def inject_codes(
    catalog_path: str,
    matched_path: str,
    dry_run: bool = False,
) -> dict[str, int]:
    if not os.path.exists(catalog_path):
        raise FileNotFoundError(catalog_path)
    if not os.path.exists(matched_path):
        raise FileNotFoundError(matched_path)

    lookup = load_code_lookup(matched_path)
    print(f"Loaded {len(lookup):,} code mappings from {matched_path}")

    print(f"Loading catalog from {catalog_path}...")
    with open(catalog_path, "r", encoding="utf-8") as f:
        products = json.load(f)
    if not isinstance(products, list):
        raise ValueError("Catalog must be a JSON array")

    stats = {
        "total_products": len(products),
        "updated": 0,
        "already_set": 0,
        "not_in_lookup": 0,
    }

    for product in products:
        if not isinstance(product, dict):
            continue
        pid = fmt_cell(product.get("id"))
        mapping = lookup.get(pid)
        if not mapping:
            stats["not_in_lookup"] += 1
            continue

        new_code = mapping["code"]
        new_barcode = mapping["international_barcode"]
        old_code = fmt_cell(product.get("code"))
        old_barcode = fmt_cell(product.get("international_barcode"))

        if old_code == new_code and old_barcode == new_barcode and "code" in product:
            stats["already_set"] += 1
            continue

        product["code"] = new_code
        product["international_barcode"] = new_barcode
        stats["updated"] += 1

    if dry_run:
        print("[dry-run] No files written.")
        return stats

    backup_path = catalog_path + ".bak"
    print(f"Backing up catalog to {backup_path}")
    shutil.copy2(catalog_path, backup_path)

    print(f"Writing updated catalog ({len(products):,} products)...")
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Inject code/barcode into normalized catalog")
    parser.add_argument("--catalog", default=DEFAULT_CATALOG)
    parser.add_argument("--matched", default=DEFAULT_MATCHED)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    stats = inject_codes(args.catalog, args.matched, dry_run=args.dry_run)

    print("\nDone.")
    print(f"  Total catalog products : {stats['total_products']:,}")
    print(f"  Updated with codes     : {stats['updated']:,}")
    print(f"  Already up to date     : {stats['already_set']:,}")
    print(f"  Not in matched sheet   : {stats['not_in_lookup']:,}")
    if not args.dry_run:
        print("\nRestart the API for changes to take effect.")


if __name__ == "__main__":
    main()
