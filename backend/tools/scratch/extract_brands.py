import json
import os
import sys
import re

# Ensure UTF-8 output
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

file_path = r"a:\drug-mapping\backend\data\extracted\chefaa_products_eg.json"

if not os.path.exists(file_path):
    print("File not found")
    exit()

with open(file_path, "r", encoding="utf-8") as f:
    products = json.load(f)

def is_arabic(word):
    return bool(re.search(r"[\u0600-\u06FF]", word)) if word else False

def is_english(word):
    return bool(re.match(r"^[a-zA-Z0-9\-]+$", word)) if word else False

def clean_word(word):
    return re.sub(r"[^\w\s\u0600-\u06FF]", "", word).strip()

brand_map = {}
for p in products:
    ar_title = p.get("title_ar")
    en_title = p.get("title_en")
    if not ar_title or not en_title:
        continue
    
    # Split by common separators like |, -
    ar_parts = [part.strip() for part in re.split(r"[|\-\,]", ar_title) if part.strip()]
    en_parts = [part.strip() for part in re.split(r"[|\-\,]", en_title) if part.strip()]
    
    if not ar_parts or not en_parts:
        continue
        
    ar_first = ar_parts[0].split()
    en_first = en_parts[0].split()
    
    if not ar_first or not en_first:
        continue
        
    ar_word = clean_word(ar_first[0])
    en_word = clean_word(en_first[0]).lower()
    
    if is_arabic(ar_word) and is_english(en_word) and len(en_word) > 2:
        if ar_word not in brand_map:
            brand_map[ar_word] = set()
        brand_map[ar_word].add(en_word)

# Clean map: if an Arabic word maps to multiple English words, choose the most frequent or first
final_brand_map = {}
for ar, ens in brand_map.items():
    # To keep it simple, just take the first one or we can count frequencies
    final_brand_map[ar] = list(ens)[0]

print(f"Extracted {len(final_brand_map)} brand mappings!")
print("\n--- SAMPLE EXTRACTED BRANDS ---")
sample_keys = list(final_brand_map.keys())[:50]
for k in sample_keys:
    print(f"{k} -> {final_brand_map[k]}")
