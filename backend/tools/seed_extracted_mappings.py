#!/usr/bin/env python3
"""
Extrapolates brand and token mappings from the 29.8k Chefaa products dataset
and seeds them into the mappings SQLite database.
"""

import json
import os
import sys
import re
from collections import defaultdict

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Fix imports when running from tools/ directory
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer.mappings.manager import MappingDBManager
from normalizer.mappings.static.constants import ARABIC_STOP_WORDS

def clean_arabic_word(word):
    # Keep only Arabic letters
    word = re.sub(r"[^\u0621-\u064A]", "", word)
    # Normalize character variants (أ/إ/آ -> ا, ة -> ه, ى -> ي)
    word = word.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
    return word.strip()

def clean_english_word(word):
    # Keep only English letters/numbers and lowercase
    word = re.sub(r"[^a-zA-Z0-9\-]", "", word)
    return word.strip().lower()

def is_valid_arabic(word):
    return bool(re.match(r"^[\u0621-\u064A]+$", word))

def is_valid_english(word):
    # Reject pure numbers or extremely short words
    return bool(re.match(r"^[a-zA-Z\-]{3,}$", word))

def tokenize(text, ar=False):
    text = text.lower()
    # Normalize Arabic chars
    if ar:
        text = text.replace("أ", "a").replace("إ", "a").replace("آ", "a").replace("ة", "h").replace("ى", "y")
    words = re.findall(r"[\w\u0600-\u06FF]+", text)
    return [w for w in words if w.strip()]

def extract_and_seed():
    db_manager = MappingDBManager()
    
    # 1. Fetch existing mappings to avoid overwriting them
    print("⏳ Fetching existing mappings from database...")
    existing_brands = db_manager.get_brand_map()
    existing_tokens = db_manager.get_token_map()
    
    existing_brands_normalized = {clean_arabic_word(k): v for k, v in existing_brands.items()}
    existing_tokens_normalized = {clean_arabic_word(k): v for k, v in existing_tokens.items()}
    
    print(f"   Existing database: {len(existing_brands)} brands, {len(existing_tokens)} tokens.")

    # Load Chefaa dataset
    json_path = os.path.join(project_root, "data", "extracted", "chefaa_products_eg.json")
    if not os.path.exists(json_path):
        print(f"❌ Error: Dataset not found at {json_path}")
        return

    print(f"📂 Loading product dataset from {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        products = json.load(f)
    print(f"   Loaded {len(products)} products.")

    # -------------------------------------------------------------
    #  A. BRAND EXTRACTION
    # -------------------------------------------------------------
    print("✨ Extracting brands...")
    extracted_brands = {}
    
    # Common units/stop words to ignore during brand extraction
    ignore_words = {
        "قرص", "اقراص", "كبسولة", "كبسولات", "ملجم", "مجم", "جرام", "مل", "لتر", "ثلاجة", "ثلاجه",
        "عبوة", "علبة", "شريط", "حقنة", "حقن", "شراب", "كريم", "مرهم", "جل", "جيل", "بخاخ", "نقط",
        "قطرة", "قطره", "امبول", "امبولات", "تحاميل", "لبوس", "مكمل", "غذائي", "فيتامين", "دواء", "علاج"
    }
    ignore_words_normalized = {clean_arabic_word(w) for w in ignore_words}

    for p in products:
        # 1. Manufacturer brand extraction
        brand_obj = p.get("brands")
        if brand_obj and isinstance(brand_obj, dict):
            ar_brand = brand_obj.get("title_ar")
            en_brand = brand_obj.get("title_en")
            if ar_brand and en_brand:
                ar_clean = clean_arabic_word(ar_brand)
                en_clean = clean_english_word(en_brand)
                if ar_clean and en_clean and is_valid_arabic(ar_clean) and is_valid_english(en_clean):
                    if ar_clean not in ignore_words_normalized:
                        extracted_brands[ar_clean] = en_clean

        # 2. Title prefix brand extraction
        ar_title = p.get("title_ar")
        en_title = p.get("title_en")
        if ar_title and en_title:
            # Split by common delimiters
            ar_parts = [part.strip() for part in re.split(r"[|\-\,]", ar_title) if part.strip()]
            en_parts = [part.strip() for part in re.split(r"[|\-\,]", en_title) if part.strip()]
            
            if ar_parts and en_parts:
                ar_words = ar_parts[0].split()
                en_words = en_parts[0].split()
                if ar_words and en_words:
                    ar_clean = clean_arabic_word(ar_words[0])
                    en_clean = clean_english_word(en_words[0])
                    if ar_clean and en_clean and is_valid_arabic(ar_clean) and is_valid_english(en_clean):
                        if ar_clean not in ignore_words_normalized:
                            extracted_brands[ar_clean] = en_clean

    # Filter out brands already in DB
    new_brands = []
    for ar_b, en_b in extracted_brands.items():
        if ar_b not in existing_brands_normalized:
            # Format: (arabic_name, canonical_name, source)
            new_brands.append((ar_b, en_b, "extracted_brand"))
            
    print(f"   Extracted {len(extracted_brands)} total brand candidates; {len(new_brands)} are new.")

    # -------------------------------------------------------------
    #  B. TOKEN/VOCAB EXTRACTION
    # -------------------------------------------------------------
    print("✨ Extracting token translation vocabulary...")
    
    ar_word_counts = defaultdict(int)
    en_word_counts = defaultdict(int)
    co_occurrences = defaultdict(lambda: defaultdict(int))
    
    stop_words_normalized = {clean_arabic_word(w) for w in ARABIC_STOP_WORDS}
    english_stop_words = {
        "to", "treat", "for", "with", "and", "in", "of", "the", "by", "from", "on", "at", 
        "mg", "ml", "tab", "tabs", "cap", "caps", "tablet", "tablets", "capsule", "capsules",
        "gm", "g", "mcg", "iu", "pack", "pieces", "pcs", "ml", "l", "cream", "gel", "ointment", "drops", "syrup",
        "oral", "suspension", "solution", "injectable", "vials", "vial", "ampoule", "ampoules", "suppository", "suppositories"
    }

    # Document counting for accurate Jaccard
    for p in products:
        ar_title = p.get("title_ar")
        en_title = p.get("title_en")
        if not ar_title or not en_title:
            continue
            
        ar_tokens = set(clean_arabic_word(w) for w in tokenize(ar_title) if w.strip())
        en_tokens = set(clean_english_word(w) for w in tokenize(en_title) if w.strip())
        
        # Filter tokens
        ar_tokens = {w for w in ar_tokens if w and is_valid_arabic(w) and w not in stop_words_normalized and w not in ignore_words_normalized}
        en_tokens = {w for w in en_tokens if w and is_valid_english(w) and w not in english_stop_words}
        
        for ar_w in ar_tokens:
            ar_word_counts[ar_w] += 1
            for en_w in en_tokens:
                co_occurrences[ar_w][en_w] += 1
                
        for en_w in en_tokens:
            en_word_counts[en_w] += 1

    extracted_tokens = {}
    for ar_w, en_dict in co_occurrences.items():
        if ar_word_counts[ar_w] < 5:  # skip rare terms
            continue
            
        best_en = None
        best_jaccard = 0.0
        
        for en_w, co_count in en_dict.items():
            if en_word_counts[en_w] < 5:
                continue
                
            # Jaccard index math
            jaccard = co_count / (ar_word_counts[ar_w] + en_word_counts[en_w] - co_count)
            if jaccard > best_jaccard:
                best_jaccard = jaccard
                best_en = en_w
                
        if best_en and best_jaccard >= 0.40:
            extracted_tokens[ar_w] = best_en

    # Filter out tokens already in DB (or mapped as brands)
    new_tokens = []
    for ar_t, en_t in extracted_tokens.items():
        # Avoid duplication in brands or tokens
        if ar_t not in existing_tokens_normalized and ar_t not in existing_brands_normalized and ar_t not in extracted_brands:
            # Format: (arabic_name, english_name, token_type, source)
            new_tokens.append((ar_t, en_t, "general", "extracted_token"))

    print(f"   Extracted {len(extracted_tokens)} total token candidates; {len(new_tokens)} are new.")

    # -------------------------------------------------------------
    #  C. SEED DATABASE
    # -------------------------------------------------------------
    if new_brands:
        print(f"🚀 Seeding {len(new_brands)} new brand mappings into DB...")
        try:
            db_manager.bulk_insert_brands(new_brands)
            print("   ✅ Brand seeding complete!")
        except Exception as e:
            print(f"   ❌ Error seeding brands: {e}")
            
    if new_tokens:
        print(f"🚀 Seeding {len(new_tokens)} new token mappings into DB...")
        try:
            db_manager.bulk_insert_tokens(new_tokens)
            print("   ✅ Token seeding complete!")
        except Exception as e:
            print(f"   ❌ Error seeding tokens: {e}")

    print("\n🎉 Seeding process completed successfully!")

if __name__ == "__main__":
    extract_and_seed()
