import json
import re
import sys
from collections import Counter

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

export_path = r"a:\drug-mapping\drug_matcher_export_2026-06-07T04-55-38.json"

with open(export_path, "r", encoding="utf-8") as f:
    data = json.load(f)

total = len(data)
statuses = Counter(r.get("match_status") for r in data)

print(f"==================================================")
print(f"ANALYSIS REPORT FOR drug_matcher_export")
print(f"==================================================")
print(f"Total Rows Analyzed: {total}")
print(f"Status Breakdown:")
for stat, count in statuses.items():
    print(f"  - {stat}: {count} ({count/total*100:.1f}%)")
print(f"==================================================")

issues = {
    "num_mismatch_matched": [], # Matched but explicit number mismatch (e.g. diaper size, strength, pack size)
    "num_mismatch_review": [],  # Review but explicit number mismatch
    "short_word_noise": [],     # Matches where 1-2 char prefix matches occurred (like box matching b)
    "good_matches": [],         # High score (>80%) matched
    "legit_reviews": [],        # Scores 40-60% that are actually the same product but with minor spelling diffs
    "no_matches_check": []      # Checking if there are any no-matches that should have matched
}

def extract_numbers(text):
    # Extracts all integers and floats
    return set(re.findall(r'\b\d+(?:\.\d+)?\b', text.lower()))

for r in data:
    status = r.get("match_status")
    score_str = r.get("match_score", "0%") or "0%"
    score = float(score_str.replace("%", ""))
    
    q_orig = r.get("original_name", "")
    q_norm = r.get("normalized_name", "")
    db_name = r.get("arabic_name", "") or r.get("brand", "")
    matched_toks = [t.strip() for t in r.get("matched_tokens", "").split(",") if t.strip()]
    
    # Check for number mismatch
    q_nums = extract_numbers(q_norm)
    db_nums = extract_numbers(db_name) # Numbers in the database Arabic name (like 120, 10, 60)
    
    has_num_mismatch = False
    if q_nums and db_nums:
        # Standardize Arabic digits in db_name to Western
        db_name_std = db_name.replace('١','1').replace('٢','2').replace('٣','3').replace('٤','4').replace('٥','5').replace('٦','6').replace('٧','7').replace('٨','8').replace('٩','9').replace('٠','0')
        db_nums_std = extract_numbers(db_name_std)
        if q_nums and db_nums_std and not q_nums.intersection(db_nums_std):
            has_num_mismatch = True

    record_summary = {
        "row": r.get("row_number"),
        "score": score_str,
        "q_orig": q_orig,
        "q_norm": q_norm,
        "db_name": db_name,
        "matched_tokens": r.get("matched_tokens"),
        "brand": r.get("brand")
    }

    if status == "matched":
        if has_num_mismatch:
            issues["num_mismatch_matched"].append(record_summary)
        elif score >= 80:
            issues["good_matches"].append(record_summary)
    elif status == "review":
        if has_num_mismatch:
            issues["num_mismatch_review"].append(record_summary)
        elif 40 <= score <= 60:
            issues["legit_reviews"].append(record_summary)
    elif status == "no_match":
        seq_score_str = r.get("sequence_score", "0%") or "0%"
        seq_score = float(seq_score_str.replace("%", ""))
        if seq_score > 60:
            issues["no_matches_check"].append(record_summary)

print("\n--- CATEGORY 1: STRENGTH/SIZE/PACK MISMATCHES AUTO-MATCHED (matched) ---")
print(f"Total found: {len(issues['num_mismatch_matched'])}")
for r in issues["num_mismatch_matched"][:20]:
    print(f"Row {r['row']} ({r['score']}): Query: '{r['q_orig']}' vs DB: '{r['db_name']}'")
    print(f"  Matched tokens: {r['matched_tokens']}")
    print("-" * 40)

print("\n--- CATEGORY 2: STRENGTH/SIZE/PACK MISMATCHES IN REVIEW ---")
print(f"Total found: {len(issues['num_mismatch_review'])}")
for r in issues["num_mismatch_review"][:10]:
    print(f"Row {r['row']} ({r['score']}): Query: '{r['q_orig']}' vs DB: '{r['db_name']}'")
    print(f"  Matched tokens: {r['matched_tokens']}")
    print("-" * 40)

print("\n--- CATEGORY 3: GOOD HIGH-CONFIDENCE MATCHES (Samples) ---")
print(f"Total found: {len(issues['good_matches'])}")
for r in issues["good_matches"][:10]:
    print(f"Row {r['row']} ({r['score']}): Query: '{r['q_orig']}' vs DB: '{r['db_name']}'")

print("\n--- CATEGORY 4: LEGITIMATE REVIEWS (Minor Spelling/Transliteration diffs) ---")
print(f"Total found: {len(issues['legit_reviews'])}")
for r in issues["legit_reviews"][:10]:
    print(f"Row {r['row']} ({r['score']}): Query: '{r['q_orig']}' vs DB: '{r['db_name']}'")
    print(f"  Matched tokens: {r['matched_tokens']}")
    print("-" * 40)
