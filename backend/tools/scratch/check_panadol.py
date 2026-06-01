import sqlite3
import os
import sys

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

db_path = "normalizer/mappings/db/mappings.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Tokens matching 'بانادول' ---")
cursor.execute("SELECT * FROM tokens WHERE arabic_name LIKE ?", ('%بانادول%',))
for row in cursor.fetchall():
    print(row)

print("\n--- Brands matching 'بانادول' ---")
cursor.execute("SELECT * FROM brands WHERE arabic_name LIKE ?", ('%بانادول%',))
for row in cursor.fetchall():
    print(row)

conn.close()
