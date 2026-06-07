#!/usr/bin/env python3
"""
Import Script: Imports brand, token, and stop word mappings from 
normalizer/mappings/db/mappings_export.json back into the SQLite database.
This ensures the VPS database aligns with version-controlled changes.
"""

import json
import os
import sys
import sqlite3

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Fix imports when running from tools/ directory or project root
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer.mappings.manager import MappingDBManager
from normalizer.mappings.static.categories import UNIT_TOKENS, FORM_TOKENS

def import_mappings():
    db_manager = MappingDBManager()
    db_path = db_manager.db_path
    
    # Resolve the path to mappings_export.json relative to the DB folder
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # The export file is next to the db in normalizer/mappings/db/
    export_json_path = os.path.join(project_root, "normalizer", "mappings", "db", "mappings_export.json")
    
    if not os.path.exists(export_json_path):
        # Fallback check relative to current working directory
        export_json_path = os.path.join("normalizer", "mappings", "db", "mappings_export.json")
        if not os.path.exists(export_json_path):
            print(f"❌ Error: Export file not found at: {export_json_path}")
            return

    print(f"📂 Reading mappings from {export_json_path}...")
    with open(export_json_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception as e:
            print(f"❌ Error parsing JSON: {e}")
            return

    brands_dict = data.get("brands", {})
    tokens_dict = data.get("tokens", {})
    stop_words_list = data.get("stop_words", [])

    print(f"   Found {len(brands_dict)} brands, {len(tokens_dict)} tokens, and {len(stop_words_list)} stop words in export file.")

    print(f"⏳ Syncing data to database at {db_path}...")
    
    try:
        # Use a single connection and transaction to clear and rebuild the database tables
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 1. Clear existing records to remove deleted/stale mappings
            cursor.execute("DELETE FROM brands")
            cursor.execute("DELETE FROM tokens")
            cursor.execute("DELETE FROM stop_words")
            
            # 2. Insert Brands
            # Format: (arabic_name, canonical_name, source)
            brand_list = [(ar, en, "git_import") for ar, en in brands_dict.items()]
            cursor.executemany(
                "INSERT OR REPLACE INTO brands (arabic_name, canonical_name, source) VALUES (?, ?, ?)",
                brand_list
            )
            
            # 3. Insert Tokens
            # Format: (arabic_name, english_name, token_type, source)
            token_list = []
            for ar, en in tokens_dict.items():
                token_type = 'general'
                if en in UNIT_TOKENS:
                    token_type = 'unit'
                elif en in FORM_TOKENS:
                    token_type = 'form'
                token_list.append((ar, en, token_type, "git_import"))
                
            cursor.executemany(
                "INSERT OR REPLACE INTO tokens (arabic_name, english_name, token_type, source) VALUES (?, ?, ?, ?)",
                token_list
            )
            
            # 4. Insert Stop Words
            # Format: (arabic_word, source)
            stop_word_list = [(word, "git_import") for word in stop_words_list]
            cursor.executemany(
                "INSERT OR REPLACE INTO stop_words (arabic_word, source) VALUES (?, ?)",
                stop_word_list
            )
            
            conn.commit()
            
        print("✅ Database tables successfully repopulated and synced with JSON export!")
        
        # Verify counts in the DB
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            b_count = cursor.execute("SELECT COUNT(*) FROM brands").fetchone()[0]
            t_count = cursor.execute("SELECT COUNT(*) FROM tokens").fetchone()[0]
            s_count = cursor.execute("SELECT COUNT(*) FROM stop_words").fetchone()[0]
            
            print(f"\n📊 Synced DB Counts:")
            print(f"  • Brands: {b_count}")
            print(f"  • Tokens: {t_count}")
            print(f"  • Stop Words: {s_count}")
            
    except Exception as e:
        print(f"❌ Error during database transaction: {e}")

if __name__ == "__main__":
    import_mappings()
