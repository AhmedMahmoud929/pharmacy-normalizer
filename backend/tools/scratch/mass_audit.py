import pandas as pd
from collections import Counter
import os

# Paths to the latest matched chunks
chunks = [
    r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\data\sheets_output\sheet-3_chunk_1_matched.xlsx',
    r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\data\sheets_output\sheet-3_chunk_2_matched.xlsx'
]

all_data = []
for path in chunks:
    if os.path.exists(path):
        all_data.append(pd.read_excel(path))

if not all_data:
    print("No matched chunks found.")
    exit()

df = pd.concat(all_data, ignore_index=True)

# 1. Frequency Analysis of Unmatched Tokens
unmatched_list = []
# The column in matcher.py is 'unmatched_query' which is a string like "word1, word2"
if 'unmatched_query' in df.columns:
    for val in df[df['match_status'] != 'matched']['unmatched_query'].dropna():
        tokens = [t.strip() for t in str(val).split(',') if t.strip()]
        unmatched_list.extend(tokens)

token_counts = Counter(unmatched_list).most_common(100)

# 2. Extract ALL "Review" items
all_reviews = df[df['match_status'] == 'review'].sort_values('match_score', ascending=False)

# 3. Extract ALL "No Match" items
all_no_match = df[df['match_status'] == 'no_match'].sort_values('match_score', ascending=False)

# 4. Analyze "Safety Penalty" cases
penalty_cases = df[
    (df['match_status'] != 'matched') & 
    (df['sequence_score'] > 0.7) & 
    (df['match_score'] < 0.6)
]

report_path = r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\scratch\mass_audit_report.txt'
with open(report_path, 'w', encoding='utf-8') as f:
    f.write("====================================================\n")
    f.write("      DRUG MATCHER MASS AUDIT REPORT (Chunks 1 & 2)  \n")
    f.write(f"      Total Items Analyzed: {len(df)}\n")
    f.write("====================================================\n\n")
    
    f.write("--- TOP 100 UNMATCHED TOKENS ---\n")
    f.write("These are likely missing brands, forms, or units in our DB:\n")
    for token, count in token_counts:
        f.write(f"{token}: {count}\n")
    f.write("\n")

    f.write(f"--- PENALTY SAFETY CHECK ({len(penalty_cases)} items) ---\n")
    f.write("Items penalized by Brand/Dose logic (Check for False Negatives):\n")
    if not penalty_cases.empty:
        f.write(penalty_cases[['normalized_query', 'db_normalized', 'match_score', 'sequence_score']].to_string())
    else:
        f.write("No severe penalty cases found.")
    f.write("\n\n")

    f.write(f"--- ALL REVIEW ITEMS ({len(all_reviews)} items) ---\n")
    f.write(all_reviews[['normalized_query', 'db_normalized', 'match_score', 'jaccard_score', 'sequence_score', 'unmatched_query']].to_string())
    f.write("\n\n")

    f.write(f"--- ALL NO MATCH ITEMS ({len(all_no_match)} items) ---\n")
    f.write(all_no_match[['normalized_query', 'db_normalized', 'match_score', 'jaccard_score', 'sequence_score', 'unmatched_query']].to_string())

print(f"Mass audit report generated at: {report_path}")
