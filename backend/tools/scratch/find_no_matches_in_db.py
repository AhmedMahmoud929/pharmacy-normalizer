import os
import sys
import json
import re
import difflib
from collections import defaultdict

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

tools_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(tools_dir)
if tools_dir not in sys.path:
    sys.path.append(tools_dir)

from matcher import normalize

db_path = r"a:\drug-mapping\backend\data\normalized\chefaa_products_eg_normalized.json"
no_matches_path = r"a:\drug-mapping\drug_matcher_export_2026-06-07T05-25-21.json"

print("Loading no-match cases...")
with open(no_matches_path, "r", encoding="utf-8") as f:
    no_matches = json.load(f)

# Streaming parser to extract only ID, title_en, title_ar, normalized_name_en
print("Streaming reference database to build lightweight index...")
db_products_light = []
token_to_pids = defaultdict(list)

current_obj_str = []
in_object = False

with open(db_path, "r", encoding="utf-8") as f:
    for line in f:
        stripped = line.strip()
        if stripped == "{":
            in_object = True
            current_obj_str = ["{"]
        elif stripped in ("},", "}"):
            current_obj_str.append("}")
            in_object = False
            # Parse the object
            try:
                p = json.loads("".join(current_obj_str))
                pid = p.get("id")
                t_en = p.get("title_en") or ""
                t_ar = p.get("title_ar") or ""
                norm_en = p.get("normalized_name_en") or ""
                
                # Keep only lightweight representation
                light_p = (pid, t_en, t_ar, norm_en)
                idx = len(db_products_light)
                db_products_light.append(light_p)
                
                # Tokenize for index
                tokens = set(re.findall(r'[a-zA-Z0-9]+', norm_en.lower()))
                ar_tokens = set(re.findall(r'[\u0600-\u06FF0-9]+', t_ar.lower()))
                
                for t in tokens.union(ar_tokens):
                    if len(t) >= 2:
                        token_to_pids[t].append(idx)
            except Exception as e:
                pass
        elif in_object:
            current_obj_str.append(line)

print(f"Loaded {len(db_products_light)} products from DB.")
print(f"Loaded {len(no_matches)} no-match queries.")
print("Inverted index built.")

results = []

for q_item in no_matches:
    row_num = q_item.get("row_number")
    q_orig = q_item.get("original_name")
    q_norm = q_item.get("normalized_name") or normalize(q_orig)
    
    # Find candidate products sharing tokens
    q_tokens = re.findall(r'[a-zA-Z0-9]+', q_norm.lower())
    q_ar_tokens = re.findall(r'[\u0600-\u06FF0-9]+', q_orig.lower())
    
    candidate_counts = defaultdict(int)
    for t in q_tokens + q_ar_tokens:
        if t in token_to_pids:
            for pid in token_to_pids[t]:
                candidate_counts[pid] += 1
                
    # Filter candidates
    min_overlap = 2 if len(q_tokens) >= 3 else 1
    candidates = [pid for pid, count in candidate_counts.items() if count >= min_overlap]
    
    best_candidates = []
    for pid in candidates:
        p_id, p_name_en, p_name_ar, p_norm = db_products_light[pid]
        
        # Calculate sequence similarity ratio
        ratio = difflib.SequenceMatcher(None, q_norm, p_norm).ratio()
        
        # Also check Arabic name overlap
        ar_ratio = difflib.SequenceMatcher(None, q_orig, p_name_ar).ratio()
        max_ratio = max(ratio, ar_ratio)
        
        if max_ratio > 0.40:
            best_candidates.append({
                "id": p_id,
                "title_en": p_name_en,
                "title_ar": p_name_ar,
                "score": max_ratio
            })
            
    best_candidates.sort(key=lambda x: x["score"], reverse=True)
    best_candidates = best_candidates[:3]
    
    results.append({
        "row_number": row_num,
        "original_name": q_orig,
        "normalized_name": q_norm,
        "candidates": best_candidates
    })

# Write findings
output_report = []
missing_count = 0
found_count = 0

for r in results:
    if not r["candidates"]:
        missing_count += 1
        output_report.append(f"Row {r['row_number']}: '{r['original_name']}' -> [MISSING FROM DB]\n")
    else:
        found_count += 1
        output_report.append(f"Row {r['row_number']}: '{r['original_name']}'\n")
        for c in r["candidates"]:
            output_report.append(f"  - Candidate: {c['title_en']} | {c['title_ar']} (Similarity: {c['score']*100:.1f}%)\n")
        output_report.append("\n")

print(f"\n==================================================")
print(f"SEARCH RESULTS SUMMARY")
print(f"==================================================")
print(f"Total checked: {len(results)}")
print(f"Potential candidates found in DB: {found_count} ({found_count/len(results)*100:.1f}%)")
print(f"Absolutely missing from DB:       {missing_count} ({missing_count/len(results)*100:.1f}%)")
print(f"==================================================")

report_path = r"a:\drug-mapping\backend\tools\scratch\no_matches_investigation.txt"
with open(report_path, "w", encoding="utf-8") as f:
    f.writelines(output_report)
print(f"Detailed investigation saved to: {report_path}")
