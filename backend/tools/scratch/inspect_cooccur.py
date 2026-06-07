import json
import os
import sys
from collections import Counter

# Ensure UTF-8 output
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

file_path = r"a:\drug-mapping\backend\data\extracted\chefaa_products_eg.json"
with open(file_path, "r", encoding="utf-8") as f:
    products = json.load(f)

ar_count = 0
co = Counter()
en_count = Counter()

for p in products:
    ar = p.get('title_ar', '').lower().replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ة', 'ه').replace('ى', 'ي')
    en = p.get('title_en', '').lower()
    
    # Simple tokenization
    ar_words = ar.split()
    en_words = en.split()
    
    if 'جرعات' in ar_words:
        ar_count += 1
        for w in set(en_words):
            co[w] += 1
            
    for w in set(en_words):
        en_count[w] += 1

print('جرعات count:', ar_count)
print('Top 15 co-occurring English words:')
for w, c in co.most_common(15):
    jac = c / (ar_count + en_count[w] - c)
    print(f'{w}: co-occurrence={c}, total English={en_count[w]}, Jaccard={jac:.4f}')
