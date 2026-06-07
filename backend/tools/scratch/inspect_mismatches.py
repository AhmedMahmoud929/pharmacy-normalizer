import json
import re
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

export_path = r"a:\drug-mapping\drug_matcher_export_2026-06-07T04-55-38.json"

with open(export_path, "r", encoding="utf-8") as f:
    data = json.load(f)

print("--- DETECTING STRENGTH/SIZE MISMATCHES IN MATCHED STATUS ---")
mismatch_count = 0
for r in data:
    if r.get("match_status") != "matched":
        continue
    
    q_norm = r.get("normalized_name", "")
    c_norm = r.get("arabic_name", "")  # wait, this has Arabic, but does it have English? Let's check keys.
    # Let's list keys of a record:
    # keys: row_number, match_score, sequence_score, normalized_name, original_name, match_status, jaccard_score, matched_tokens, brand, arabic_name
    
    # Let's extract numbers from normalized query name
    q_nums = set(re.findall(r'\b\d+\b', q_norm))
    # Let's extract numbers from reference name (we can check the Arabic name or the normalized target if we query it,
    # but we can also check the original/Arabic name since numbers are written in Western digits too)
    c_nums = set(re.findall(r'\b\d+\b', c_norm))
    
    # We look for cases where they both have numbers, but they don't intersect at all
    if q_nums and c_nums and not q_nums.intersection(c_nums):
        mismatch_count += 1
        print(f"Row {r.get('row_number')} (Score: {r.get('match_score')}):")
        print(f"  Orig:  {r.get('original_name')} (Norm: {q_norm})")
        print(f"  Match: {c_norm}")
        print(f"  Query Nums: {q_nums} | DB Nums: {c_nums}")
        print("-" * 40)

print(f"Total strength/size mismatches: {mismatch_count}")
