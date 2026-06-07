import sqlite3
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

db_path = r"a:\drug-mapping\backend\normalizer\mappings\db\mappings.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Deletions
deletions = [
    ("DELETE FROM tokens WHERE arabic_name = 'ريد' AND english_name = 'red'", "Deleted ('ريد', 'red') from tokens"),
    ("DELETE FROM tokens WHERE arabic_name = 'لوف' AND english_name = 'love'", "Deleted ('لوف', 'love') from tokens"),
    ("DELETE FROM brands WHERE arabic_name = 'لوف' AND canonical_name = 'moroccan'", "Deleted ('لوف', 'moroccan') from brands"),
    ("DELETE FROM brands WHERE arabic_name = 'انتي' AND canonical_name = 'antiflu'", "Deleted ('انتي', 'antiflu') from brands"),
    ("DELETE FROM brands WHERE arabic_name = 'الس' AND canonical_name = 'ulcfree'", "Deleted ('الس', 'ulcfree') from brands"),
    ("DELETE FROM brands WHERE arabic_name = 'مون' AND canonical_name = 'moonshine'", "Deleted ('مون', 'moonshine') from brands"),
]

print("Applying deletions...")
for sql, desc in deletions:
    cursor.execute(sql)
    print(f"  • {desc} (Rows affected: {cursor.rowcount})")

# 2. Insertions into tokens
tokens_to_insert = [
    ('لوف', 'loofah', 'general', 'manual'),
    ('الس', 'ulc', 'general', 'manual'),
    ('اس بي اف', 'spf', 'general', 'manual'),
    ('اس بف', 'spf', 'general', 'manual'),
    ('ميلز', 'meals', 'general', 'manual'),
]

print("\nInserting tokens...")
for row in tokens_to_insert:
    cursor.execute(
        "INSERT OR REPLACE INTO tokens (arabic_name, english_name, token_type, source) VALUES (?, ?, ?, ?)",
        row
    )
    print(f"  • Inserted/Replaced token: {row[0]} -> {row[1]}")

# 3. Insertions into brands
brands_to_insert = [
    ('انتي فلو', 'antiflu', 'manual'),
    ('انتيفلو', 'antiflu', 'manual'),
    ('سترونج فيل', 'strongville', 'manual'),
    ('الترا فيت', 'ultra feet', 'manual'),
    ('اكس ريلاتو', 'xarelto', 'manual'),
    ('اكسارلتو', 'xarelto', 'manual'),
    ('ايميروزا', 'emmyrosa', 'manual'),
    ('ايمي روزا', 'emmyrosa', 'manual'),
    ('تريتو الس', 'treato ulc', 'manual'),
    ('الس فري', 'ulcfree', 'manual'),
    ('مويست', 'moist', 'manual'),
    ('مون لايت', 'moon light', 'manual'),
    ('مون شاين', 'moonshine', 'manual'),
]

print("\nInserting brands...")
for row in brands_to_insert:
    cursor.execute(
        "INSERT OR REPLACE INTO brands (arabic_name, canonical_name, source) VALUES (?, ?, ?)",
        row
    )
    print(f"  • Inserted/Replaced brand: {row[0]} -> {row[1]}")

conn.commit()
conn.close()
print("\nAll database updates applied successfully.")
