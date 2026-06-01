import os
import sys
import sqlite3

# Fix imports to access normalizer
project_root = r'c:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend'
if project_root not in sys.path:
    sys.path.append(project_root)

# Ensure UTF-8 output
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from normalizer.mappings.manager import MappingDBManager
from normalizer.mappings.archive.tokens import ARABIC_TO_ENGLISH

def seed_database():
    print("Starting database seeding...")
    manager = MappingDBManager()
    
    token_list = []
    for arabic, english in ARABIC_TO_ENGLISH.items():
        token_list.append((arabic, english, 'general', 'archive_seed'))
    
    print(f"Prepared {len(token_list)} tokens from archive.")
    manager.bulk_insert_tokens(token_list)
    print(f"Seeding complete! {len(token_list)} tokens added.")

if __name__ == "__main__":
    seed_database()
