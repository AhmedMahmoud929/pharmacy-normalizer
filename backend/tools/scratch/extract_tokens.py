import json
import os
import sys
import re
from collections import defaultdict

# Fix imports when running from tools/scratch directory
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.append(project_root)

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
    return bool(re.match(r"^[a-zA-Z]+$", word)) if word else False

def tokenize(text, ar=False):
    text = text.lower()
    # Normalize some chars
    if ar:
        text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
    # Split and clean
    words = re.findall(r"[\w\u0600-\u06FF]+", text)
    return [w for w in words if w.strip()]

# Count co-occurrences of Arabic and English words in parallel titles
ar_word_counts = defaultdict(int)
en_word_counts = defaultdict(int)
co_occurrences = defaultdict(lambda: defaultdict(int))

# Also load existing stop words to exclude noise
from normalizer.mappings.static.constants import ARABIC_STOP_WORDS

stop_words_normalized = {
    w.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي") 
    for w in ARABIC_STOP_WORDS
}

# Add standard English stop words
english_stop_words = {
    "to", "treat", "for", "with", "and", "in", "of", "the", "by", "from", "on", "at", 
    "mg", "ml", "tab", "tabs", "cap", "caps", "tablet", "tablets", "capsule", "capsules",
    "gm", "g", "mcg", "iu", "pack", "pieces", "pcs", "ml", "l", "cream", "gel", "ointment", "drops", "syrup"
}

for p in products:
    ar_title = p.get("title_ar")
    en_title = p.get("title_en")
    if not ar_title or not en_title:
        continue
        
    ar_tokens = [w for w in tokenize(ar_title, ar=True) if is_arabic(w) and w not in stop_words_normalized]
    en_tokens = [w for w in tokenize(en_title, ar=False) if is_english(w) and w not in english_stop_words]
    
    # Update counts
    for ar_w in ar_tokens:
        ar_word_counts[ar_w] += 1
        for en_w in en_tokens:
            co_occurrences[ar_w][en_w] += 1
            
    for en_w in en_tokens:
        en_word_counts[en_w] += 1

# Calculate association scores (e.g. Phi coefficient, or Jaccard, or simple conditional probability)
# We will use Jaccard similarity: co_occur[ar][en] / (count[ar] + count[en] - co_occur[ar][en])
extracted_vocab = []
for ar_w, en_dict in co_occurrences.items():
    if ar_word_counts[ar_w] < 5:  # skip rare words
        continue
    best_en = None
    best_score = 0.0
    for en_w, co_count in en_dict.items():
        if en_word_counts[en_w] < 5:
            continue
        jaccard = co_count / (ar_word_counts[ar_w] + en_word_counts[en_w] - co_count)
        if jaccard > best_score:
            best_score = jaccard
            best_en = en_w
            
    if best_en and best_score > 0.4:  # high threshold for translation confidence
        extracted_vocab.append((ar_w, best_en, best_score, ar_word_counts[ar_w]))

# Sort by count/score
extracted_vocab.sort(key=lambda x: x[2], reverse=True)

print(f"Extracted {len(extracted_vocab)} high-confidence token mappings!")
print("\n--- SAMPLE EXTRACTED TOKENS (Top 50 by Jaccard score) ---")
for ar_w, en_w, score, count in extracted_vocab[:50]:
    print(f"{ar_w} -> {en_w} (Jaccard: {score:.2f}, Count: {count})")
