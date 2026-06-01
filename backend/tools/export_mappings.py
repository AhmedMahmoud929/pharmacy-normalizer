import json
import sqlite3
import os

def export():
    db_path = "normalizer/mappings/db/mappings.db"
    export_path = "normalizer/mappings/db/mappings_export.json"
    
    if not os.path.exists(db_path):
        print("Database not found!")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    data = {
        "brands": {},
        "tokens": {},
        "stop_words": []
    }
    
    # Export Brands
    cursor.execute("SELECT arabic_name, canonical_name FROM brands ORDER BY arabic_name")
    data["brands"] = dict(cursor.fetchall())
    
    # Export Tokens
    cursor.execute("SELECT arabic_name, english_name FROM tokens ORDER BY arabic_name")
    data["tokens"] = dict(cursor.fetchall())
    
    # Export Stop Words
    cursor.execute("SELECT arabic_word FROM stop_words ORDER BY arabic_word")
    data["stop_words"] = [row[0] for row in cursor.fetchall()]
    
    with open(export_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    
    print(f"Exported {len(data['brands'])} brands, {len(data['tokens'])} tokens, and {len(data['stop_words'])} stop words to {export_path}")
    conn.close()

if __name__ == "__main__":
    export()
