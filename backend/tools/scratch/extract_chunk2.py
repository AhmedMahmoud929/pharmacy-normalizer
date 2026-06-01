import pandas as pd

df = pd.read_excel(r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\data\sheets_output\sheet-3_chunk_2_matched.xlsx')

# 1. High Score Reviews (0.75 - 0.79) -> Missed just by a hair
high_reviews = df[(df['match_status'] == 'review') & (df['match_score'] >= 0.70)].sort_values('match_score', ascending=False).head(200)

# 2. Mid Score Reviews (0.50 - 0.69)
mid_reviews = df[(df['match_status'] == 'review') & (df['match_score'] < 0.70)].sort_values('match_score', ascending=False).head(200)

# 3. High Score No Match (0.40 - 0.49) -> Almost made it to review
high_no_match = df[(df['match_status'] == 'no_match') & (df['match_score'] >= 0.40)].sort_values('match_score', ascending=False).head(200)

cols = ['normalized_query', 'db_normalized', 'match_score', 'jaccard_score', 'sequence_score', 'matched_tokens']

with open(r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\scratch\chunk_2_analysis.txt', 'w', encoding='utf-8') as f:
    f.write("=== HIGH SCORE REVIEWS (0.70 - 0.79) ===\n")
    f.write(high_reviews[cols].to_string())
    f.write("\n\n=== MID SCORE REVIEWS (0.50 - 0.69) ===\n")
    f.write(mid_reviews[cols].to_string())
    f.write("\n\n=== HIGH NO MATCH (0.40 - 0.49) ===\n")
    f.write(high_no_match[cols].to_string())

print("Chunk 2 analysis extracted.")
