import json
import collections
import sys

# Reconfigure stdout to use UTF-8 on Windows
if sys.platform == "win32":
    import io
    sys.stdout.reconfigure(encoding='utf-8')

export_path = r"a:\drug-mapping\drug_matcher_export_2026-06-07T04-55-38.json"

with open(export_path, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total records: {len(data)}")

status_counts = collections.Counter(r.get("match_status") for r in data)
print(f"Status counts: {status_counts}")

print("\n--- SAMPLE REVIEW CASES ---")
reviews = [r for r in data if r.get("match_status") == "review"]
for r in reviews[:25]:
    print(f"Row {r.get('row_number')} (Score: {r.get('match_score')}):")
    print(f"  Orig:  {r.get('original_name')}")
    print(f"  Norm:  {r.get('normalized_name')}")
    print(f"  Match: {r.get('arabic_name')} / {r.get('brand')}")
    print(f"  Tokens matched: {r.get('matched_tokens')}")
    print("-" * 40)

print("\n--- SAMPLE NO MATCH CASES ---")
no_matches = [r for r in data if r.get("match_status") == "no_match"]
for r in no_matches[:25]:
    print(f"Row {r.get('row_number')} (Score: {r.get('match_score')}):")
    print(f"  Orig:  {r.get('original_name')}")
    print(f"  Norm:  {r.get('normalized_name')}")
    print("-" * 40)

print("\n--- SUSPICIOUS MATCHED CASES (Score < 75%) ---")
suspicious = [r for r in data if r.get("match_status") == "matched" and float(r.get("match_score").replace("%", "")) < 75]
for r in suspicious[:25]:
    print(f"Row {r.get('row_number')} (Score: {r.get('match_score')}):")
    print(f"  Orig:  {r.get('original_name')}")
    print(f"  Norm:  {r.get('normalized_name')}")
    print(f"  Match: {r.get('arabic_name')} / {r.get('brand')}")
    print("-" * 40)
