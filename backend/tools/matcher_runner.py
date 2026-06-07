import os
import sys
import json
import pandas as pd
import io
import asyncio
import concurrent.futures
import re
import hashlib
from urllib.parse import urlparse
from datetime import datetime
from typing import Optional, List, Dict, Set, Any

# Ensure correct python paths
tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)
if project_root not in sys.path:
    sys.path.append(project_root)
if tools_dir not in sys.path:
    sys.path.append(tools_dir)

from tools.matcher_export import build_custom_columns

from tools.matcher import ProductIndex, DEFAULT_DB_PATH, normalize
from tools.matcher_db import update_job_progress, finalize_job, update_job_pid

# Excel formatting helpers
ILLEGAL_CHARACTERS_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')

def clean_df_for_excel(df: pd.DataFrame) -> pd.DataFrame:
    """Removes Excel-illegal control characters from all string columns in the DataFrame."""
    clean_fn = lambda x: ILLEGAL_CHARACTERS_RE.sub('', x) if isinstance(x, str) else x
    return df.map(clean_fn) if hasattr(df, 'map') else df.applymap(clean_fn)


# Local image status enrichment helpers
def normalize_cdn_url(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    path = parsed.path
    idx = path.find("/public/")
    if idx > 0:
        return parsed._replace(path=path[idx:]).geturl()
    return url

def fix_dotless_url(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    path = parsed.path
    for ext in ["png", "jpg", "jpeg", "webp"]:
        if path.endswith(ext) and not path.endswith(f".{ext}"):
            new_path = path[:-len(ext)] + f".{ext}"
            return parsed._replace(path=new_path).geturl()
    return url

def sanitize_filename(url: str) -> str:
    parsed = urlparse(url)
    name = os.path.basename(parsed.path).split("?")[0]
    if not name:
        return hashlib.md5(url.encode()).hexdigest() + ".jpg"
    name = name.encode("utf-8", errors="replace").decode("ascii", errors="replace")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    name = re.sub(r"_+", "_", name)
    return name

def enrich_product_image_status(product: dict) -> dict:
    if not product or not isinstance(product, dict):
        return product
    
    p = product.copy()
    image_url = p.get("image")
    if not image_url:
        p["is_local_image"] = False
        p["local_image_url"] = None
        return p
    
    normalized = normalize_cdn_url(image_url)
    corrected = fix_dotless_url(normalized)
    filename = sanitize_filename(corrected)
    
    media_dir = os.path.join(project_root, "data", "media", "products")
    file_path = os.path.join(media_dir, filename)
    
    if os.path.exists(file_path):
        p["is_local_image"] = True
        p["local_image_name"] = filename
        p["local_image_url"] = f"/media/products/{filename}"
    else:
        brand_media_dir = os.path.join(project_root, "data", "media", "brands")
        brand_file_path = os.path.join(brand_media_dir, filename)
        if os.path.exists(brand_file_path):
            p["is_local_image"] = True
            p["local_image_name"] = filename
            p["local_image_url"] = f"/media/brands/{filename}"
        else:
            p["is_local_image"] = False
            p["local_image_url"] = None
            
    return p

# Shared SSE listener queue registry to prevent circular imports
job_listeners: Dict[str, Set[asyncio.Queue]] = {}

def load_reference_db() -> List[Dict[str, Any]]:
    """Loads the reference catalog dataset."""
    db_to_load = DEFAULT_DB_PATH
    from tools.matcher import RAW_DB_PATH
    if not os.path.exists(DEFAULT_DB_PATH) and os.path.exists(RAW_DB_PATH):
        db_to_load = RAW_DB_PATH
        
    try:
        with open(db_to_load, "r", encoding="utf-8") as f:
            return json.load(f)
    except (MemoryError, Exception):
        # Fall back to streaming line-by-line
        products = []
        current_obj_str = []
        in_object = False
        with open(db_to_load, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if stripped == "{":
                    in_object = True
                    current_obj_str = ["{"]
                elif stripped in ("},", "}"):
                    current_obj_str.append("}")
                    in_object = False
                    try:
                        products.append(json.loads("".join(current_obj_str)))
                    except Exception:
                        pass
                elif in_object:
                    current_obj_str.append(line)
        return products

def _process_single_row(idx: int, raw_name: str, norm_name: str, index_inst: ProductIndex, top: int, match_threshold: float, review_threshold: float, uploaded_price: Optional[float] = None, uploaded_stock: Optional[int] = None) -> dict:
    """Core row matching computation executed inside ThreadPool workers."""
    matches = index_inst.search(norm_name, top_k=top)
    
    result_payload = {
        "row_index": idx,
        "original_name": raw_name,
        "normalized_name": norm_name,
        "uploaded_price": uploaded_price,
        "uploaded_stock": uploaded_stock,
        "matches": []
    }
    
    if matches:
        for m in matches:
            score = m["score"]
            prod = m["entry"]["product"]
            var = m["entry"]["variant"]
            status = "matched" if score >= match_threshold else ("review" if score >= review_threshold else "no_match")
            
            result_payload["matches"].append({
                "score": round(score, 3),
                "status": status,
                "id": prod.get("id"),
                "sku": var.get("sku"),
                "name_en": prod.get("name_en"),
                "price": var.get("price"),
                "variant_id": var.get("id"),
                "image": var.get("image") or prod.get("image"),
                "db_normalized": m.get("db_normalized", ""),
                "jaccard": m.get("jaccard", 0),
                "sequence": m.get("sequence", 0),
                "matched_tokens": m.get("matched_tokens", []),
                "unmatched_query_tokens": m.get("unmatched_query_tokens", []),
                "unmatched_db_tokens": m.get("unmatched_db_tokens", []),
                "candidate_count": m.get("candidate_count", 0),
                "product_data": enrich_product_image_status(prod),
                "variant_data": var
            })
            
    return result_payload

async def run_matcher_background(
    job_id: str,
    file_bytes: bytes,
    file_ext: str,
    column: Optional[str],
    top: int,
    match_threshold: float,
    review_threshold: float,
    parallel: bool = True,
    workers: Optional[int] = None,
    use_uploaded_price: bool = False,
    price_column: Optional[str] = None,
    use_uploaded_stock: bool = False,
    stock_column: Optional[str] = None,
    default_stock: int = 10,
    index_inst: Optional[ProductIndex] = None
):
    """Asynchronous worker task managing sheet matching execution and state persistence."""
    try:
        # Register main process PID as the job worker ID
        update_job_pid(job_id, os.getpid())
        
        # 1. Parse Excel / CSV File
        try:
            if file_ext in [".xlsx", ".xls"]:
                df = pd.read_excel(io.BytesIO(file_bytes))
            elif file_ext == ".csv":
                df = pd.read_csv(io.BytesIO(file_bytes))
            else:
                raise ValueError(f"Unsupported extension: {file_ext}")
        except Exception as parse_err:
            finalize_job(job_id, "failed", error_msg=f"Failed to parse sheet: {str(parse_err)}")
            return

        # 2. Save original file in job folder
        jobs_dir = os.path.join(project_root, "data", "matcher", "jobs", job_id)
        os.makedirs(jobs_dir, exist_ok=True)
        original_file_path = os.path.join(jobs_dir, f"original{file_ext}")
        with open(original_file_path, "wb") as f:
            f.write(file_bytes)

        # 3. Detect Name Column
        from tools.matcher import NAME_COLUMN_CANDIDATES
        name_col = column
        if not name_col:
            for candidate in NAME_COLUMN_CANDIDATES:
                if candidate in df.columns:
                    name_col = candidate
                    break
            if not name_col:
                for col in df.columns:
                    if "name" in str(col).lower() or "الاسم" in str(col):
                        name_col = col
                        break
        
        if not name_col:
            finalize_job(job_id, "failed", error_msg="Product name column could not be automatically detected.")
            return

        # 4. Load Reference Catalog Index
        if index_inst is None:
            try:
                products_data = load_reference_db()
                index_inst = ProductIndex(products_data)
            except Exception as db_err:
                finalize_job(job_id, "failed", error_msg=f"Failed loading product catalog index: {str(db_err)}")
                return

        total_rows = len(df)
        
        # Pre-normalize queries
        queries = []
        for idx, row in df.iterrows():
            raw_name = str(row[name_col]) if pd.notna(row[name_col]) else ""
            norm_name = normalize(raw_name)
            
            uploaded_price = None
            if use_uploaded_price and price_column and price_column in df.columns:
                val = row[price_column]
                if pd.notna(val):
                    try:
                        val_str = str(val).strip()
                        # Extract digits and decimal dots
                        match = re.search(r"[-+]?\d*\.\d+|\d+", val_str)
                        if match:
                            uploaded_price = float(match.group())
                        else:
                            uploaded_price = float(val_str)
                    except:
                        uploaded_price = val

            uploaded_stock = None
            if use_uploaded_stock and stock_column and stock_column in df.columns:
                val = row[stock_column]
                if pd.notna(val):
                    try:
                        val_str = str(val).strip()
                        # Extract first contiguous group of digits
                        match = re.search(r"\d+", val_str)
                        if match:
                            uploaded_stock = int(match.group())
                        else:
                            uploaded_stock = int(val_str)
                    except:
                        uploaded_stock = default_stock
                else:
                    uploaded_stock = default_stock
            else:
                uploaded_stock = default_stock
                        
            queries.append((idx, raw_name, norm_name, uploaded_price, uploaded_stock))

        results_list = []
        matched_count = 0
        review_count = 0
        no_match_count = 0

        # Broadcast initial metadata info
        if job_id in job_listeners:
            meta_payload = json.dumps({"total_rows": total_rows, "column_used": name_col, "job_id": job_id})
            for q in list(job_listeners[job_id]):
                await q.put(f"event: info\ndata: {meta_payload}\n\n")

        # 5. Process Rows
        if parallel:
            workers_count = workers or min(os.cpu_count() or 1, 4)
            loop = asyncio.get_running_loop()
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers_count) as executor:
                tasks = [
                    loop.run_in_executor(
                        executor, 
                        _process_single_row, 
                        idx, 
                        raw_name, 
                        norm_name, 
                        index_inst, 
                        top, 
                        match_threshold, 
                        review_threshold,
                        uploaded_price,
                        uploaded_stock
                    )
                    for idx, raw_name, norm_name, uploaded_price, uploaded_stock in queries
                ]
                
                # Consume as completed
                for completed_idx, future in enumerate(asyncio.as_completed(tasks)):
                    result_payload = await future
                    results_list.append(result_payload)
                    
                    # Accumulate stats based on top candidate match
                    top_status = "no_match"
                    if result_payload["matches"]:
                        top_status = result_payload["matches"][0]["status"]
                    
                    if top_status == "matched":
                        matched_count += 1
                    elif top_status == "review":
                        review_count += 1
                    else:
                        no_match_count += 1
                        
                    processed_count = len(results_list)
                    
                    # Update SQLite database progress dynamically every 10 rows
                    if processed_count % 10 == 0 or processed_count == total_rows:
                        from tools.matcher_db import get_job
                        current_job = get_job(job_id)
                        if current_job and current_job["status"] == "stopped":
                            print(f"Job {job_id} cancelled by user. Terminating threads.")
                            return
                        update_job_progress(
                            job_id, 
                            processed_rows=processed_count, 
                            matched_count=matched_count, 
                            review_count=review_count, 
                            no_match_count=no_match_count
                        )
                        # Save incremental results.json so API users can view ongoing match chunks
                        try:
                            results_json_path = os.path.join(jobs_dir, "results.json")
                            temp_json_path = results_json_path + ".tmp"
                            with open(temp_json_path, "w", encoding="utf-8") as f:
                                json.dump(results_list, f, indent=2, ensure_ascii=False)
                            os.replace(temp_json_path, results_json_path)
                        except Exception as write_err:
                            print(f"Failed to write incremental results for job {job_id}: {write_err}")
                        
                    # Broadcast to SSE listeners
                    if job_id in job_listeners:
                        progress_payload = json.dumps({
                            "processed_rows": processed_count,
                            "total_rows": total_rows,
                            "matched_count": matched_count,
                            "review_count": review_count,
                            "no_match_count": no_match_count,
                            "current_action": f"Processed {processed_count}/{total_rows} rows..."
                        })
                        for q in list(job_listeners[job_id]):
                            await q.put(f"event: progress\ndata: {progress_payload}\n\n")
                            await q.put(f"event: result\ndata: {json.dumps(result_payload)}\n\n")
                            
                    # Yield thread slightly to keep event loop responsive
                    if completed_idx % 10 == 0:
                        await asyncio.sleep(0.01)
        else:
            # Sequential execution loop
            for idx, raw_name, norm_name, uploaded_price, uploaded_stock in queries:
                result_payload = _process_single_row(
                    idx, 
                    raw_name, 
                    norm_name, 
                    index_inst, 
                    top, 
                    match_threshold, 
                    review_threshold,
                    uploaded_price,
                    uploaded_stock
                )
                results_list.append(result_payload)
                
                top_status = "no_match"
                if result_payload["matches"]:
                    top_status = result_payload["matches"][0]["status"]
                
                if top_status == "matched":
                    matched_count += 1
                elif top_status == "review":
                    review_count += 1
                else:
                    no_match_count += 1
                    
                processed_count = len(results_list)
                
                # Update SQLite DB progress
                if processed_count % 10 == 0 or processed_count == total_rows:
                    from tools.matcher_db import get_job
                    current_job = get_job(job_id)
                    if current_job and current_job["status"] == "stopped":
                        print(f"Job {job_id} cancelled by user. Terminating sequential run.")
                        return
                    update_job_progress(
                        job_id, 
                        processed_rows=processed_count, 
                        matched_count=matched_count, 
                        review_count=review_count, 
                        no_match_count=no_match_count
                    )
                    # Save incremental results.json so API users can view ongoing match chunks
                    try:
                        results_json_path = os.path.join(jobs_dir, "results.json")
                        temp_json_path = results_json_path + ".tmp"
                        with open(temp_json_path, "w", encoding="utf-8") as f:
                            json.dump(results_list, f, indent=2, ensure_ascii=False)
                        os.replace(temp_json_path, results_json_path)
                    except Exception as write_err:
                        print(f"Failed to write incremental results for job {job_id}: {write_err}")
                    
                # Broadcast progress & row results
                if job_id in job_listeners:
                    progress_payload = json.dumps({
                        "processed_rows": processed_count,
                        "total_rows": total_rows,
                        "matched_count": matched_count,
                        "review_count": review_count,
                        "no_match_count": no_match_count,
                        "current_action": f"Processed {processed_count}/{total_rows} rows..."
                    })
                    for q in list(job_listeners[job_id]):
                        await q.put(f"event: progress\ndata: {progress_payload}\n\n")
                        await q.put(f"event: result\ndata: {json.dumps(result_payload)}\n\n")
                        
                if processed_count % 10 == 0:
                    await asyncio.sleep(0.01)

        # 6. Sort results_list by original row_index to preserve Excel file ordering
        results_list.sort(key=lambda x: x["row_index"])

        # 7. Write raw results.json file
        results_json_path = os.path.join(jobs_dir, "results.json")
        temp_json_path = results_json_path + ".tmp"
        with open(temp_json_path, "w", encoding="utf-8") as f:
            json.dump(results_list, f, indent=2, ensure_ascii=False)
        os.replace(temp_json_path, results_json_path)

        # 8. Compile finalized xlsx sheet output
        excel_records = []
        for res in results_list:
            top_match = res["matches"][0] if res["matches"] else None
            status = top_match["status"] if top_match else "no_match"
            score = top_match["score"] if top_match else 0.0
            
            p = top_match.get("product_data") if top_match else {}
            v = top_match.get("variant_data") if top_match else {}
            
            uploaded_price = res.get("uploaded_price")
            catalog_price_val = (v or {}).get("price") or (p or {}).get("price") or 0.0
            if uploaded_price is not None:
                catalog_price_val = uploaded_price

            uploaded_stock = res.get("uploaded_stock")
            if uploaded_stock is None:
                uploaded_stock = default_stock

            record = {
                "original_name": res["original_name"],
                "normalized_name": res["normalized_name"],
                "match_status": status,
                "match_score": f"{score * 100:.1f}%",
                "matched_product_id": (p or {}).get("id") or (top_match.get("id") if top_match else ""),
                "matched_sku": top_match.get("sku") if top_match else "",
                "matched_name_en": top_match.get("name_en") if top_match else "",
                "catalog_price": catalog_price_val,
                "classification_category": (p or {}).get("category", {}).get("name") if isinstance((p or {}).get("category"), dict) else (p or {}).get("category", ""),
                "brand": (p or {}).get("brand", {}).get("name") if isinstance((p or {}).get("brand"), dict) else (p or {}).get("brand", ""),
                "in_stock": "Yes" if ((v or {}).get("stock", 0) > 0 or (p or {}).get("in_stock", True)) else "No",
                "storefront_link": f"https://chefaa.com/product/{(p or {}).get('slug')}" if (p or {}).get("slug") else ""
            }
            
            # Map up to 3 candidates
            for k in range(3):
                prefix = f"candidate_{k+1}_"
                if k < len(res["matches"]):
                    cand = res["matches"][k]
                    record.update({
                        f"{prefix}score": f"{cand['score'] * 100:.1f}%",
                        f"{prefix}id": cand.get("id"),
                        f"{prefix}name_en": cand.get("name_en")
                    })
                else:
                    record.update({
                        f"{prefix}score": "",
                        f"{prefix}id": "",
                        f"{prefix}name_en": ""
                    })

            # Append custom export columns per spec (matcher-custom-export.md)
            record.update(build_custom_columns(
                p or None, 
                override_price=uploaded_price, 
                override_stock=uploaded_stock, 
                default_stock=default_stock
            ))
                    
            excel_records.append(record)

        excel_out_path = os.path.join(jobs_dir, "matched.xlsx")
        df_out = pd.DataFrame(excel_records)
        df_out = clean_df_for_excel(df_out)
        with pd.ExcelWriter(excel_out_path, engine='openpyxl') as writer:
            df_out.to_excel(writer, index=False, sheet_name="Matched Catalog")

        # 9. Conclude job as completed
        finalize_job(job_id, "completed", output_path=excel_out_path)
        
        # Broadcast completed SSE notification
        if job_id in job_listeners:
            complete_payload = json.dumps({"status": "completed", "output_path": excel_out_path})
            for q in list(job_listeners[job_id]):
                await q.put(f"event: complete\ndata: {complete_payload}\n\n")

    except Exception as run_err:
        print(f"Background mapping execution exception: {run_err}")
        finalize_job(job_id, "failed", error_msg=str(run_err))
        if job_id in job_listeners:
            error_payload = json.dumps({"status": "failed", "message": str(run_err)})
            for q in list(job_listeners[job_id]):
                await q.put(f"event: error\ndata: {error_payload}\n\n")
