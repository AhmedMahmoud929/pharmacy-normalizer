import re
import os
import sys

# Add the project root to sys.path to import mappings
sys.path.append(os.getcwd())

from normalizer.config import BRAND_MAP, ARABIC_TO_ENGLISH, ABBREVIATION_MAP as ABBREVIATIONS, FORM_TOKENS

def clean_text(text):
    # Remove common punctuation and separators
    text = re.sub(r'[\|&\-\+\*\/\\,\.\(\)\[\]]', ' ', text)
    # Remove numbers
    text = re.sub(r'\d+', ' ', text)
    return text.strip()

def scan_chunk(file_path):
    unmapped_words = {}
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for line in lines:
        parts = line.split('|')
        for part in parts:
            cleaned = clean_text(part)
            words = cleaned.split()
            for word in words:
                word = word.strip()
                if not word:
                    continue
                
                # Check if mapped
                is_mapped = (
                    word in BRAND_MAP or 
                    word in ARABIC_TO_ENGLISH or 
                    word in ABBREVIATIONS
                )
                
                if not is_mapped:
                    unmapped_words[word] = unmapped_words.get(word, 0) + 1
                    
    # Sort by frequency
    sorted_unmapped = sorted(unmapped_words.items(), key=lambda x: x[1], reverse=True)
    return sorted_unmapped

if __name__ == "__main__":
    chunk_file = "data/raw_chunks/all-products-names-part-10.txt"
    results = scan_chunk(chunk_file)
    
    output_file = "tools/scanner_results.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"Top Unmapped Tokens in {chunk_file}:\n")
        for word, freq in results:
            f.write(f"{word}: {freq}\n")
    print(f"Results written to {output_file}")
