import os
import sys
import json

# Fix imports
project_root = r'c:\Users\Alrba\OneDrive\Desktop\drug-mapping\backend'
if project_root not in sys.path:
    sys.path.append(project_root)

from tools.normalize import normalize_json_file
from normalizer.core.pipeline import create_pipeline

def rebuild_index():
    raw_path = os.path.join(project_root, 'data-extractor', 'data', 'products.json')
    output_path = os.path.join(project_root, 'data-extractor', 'data', 'products_normalized.json')
    
    print(f"🔄 Rebuilding Normalized Index...")
    print(f"   Source: {raw_path}")
    
    # Create the v8.2 Turbo pipeline
    fn = create_pipeline(enable_arabic=True)
    
    # Run the normalization
    normalize_json_file(
        file_path=raw_path,
        output=output_path,
        norm_fn=fn,
        english_only=True
    )
    
    print(f"✅ Master Index Rebuilt: {output_path}")

if __name__ == "__main__":
    rebuild_index()
