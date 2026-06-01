#!/usr/bin/env python3
"""
Seed Script: Imports brands from brands.json into the matcher's mapping database.
This enables the matcher to translate Arabic brand names to English.
"""

import json
import os
import sys

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Fix imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer.mappings.manager import MappingDBManager

def seed_brands():
    brands_json_path = os.path.join(project_root, "data-extractor", "data", "brands.json")
    
    if not os.path.exists(brands_json_path):
        print(f"❌ Error: {brands_json_path} not found.")
        return

    print(f"📂 Reading brands from {brands_json_path}...")
    with open(brands_json_path, "r", encoding="utf-8") as f:
        try:
            brands_data = json.load(f)
        except Exception as e:
            print(f"❌ Error parsing JSON: {e}")
            return

    db_manager = MappingDBManager()
    
    brand_list = []
    skipped = 0
    
    for item in brands_data:
        arabic = item.get("name_ar")
        english = item.get("name")
        
        # We need both for a mapping to be useful
        if arabic and english and isinstance(arabic, str) and isinstance(english, str):
            # Clean up names (remove extra whitespace)
            arabic = arabic.strip()
            english = english.strip()
            
            if arabic and english:
                # Format for bulk_insert_brands: (arabic, english, source)
                brand_list.append((arabic, english, "brands_json"))
            else:
                skipped += 1
        else:
            skipped += 1

    if not brand_list:
        print("⚠️ No valid brand mappings found to import.")
        return

    print(f"🚀 Inserting {len(brand_list)} brands into the mapping database (skipped {skipped})...")
    
    try:
        db_manager.bulk_insert_brands(brand_list)
        print("✅ Successfully seeded brands!")
    except Exception as e:
        print(f"❌ Error during bulk insert: {e}")

if __name__ == "__main__":
    seed_brands()
