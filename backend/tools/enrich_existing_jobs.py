import os
import json

tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)
import sys
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from tools.matcher_db import get_jobs, load_results, save_results

DB_PATH = os.path.join(project_root, "data", "normalized", "chefaa_products_eg_normalized.json")

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return
        
    print(f"Loading reference database: {DB_PATH}")
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db_data = json.load(f)
        
    print(f"Loaded {len(db_data):,} reference products.")
    
    # Create a lookup dictionary
    prod_lookup = {}
    for p in db_data:
        pid = str(p.get("id"))
        prod_lookup[pid] = p

    jobs = get_jobs(limit=1000, offset=0).get("jobs", [])
    print(f"Found {len(jobs)} jobs to process.")
    
    for job in jobs:
        job_id = job["job_id"]
        print(f"\nProcessing Job: {job_id}")
        try:
            results = load_results(job_id)
        except Exception as e:
            print(f"  Failed to load results: {e}")
            continue
            
        modified_count = 0
        for res in results:
            matches = res.get("matches") or []
            for match in matches:
                p = match.get("product_data") or {}
                pid = str(p.get("id")) if p else None
                if pid and pid in prod_lookup:
                    ref_prod = prod_lookup[pid]
                    
                    # 1. Update/Add missing top-level keys
                    p["description_en"] = ref_prod.get("description_en") or ref_prod.get("meta_description_en") or ""
                    p["description_ar"] = ref_prod.get("description_ar") or ref_prod.get("meta_description_ar") or ""
                    p["unit"] = ref_prod.get("unit") or ""
                    
                    # 2. Update brand information
                    brand_data = ref_prod.get("brands")
                    p["brands"] = brand_data
                    if brand_data:
                        p["brand"] = {
                            "id": brand_data.get("id"),
                            "name": brand_data.get("title_en") or brand_data.get("title_ar"),
                            "name_en": brand_data.get("title_en") or brand_data.get("title_ar") or "",
                            "name_ar": brand_data.get("title_ar") or brand_data.get("title_en") or "",
                            "title_en": brand_data.get("title_en") or "",
                            "title_ar": brand_data.get("title_ar") or "",
                            "slug": brand_data.get("slug"),
                            "image": brand_data.get("images"),
                            "images": brand_data.get("images"),
                            "logo_url": brand_data.get("images")
                        }
                    else:
                        p["brand"] = None
                        
                    # 3. Update category information
                    cat_data = ref_prod.get("level_one_category")
                    p["level_one_category"] = cat_data
                    if cat_data:
                        p["category"] = {
                            "name": cat_data.get("title_en") or cat_data.get("title_ar"),
                            "name_en": cat_data.get("title_en") or "",
                            "name_ar": cat_data.get("title_ar") or "",
                            "title_en": cat_data.get("title_en") or "",
                            "title_ar": cat_data.get("title_ar") or "",
                            "slug": cat_data.get("slug")
                        }
                    else:
                        p["category"] = None
                        
                    modified_count += 1
                    
        if modified_count > 0:
            print(f"  Enriched {modified_count} matched product entries in DB.")
            try:
                save_results(job_id, results)
            except Exception as e:
                print(f"  Failed to save results: {e}")
        else:
            print("  No entries enriched.")

    print("\nAll jobs successfully processed.")

if __name__ == "__main__":
    main()
