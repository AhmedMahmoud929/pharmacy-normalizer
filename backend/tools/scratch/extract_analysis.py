import pandas as pd

df = pd.read_excel(r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\data\sheets_output\sheet-3_chunk_1_matched.xlsx')
review_df = df[df['match_status'] == 'review'].head(30)
no_match_df = df[df['match_status'] == 'no_match'].head(30)

cols = ['normalized_query', 'db_normalized', 'match_score', 'jaccard_score', 'sequence_score', 'matched_tokens', 'unmatched_query', 'unmatched_db']

with open(r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\scratch\analysis_utf8.txt', 'w', encoding='utf-8') as f:
    f.write('--- REVIEW ---\n')
    f.write(review_df[cols].to_string())
    f.write('\n\n--- NO MATCH ---\n')
    f.write(no_match_df[cols].to_string())

print("Extraction complete.")
