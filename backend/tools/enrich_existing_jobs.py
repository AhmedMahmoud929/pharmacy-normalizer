import os
import json

tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)

DB_PATH = os.path.join(project_root, "data", "normalized", "chefaa_products_eg_normalized.json")
JOBS_DIR = os.path.join(project_root, "data", "matcher", "jobs")

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

    if not os.path.exists(JOBS_DIR):
        print(f"Jobs directory does not exist: {JOBS_DIR}")
        return
        
    jobs = [d for d in os.listdir(JOBS_DIR) if os.path.isdir(os.path.join(JOBS_DIR, d))]
    print(f"Found {len(jobs)} jobs to process.")
    
    for job_id in jobs:
        results_path = os.path.join(JOBS_DIR, job_id, "results.json")
        if not os.path.exists(results_path):
            continue
            
        print(f"\nProcessing Job: {job_id}")
        try:
            with open(results_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"  Failed to load JSON: {e}")
            continue
            
        # The JSON could be a list of results or a dict with "results" key
        is_dict_wrapper = isinstance(data, dict)
        results = data.get("results", []) if is_dict_wrapper else data
        
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
            print(f"  Enriched {modified_count} matched product entries in results.json.")
            try:
                # Write back safely
                tmp_path = results_path + ".tmp"
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                os.replace(tmp_path, results_path)
            except Exception as e:
                print(f"  Failed to save JSON: {e}")
        else:
            print("  No entries enriched.")

    print("\nAll jobs successfully processed.")

if __name__ == "__main__":
    main()
