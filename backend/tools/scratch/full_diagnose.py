import pandas as pd
from collections import Counter
import os
import sys

# Ensure UTF-8 output
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Path to the full matched sheet
path = r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\data\sheets_output\sheet-3_matched.xlsx'

if not os.path.exists(path):
    print("Full matched sheet not found.")
    exit()

df = pd.read_excel(path)

print(f"Total Rows: {len(df)}")
print(f"Matched: {len(df[df['match_status'] == 'matched'])}")
print(f"Review: {len(df[df['match_status'] == 'review'])}")
print(f"No Match: {len(df[df['match_status'] == 'no_match'])}")

# Analyze No Match samples
no_match_df = df[df['match_status'] == 'no_match']

print("\n--- SAMPLE NO MATCHES ---")
print(no_match_df[['normalized_name', 'match_score']].head(20).to_string())

# Token frequency in no-matches
unmatched_list = []
if 'unmatched_query' in df.columns:
    for val in no_match_df['unmatched_query'].dropna():
        tokens = [t.strip() for t in str(val).split(',') if t.strip()]
        unmatched_list.extend(tokens)

print("\n--- TOP 100 UNMATCHED TOKENS IN NO-MATCH BUCKET ---")
for token, count in Counter(unmatched_list).most_common(100):
    print(f"{token}: {count}")
