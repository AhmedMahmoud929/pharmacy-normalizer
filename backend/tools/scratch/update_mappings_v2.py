import sqlite3
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

db_path = r"a:\drug-mapping\backend\normalizer\mappings\db\mappings.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Move the multi-word brands to tokens table and delete them from brands table
brands_to_delete = [
    'انتي فلو', 'انتيفلو', 'سترونج فيل', 'الترا فيت', 'اكس ريلاتو', 'اكسارلتو', 
    'ايميروزا', 'ايمي روزا', 'تريتو الس', 'الس فري', 'مويست', 'مون لايت', 'مون شاين'
]

print("Deleting from brands...")
for brand in brands_to_delete:
    cursor.execute("DELETE FROM brands WHERE arabic_name = ?", (brand,))
    print(f"  • Deleted brand: {brand} (Rows affected: {cursor.rowcount})")

tokens_to_insert = [
    ('انتي فلو', 'antiflu', 'general', 'manual'),
    ('انتيفلو', 'antiflu', 'general', 'manual'),
    ('سترونج فيل', 'strongville', 'general', 'manual'),
    ('الترا فيت', 'ultra feet', 'general', 'manual'),
    ('اكس ريلاتو', 'xarelto', 'general', 'manual'),
    ('اكسارلتو', 'xarelto', 'general', 'manual'),
    ('ايميروزا', 'emmyrosa', 'general', 'manual'),
    ('ايمي روزا', 'emmyrosa', 'general', 'manual'),
    ('تريتو الس', 'treato ulc', 'general', 'manual'),
    ('الس فري', 'ulcfree', 'general', 'manual'),
    ('مويست', 'moist', 'general', 'manual'),
    ('مون لايت', 'moon light', 'general', 'manual'),
    ('مون شاين', 'moonshine', 'general', 'manual'),
    ('انتي', 'anti', 'general', 'manual'),
]

print("\nInserting/Replacing in tokens...")
for row in tokens_to_insert:
    cursor.execute(
        "INSERT OR REPLACE INTO tokens (arabic_name, english_name, token_type, source) VALUES (?, ?, ?, ?)",
        row
    )
    print(f"  • Inserted token: {row[0]} -> {row[1]}")

conn.commit()
conn.close()
print("\nAll database updates applied successfully.")
