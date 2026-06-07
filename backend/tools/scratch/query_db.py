import sqlite3
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('normalizer/mappings/db/mappings.db')
c = conn.cursor()

c.execute("SELECT * FROM tokens WHERE arabic_name = 'انتي'")
print('Tokens for انتي:', c.fetchall())

c.execute("SELECT * FROM brands WHERE arabic_name = 'انتي'")
print('Brands for انتي:', c.fetchall())
