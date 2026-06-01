import pandas as pd

df = pd.read_excel(r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\data\sheets_output\sheet-3_chunk_1_matched.xlsx')

# 1. High Score Matches (Top 20)
high_matches = df[df['match_status'] == 'matched'].sort_values('match_score', ascending=False).head(20)

# 2. Borderline Matches (Score close to 0.85)
border_matches = df[(df['match_score'] >= 0.85) & (df['match_score'] <= 0.87)].head(20)

# 3. High Score Reviews (Score close to 0.85)
high_reviews = df[(df['match_score'] < 0.85) & (df['match_score'] >= 0.80)].sort_values('match_score', ascending=False).head(20)

# 4. Mid Score Reviews (Score ~0.70)
mid_reviews = df[(df['match_score'] < 0.80) & (df['match_score'] >= 0.70)].head(20)

cols = ['normalized_query', 'db_normalized', 'match_score', 'jaccard_score', 'sequence_score', 'matched_tokens']

with open(r'C:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend\scratch\verification_samples.txt', 'w', encoding='utf-8') as f:
    f.write("=== HIGH SCORE MATCHES (>= 0.95) ===\n")
    f.write(high_matches[cols].to_string())
    f.write("\n\n=== BORDERLINE MATCHES (0.85 - 0.87) ===\n")
    f.write(border_matches[cols].to_string())
    f.write("\n\n=== HIGH SCORE REVIEWS (0.80 - 0.84) ===\n")
    f.write(high_reviews[cols].to_string())
    f.write("\n\n=== MID SCORE REVIEWS (0.70 - 0.79) ===\n")
    f.write(mid_reviews[cols].to_string())

print("Verification samples extracted.")
