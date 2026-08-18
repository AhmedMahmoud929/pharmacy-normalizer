#!/usr/bin/env python3
"""
One-time migration: import legacy JSON catalog + mappings into pharmatcher.db.

Usage:
  python tools/migrate_to_sqlite.py
  python tools/migrate_to_sqlite.py --json path/to/products.json
  python tools/migrate_to_sqlite.py --import-mappings
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from db import catalog_repo, mappings_repo
from db.config import DEFAULT_DB_PATH
from db.schema import init_schema
from normalizer import normalize


def import_catalog_json(json_path: str, *, promote: bool = True) -> int:
    print(f"📂 Reading catalog from {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        products = json.load(f)
    if not isinstance(products, list):
        raise ValueError("Catalog JSON must be an array of products.")

    print(f"   Found {len(products)} products. Importing to staging...")
    catalog_repo.import_products_to_staging(products, clear_first=True)

    print("   Normalizing staging catalog...")
    count = catalog_repo.normalize_staging_batch(normalize)
    print(f"   Normalized {count} products.")

    if promote:
        print("   Promoting staging → live...")
        live_count = catalog_repo.promote_staging_to_live()
        catalog_repo.set_meta("last_promoted_at", __import__("datetime").datetime.now().isoformat())
        print(f"✅ Live catalog now has {live_count} products.")
        return live_count
    return count


def import_legacy_mappings() -> None:
    legacy_db = os.path.join(project_root, "normalizer", "mappings", "db", "mappings.db")
    export_json = os.path.join(project_root, "normalizer", "mappings", "db", "mappings_export.json")

    if os.path.exists(legacy_db):
        import sqlite3

        print(f"📂 Copying mappings from {legacy_db}...")
        with sqlite3.connect(legacy_db) as src:
            brands = src.execute("SELECT arabic_name, canonical_name, source FROM brands").fetchall()
            tokens = src.execute("SELECT arabic_name, english_name, token_type, source FROM tokens").fetchall()
            stops = src.execute("SELECT arabic_word, source FROM stop_words").fetchall()
        if brands:
            mappings_repo.bulk_insert_brands(brands)
        if tokens:
            mappings_repo.bulk_insert_tokens(tokens)
        if stops:
            mappings_repo.bulk_insert_stop_words(stops)
        print(f"✅ Imported {len(brands)} brands, {len(tokens)} tokens, {len(stops)} stop words.")
        return

    if os.path.exists(export_json):
        print(f"📂 Importing mappings from {export_json}...")
        with open(export_json, "r", encoding="utf-8") as f:
            data = json.load(f)
        brands = [(k, v, "mappings_export") for k, v in data.get("brands", {}).items()]
        tokens = [(k, v, "general", "mappings_export") for k, v in data.get("tokens", {}).items()]
        stops = [(w, "mappings_export") for w in data.get("stop_words", [])]
        if brands:
            mappings_repo.bulk_insert_brands(brands)
        if tokens:
            mappings_repo.bulk_insert_tokens(tokens)
        if stops:
            mappings_repo.bulk_insert_stop_words(stops)
        print(f"✅ Imported {len(brands)} brands, {len(tokens)} tokens, {len(stops)} stop words.")
        return

    print("⚠️ No legacy mappings found to import.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate legacy JSON/mappings into pharmatcher.db")
    parser.add_argument("--json", help="Path to catalog JSON (default: normalized then raw legacy paths)")
    parser.add_argument("--import-mappings", action="store_true", help="Also import mappings.db or mappings_export.json")
    parser.add_argument("--no-promote", action="store_true", help="Import to staging only, do not promote to live")
    args = parser.parse_args()

    init_schema()
    print(f"🗄️  Target database: {DEFAULT_DB_PATH}")

    json_path = args.json
    if not json_path:
        print("❌ Pass --json with the path to a catalog JSON export to import.")
        sys.exit(1)
    if not os.path.exists(json_path):
        print(f"❌ Catalog JSON not found: {json_path}")
        sys.exit(1)

    import_catalog_json(json_path, promote=not args.no_promote)

    if args.import_mappings:
        import_legacy_mappings()

    stats = catalog_repo.get_catalog_stats()
    print(f"\n📊 Catalog stats: {stats}")


if __name__ == "__main__":
    main()
