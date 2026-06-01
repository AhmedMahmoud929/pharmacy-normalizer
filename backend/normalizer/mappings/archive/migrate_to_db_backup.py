import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from normalizer.mappings.brands import BRAND_MAP
from normalizer.mappings.tokens import ARABIC_TO_ENGLISH, UNIT_TOKENS, FORM_TOKENS
from normalizer.mappings.constants import ARABIC_STOP_WORDS
from normalizer.mappings.db_manager import MappingDBManager

def migrate():
    db = MappingDBManager()
    
    print(f"Starting migration to {db.db_path}...")

    # 1. Migrate Brands
    brand_data = [(k, v, 'manual') for k, v in BRAND_MAP.items()]
    db.bulk_insert_brands(brand_data)
    print(f"Migrated {len(brand_data)} brands.")

    # 2. Migrate Tokens
    token_data = []
    
    # Process General and Specific Tokens
    # Note: We need to categorize them. For now, we'll check if they exist in UNIT_TOKENS or FORM_TOKENS
    for k, v in ARABIC_TO_ENGLISH.items():
        token_type = 'general'
        if v in UNIT_TOKENS:
            token_type = 'unit'
        elif v in FORM_TOKENS:
            token_type = 'form'
        
        token_data.append((k, v, token_type, 'manual'))
        
    db.bulk_insert_tokens(token_data)
    print(f"Migrated {len(token_data)} tokens.")

    # 3. Migrate Stop Words
    stop_word_data = [(word, 'manual') for word in ARABIC_STOP_WORDS]
    db.bulk_insert_stop_words(stop_word_data)
    print(f"Migrated {len(stop_word_data)} stop words.")

    print("Migration complete!")

    # Basic Validation
    with db._get_connection() as conn:
        b_count = conn.execute("SELECT COUNT(*) FROM brands").fetchone()[0]
        t_count = conn.execute("SELECT COUNT(*) FROM tokens").fetchone()[0]
        s_count = conn.execute("SELECT COUNT(*) FROM stop_words").fetchone()[0]
        
        print("\nVerification:")
        print(f"Brands in Python: {len(BRAND_MAP)} | Brands in DB: {b_count}")
        print(f"Tokens in Python: {len(ARABIC_TO_ENGLISH)} | Tokens in DB: {t_count}")
        print(f"Stop words in Python: {len(ARABIC_STOP_WORDS)} | Stop words in DB: {s_count}")

if __name__ == "__main__":
    migrate()
