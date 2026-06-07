#!/usr/bin/env python3
"""
Seed Script: Seeds all brands from backend/data/extracted/chefaa_brands_eg.json
into the mapping database so that Arabic brand names are translated to English
during normalization, enabling the token index to match them.

After seeding, re-exports mappings_export.json to keep git state in sync.
"""

import json
import os
import sys

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer.mappings.manager import MappingDBManager

def seed_chefaa_brands():
    brands_path = os.path.join(project_root, "data", "extracted", "chefaa_brands_eg.json")
    export_path = os.path.join(project_root, "normalizer", "mappings", "db", "mappings_export.json")

    if not os.path.exists(brands_path):
        print(f"❌ Error: {brands_path} not found.")
        return

    print(f"📂 Reading brands from {brands_path}...")
    with open(brands_path, "r", encoding="utf-8") as f:
        brands_data = json.load(f)

    db_manager = MappingDBManager()

    brand_list = []
    skipped = 0

    for item in brands_data:
        arabic = (item.get("name_ar") or "").strip()
        english = (item.get("name_en") or "").strip()

        if arabic and english:
            brand_list.append((arabic, english, "chefaa_brands_eg"))
        else:
            skipped += 1

    print(f"   Found {len(brand_list)} valid brand mappings (skipped {skipped} missing Arabic or English).")

    if not brand_list:
        print("⚠️ No valid brand mappings found.")
        return

    print(f"🚀 Inserting {len(brand_list)} brands into the mapping database...")
    db_manager.bulk_insert_brands(brand_list)
    print("✅ Brands seeded into DB!")

    # Re-export mappings_export.json to keep git in sync
    print(f"\n📤 Re-exporting mappings to {export_path}...")
    import sqlite3
    conn = sqlite3.connect(db_manager.db_path)
    cursor = conn.cursor()

    data = {"brands": {}, "tokens": {}, "stop_words": []}

    cursor.execute("SELECT arabic_name, canonical_name FROM brands ORDER BY arabic_name")
    data["brands"] = dict(cursor.fetchall())

    cursor.execute("SELECT arabic_name, english_name FROM tokens ORDER BY arabic_name")
    data["tokens"] = dict(cursor.fetchall())

    cursor.execute("SELECT arabic_word FROM stop_words ORDER BY arabic_word")
    data["stop_words"] = [row[0] for row in cursor.fetchall()]
    conn.close()

    with open(export_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    print(f"✅ Exported {len(data['brands'])} brands, {len(data['tokens'])} tokens, "
          f"{len(data['stop_words'])} stop words to mappings_export.json")

if __name__ == "__main__":
    seed_chefaa_brands()
