import os
import json
import shutil
import sys

def main():
    # Resolve file paths relative to the script location
    tools_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(tools_dir)
    
    DB_PATH = os.path.join(project_root, "data", "normalized", "chefaa_products_eg_normalized.json")
    ENRICHED_PATH = os.path.join(project_root, "data", "tmp", "enriched_products.json")
    
    if not os.path.exists(ENRICHED_PATH):
        print(f"ERROR: Enriched products file not found at: {ENRICHED_PATH}")
        sys.exit(1)
        
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Normalized database file not found at: {DB_PATH}")
        sys.exit(1)
        
    # 1. Load enriched products
    print(f"Loading enriched products from: {ENRICHED_PATH}")
    with open(ENRICHED_PATH, "r", encoding="utf-8") as f:
        enriched_list = json.load(f)
        
    print(f"Loaded {len(enriched_list):,} enriched products.")
    
    # Build a lookup dictionary using stringified ID to prevent type mismatches
    enriched_lookup = {}
    for item in enriched_list:
        prod_id = item.get("id")
        if prod_id is not None:
            # Save the images array or fallback to empty list
            enriched_lookup[str(prod_id)] = item.get("images", [])
            
    # 2. Load normalized products
    print(f"Loading normalized database from: {DB_PATH} ({os.path.getsize(DB_PATH) // 1_000_000} MB)")
    with open(DB_PATH, "r", encoding="utf-8") as f:
        products = json.load(f)
        
    if not isinstance(products, list):
        print("ERROR: Expected the normalized database to be a JSON list.")
        sys.exit(1)
        
    total = len(products)
    print(f"Loaded {total:,} normalized products. Injecting galleries...")
    
    # 3. Update gallery fields
    enriched_count = 0
    default_single_count = 0
    default_empty_count = 0
    
    for i, prod in enumerate(products):
        prod_id = prod.get("id")
        str_id = str(prod_id) if prod_id is not None else ""
        
        if str_id in enriched_lookup:
            prod["gallery"] = enriched_lookup[str_id]
            enriched_count += 1
        else:
            img = prod.get("image")
            if img:
                prod["gallery"] = [img]
                default_single_count += 1
            else:
                prod["gallery"] = []
                default_empty_count += 1
                
        if (i + 1) % 10000 == 0:
            print(f"  Processed {i + 1:,}/{total:,} products...")
            
    # Print summary statistics
    print("\nProcessing completed successfully:")
    print(f"  Total products processed:           {total:,}")
    print(f"  Enriched gallery (from crawlers):    {enriched_count:,}")
    print(f"  Default gallery (single image):     {default_single_count:,}")
    print(f"  Default gallery (empty array):      {default_empty_count:,}")
    
    # 4. Create backup of DB_PATH
    backup_path = DB_PATH + ".bak"
    print(f"\nCreating backup -> {backup_path}")
    try:
        shutil.copy2(DB_PATH, backup_path)
    except Exception as e:
        print(f"WARNING: Could not create backup: {e}. Proceeding anyway...")
        
    # 5. Save updated database safely
    tmp_path = DB_PATH + ".tmp"
    print(f"Writing updated database -> {DB_PATH}")
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, DB_PATH)
        print("Successfully updated database.")
    except Exception as e:
        print(f"ERROR: Failed to save updated database: {e}")
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        sys.exit(1)

if __name__ == "__main__":
    main()
