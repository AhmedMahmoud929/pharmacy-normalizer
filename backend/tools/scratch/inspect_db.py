import sqlite3
import os
import sys

# Ensure UTF-8
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

db_path = r'c:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\normalizer\mappings\db\mappings.db'

if not os.path.exists(db_path):
    print("DB not found")
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- TOKENS (TOP 50) ---")
cursor.execute("SELECT arabic_name, english_name FROM tokens LIMIT 50")
for row in cursor.fetchall():
    print(f"{row[0]} -> {row[1]}")

print("\n--- BRANDS (TOP 50) ---")
cursor.execute("SELECT arabic_name, canonical_name FROM brands LIMIT 50")
for row in cursor.fetchall():
    print(f"{row[0]} -> {row[1]}")

conn.close()
