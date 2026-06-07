import json
import re
import sys
from collections import Counter

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

old_path = r"a:\drug-mapping\drug_matcher_export_2026-06-07T05-06-49.json"
new_path = r"a:\drug-mapping\drug_matcher_export_2026-06-07T05-20-50.json"

with open(old_path, "r", encoding="utf-8") as f:
    old_data = json.load(f)

with open(new_path, "r", encoding="utf-8") as f:
    new_data = json.load(f)

# Stats
old_total = len(old_data)
new_total = len(new_data)
old_stats = Counter(r.get("match_status") for r in old_data)
new_stats = Counter(r.get("match_status") for r in new_data)

print(f"==================================================")
print(f"COMPARATIVE PERFORMANCE: RUN 2 VS RUN 3")
print(f"==================================================")
print(f"Total rows: {old_total}")
print(f"Status distribution changes:")
print(f"  - MATCHED:")
print(f"      Run 2: {old_stats['matched']} ({old_stats['matched']/old_total*100:.1f}%)")
print(f"      Run 3: {new_stats['matched']} ({new_stats['matched']/new_total*100:.1f}%)")
print(f"  - REVIEW:")
print(f"      Run 2: {old_stats['review']} ({old_stats['review']/old_total*100:.1f}%)")
print(f"      Run 3: {new_stats['review']} ({new_stats['review']/new_total*100:.1f}%)")
print(f"  - NO MATCH:")
print(f"      Run 2: {old_stats['no_match']} ({old_stats['no_match']/old_total*100:.1f}%)")
print(f"      Run 3: {new_stats['no_match']} ({new_stats['no_match']/new_total*100:.1f}%)")
print(f"==================================================")

# Inspect key problematic rows
target_rows = [5, 73, 106, 132, 196, 965, 966]
old_lookup = {r["row_number"]: r for r in old_data}
new_lookup = {r["row_number"]: r for r in new_data}

print("\n--- SPECIFIC CASE TRANSITIONS ---")
for r_num in target_rows:
    if r_num in old_lookup and r_num in new_lookup:
        o = old_lookup[r_num]
        n = new_lookup[r_num]
        print(f"Row {r_num}: {o.get('original_name')}")
        print(f"  - Run 2: Score {o.get('match_score')} | Status: {o.get('match_status')} | Match: {o.get('arabic_name')}")
        print(f"  - Run 3: Score {n.get('match_score')} | Status: {n.get('match_status')} | Match: {n.get('arabic_name')}")
        print("-" * 50)

# Detect size mismatches in new matched status
print("\n--- SCANNING NEW MATCHED ROWS FOR REMAINING NUMERIC MISMATCHES ---")
mismatch_count = 0
for r in new_data:
    if r.get("match_status") != "matched":
        continue
    q_norm = r.get("normalized_name", "")
    db_name = r.get("arabic_name", "") or r.get("brand", "")
    
    q_nums = set(re.findall(r'\b\d+(?:\.\d+)?\b', q_norm))
    db_name_std = db_name.replace('١','1').replace('٢','2').replace('٣','3').replace('٤','4').replace('٥','5').replace('٦','6').replace('٧','7').replace('٨','8').replace('٩','9').replace('٠','0')
    db_nums = set(re.findall(r'\b\d+(?:\.\d+)?\b', db_name_std))
    
    if q_nums and db_nums and not q_nums.intersection(db_nums):
        mismatch_count += 1
        print(f"Row {r.get('row_number')} ({r.get('match_score')}): Query: '{r.get('original_name')}' vs DB: '{db_name}'")

print(f"Total remaining numeric mismatches in MATCHED status: {mismatch_count}")
