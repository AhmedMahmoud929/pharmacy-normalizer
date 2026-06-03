import os
import sys
import json
import asyncio
import io
from typing import Optional, List, Dict, Set
from fastapi import FastAPI, UploadFile, File, Query, HTTPException, Form
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import concurrent.futures
from datetime import datetime
from pydantic import BaseModel
import uuid
import re
import zipfile
import shutil

# Fix imports to allow importing from tools/ matcher and normalizer
project_root = os.path.dirname(os.path.abspath(__file__))
workspace_root = os.path.dirname(project_root)
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer import normalize
from tools.matcher import ProductIndex, DEFAULT_DB_PATH, init_worker

app = FastAPI(title="Drug Matcher API")

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global index instance
index: Optional[ProductIndex] = None
raw_products: List[dict] = []


from urllib.parse import urlparse
import hashlib

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

@app.get("/media/{category}/{filename}")
async def get_media_file(category: str, filename: str):
    if ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if category not in ["products", "brands"]:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    media_dir = os.path.join(project_root, "data", "media", category)
    file_path = os.path.join(media_dir, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

@app.on_event("startup")
async def startup_event():
    global index, raw_products
    from tools.matcher import RAW_DB_PATH
    
    db_to_load = DEFAULT_DB_PATH
    if not os.path.exists(DEFAULT_DB_PATH):
        print(f"WARNING: Normalized database not found at {DEFAULT_DB_PATH}")
        if os.path.exists(RAW_DB_PATH):
            print(f"Falling back to raw database at {RAW_DB_PATH}...")
            db_to_load = RAW_DB_PATH
        else:
            print(f"ERROR: No database found at all. Please ensure {RAW_DB_PATH} exists.")
            return

    try:
        with open(db_to_load, "r", encoding="utf-8") as f:
            data = json.load(f)
        index = ProductIndex(data)
        raw_products = data
        print(f"Database loaded successfully from {db_to_load}.")
    except Exception as e:
        print(f"FAILED to load database: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "ok", "database_loaded": index is not None}

@app.get("/match")
async def match_single(
    q: str, 
    top: int = 5, 
    match_threshold: float = 0.60, 
    review_threshold: float = 0.40
):
    if index is None:
        raise HTTPException(status_code=503, detail="Database not loaded")
    
    norm_query = normalize(q)
    candidates = index.search(norm_query, top_k=top)
    
    results = []
    for res in candidates:
        score = res["score"]
        prod = res["entry"]["product"]
        var = res["entry"]["variant"]
        
        status = "matched" if score >= match_threshold else ("review" if score >= review_threshold else "no_match")
        
        results.append({
            "score": round(score, 3),
            "status": status,
            "id": prod.get("id"),
            "sku": var.get("sku"),
            "name_en": prod.get("name_en"),
            "price": var.get("price"),
            "variant_id": var.get("id"),
            "image": var.get("image") or prod.get("image"),
            "db_normalized": res.get("db_normalized", ""),
            "jaccard": res.get("jaccard", 0),
            "sequence": res.get("sequence", 0),
            "matched_tokens": res.get("matched_tokens", []),
            "unmatched_query_tokens": res.get("unmatched_query_tokens", []),
            "unmatched_db_tokens": res.get("unmatched_db_tokens", []),
            "candidate_count": res.get("candidate_count", 0),
            "product_data": prod,
            "variant_data": var
        })
        
    return {
        "query": q,
        "normalized": norm_query,
        "results": results
    }

def _process_row(idx, raw_name, norm_name, top, match_threshold, review_threshold):
    global index
    if not index:
        return None
        
    matches = index.search(norm_name, top_k=top)
    
    result_payload = {
        "row_index": idx,
        "original_name": raw_name,
        "normalized_name": norm_name,
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

@app.post("/match/sheet")
async def match_sheet(
    file: UploadFile = File(...),
    column: Optional[str] = Form(None),
    top: int = Form(1),
    match_threshold: float = Form(0.60),
    review_threshold: float = Form(0.40),
    parallel: bool = Form(False),
    workers: Optional[int] = Form(None)
):
    if index is None:
        raise HTTPException(status_code=503, detail="Database not loaded")

    # Read the file into memory
    content = await file.read()
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    try:
        if file_ext in [".xlsx", ".xls"]:
            df = pd.read_excel(io.BytesIO(content))
        elif file_ext == ".csv":
            df = pd.read_csv(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {file_ext}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

    # Detect column
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
        raise HTTPException(status_code=400, detail="Could not detect product name column. Please specify it.")

    async def event_generator():
        yield f"event: info\ndata: {json.dumps({'total_rows': len(df), 'column_used': name_col})}\n\n"
        
        # Pre-normalize queries to save overhead during mapping
        queries = []
        for idx, row in df.iterrows():
            raw_name = str(row[name_col])
            norm_name = normalize(raw_name)
            queries.append((idx, raw_name, norm_name))

        if parallel:
            workers_count = workers or min(os.cpu_count() or 1, 4)
            loop = asyncio.get_running_loop()
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers_count) as executor:
                tasks = [
                    loop.run_in_executor(executor, _process_row, idx, raw_name, norm_name, top, match_threshold, review_threshold)
                    for idx, raw_name, norm_name in queries
                ]
                
                # Yield as completed
                for idx, future in enumerate(asyncio.as_completed(tasks)):
                    try:
                        result_payload = await future
                        if result_payload:
                            yield f"event: result\ndata: {json.dumps(result_payload)}\n\n"
                    except Exception as exc:
                        print(f"Row generated an exception: {exc}")
                    
                    if idx % 10 == 0:
                        await asyncio.sleep(0.01)
        else:
            # Sequential processing
            for idx, raw_name, norm_name in queries:
                matches = index.search(norm_name, top_k=top)
                
                result_payload = {
                    "row_index": idx,
                    "original_name": raw_name,
                    "normalized_name": norm_name,
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
                
                yield f"event: result\ndata: {json.dumps(result_payload)}\n\n"
                
                if idx % 10 == 0:
                    await asyncio.sleep(0.01)
        
        yield "event: complete\ndata: {\"status\": \"finished\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
    
@app.get("/normalize")
async def normalize_text(q: str):
    return {
        "original": q,
        "normalized": normalize(q)
    }

class BatchNormalizeRequest(BaseModel):
    queries: List[str]

@app.post("/normalize/batch")
async def normalize_batch(request: BatchNormalizeRequest):
    return {
        "results": [{"original": q, "normalized": normalize(q)} for q in request.queries]
    }

@app.get("/db/summary")
async def get_db_summary():
    if index is None:
        raise HTTPException(status_code=503, detail="Database not loaded")
    
    # Calculate stats
    all_entries = index.entries
    unique_product_ids = set()
    categories = set()
    brands = set()
    total_variants = len(all_entries)
    
    for entry in all_entries:
        p = entry["product"]
        unique_product_ids.add(p.get("id"))
        
        cat = p.get("category", {})
        if cat and cat.get("name"):
            categories.add(cat.get("name"))
            
        brand = p.get("brand", {})
        if brand and brand.get("name"):
            brands.add(brand.get("name"))
            
    return {
        "total_products": len(unique_product_ids),
        "total_variants": total_variants,
        "total_categories": len(categories),
        "total_brands": len(brands),
        "status": "healthy"
    }

@app.get("/db/categories")
async def list_categories():
    if index is None:
        raise HTTPException(status_code=503, detail="Database not loaded")
    
    categories = {}
    for entry in index.entries:
        cat = entry["product"].get("category", {})
        if cat and cat.get("name"):
            name = cat.get("name")
            if name not in categories:
                categories[name] = {
                    "name": name,
                    "slug": cat.get("slug"),
                    "count": 0
                }
            categories[name]["count"] += 1
            
    return sorted(list(categories.values()), key=lambda x: x["count"], reverse=True)

def enrich_brand_image(brand: dict) -> dict:
    b = brand.copy()
    image_url = b.get("image")
    if not image_url:
        b["is_local_image"] = False
        b["local_image_url"] = None
        b["image_name"] = ""
        return b
    
    normalized = normalize_cdn_url(image_url)
    corrected = fix_dotless_url(normalized)
    filename = sanitize_filename(corrected)
    
    b["image_name"] = filename
    
    brand_media_dir = os.path.join(project_root, "data", "media", "brands")
    file_path = os.path.join(brand_media_dir, filename)
    
    if os.path.exists(file_path):
        b["is_local_image"] = True
        b["local_image_url"] = f"/media/brands/{filename}"
    else:
        b["is_local_image"] = False
        b["local_image_url"] = None
    return b

@app.get("/db/brands")
async def list_brands():
    if index is None:
        raise HTTPException(status_code=503, detail="Database not loaded")
    
    brands = {}
    for entry in index.entries:
        brand = entry["product"].get("brand", {})
        if brand and brand.get("name"):
            name = brand.get("name")
            if name not in brands:
                brands[name] = {
                    "name": name,
                    "slug": brand.get("slug"),
                    "image": brand.get("image"),
                    "count": 0
                }
            brands[name]["count"] += 1
            
    enriched_brands = [enrich_brand_image(b) for b in brands.values()]
    return sorted(enriched_brands, key=lambda x: x["count"], reverse=True)

class ManualMatchSave(BaseModel):
    original_name: str
    matched_sku: str
    product_id: str
    variant_id: Optional[str] = None
    user_comment: Optional[str] = None

@app.post("/match/save")
async def save_manual_match(match: ManualMatchSave):
    # Ensure data directory exists
    save_path = os.path.join(project_root, "data", "manual_matches.json")
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    current_matches = []
    if os.path.exists(save_path):
        try:
            with open(save_path, "r", encoding="utf-8") as f:
                current_matches = json.load(f)
        except:
            current_matches = []
            
    # Add new match
    match_entry = match.dict()
    match_entry["timestamp"] = datetime.now().isoformat()
    current_matches.append(match_entry)
    
    # Save back
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(current_matches, f, indent=2, ensure_ascii=False)
        
    return {"status": "success", "total_saved": len(current_matches)}

@app.get("/db/products")
async def list_db_products(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    image_status: Optional[str] = Query(None)
):
    if index is None:
        raise HTTPException(status_code=503, detail="Database not loaded")
    
    all_entries = index.entries
    
    if search:
        search_norm = normalize(search)
        # Search all entries to perform accurate deduplication & filtering across all candidates
        results = index.search(search_norm, top_k=len(all_entries))
        
        seen_ids = set()
        matched_products = []
        for r in results:
            p = r["entry"]["product"]
            if p["id"] not in seen_ids:
                seen_ids.add(p["id"])
                enriched = enrich_product_image_status(p)
                
                if image_status == "local" and not enriched.get("is_local_image"):
                    continue
                if image_status == "cdn" and enriched.get("is_local_image"):
                    continue
                    
                matched_products.append(enriched)
                
        paged = matched_products[offset : offset + limit]
        return {
            "total": len(matched_products),
            "limit": limit,
            "offset": offset,
            "products": paged
        }
    
    # Deduplicate products (index has variant entries)
    seen_ids = set()
    unique_products = []
    for entry in all_entries:
        p = entry["product"]
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            enriched = enrich_product_image_status(p)
            
            if image_status == "local" and not enriched.get("is_local_image"):
                continue
            if image_status == "cdn" and enriched.get("is_local_image"):
                continue
                
            unique_products.append(enriched)
            
    paged = unique_products[offset : offset + limit]
    return {
        "total": len(unique_products),
        "limit": limit,
        "offset": offset,
        "products": paged
    }
def get_brand_id(p):
    brand = p.get("brand") or p.get("brands")
    if isinstance(brand, dict):
        return brand.get("id") or ""
    return ""

def get_category_id(p):
    cat = p.get("category") or p.get("level_one_category")
    if isinstance(cat, dict):
        return cat.get("slug") or ""
    return ""

def get_sub_category_id(p):
    cat2 = p.get("level_two_category") or []
    if isinstance(cat2, dict):
        return cat2.get("slug") or ""
    if isinstance(cat2, list) and len(cat2) > 0:
        first = cat2[0]
        if isinstance(first, dict):
            return first.get("slug") or ""
    return ""

def get_sub_sub_category_id(p):
    cat3 = p.get("level_three_category") or []
    if isinstance(cat3, dict):
        return cat3.get("slug") or ""
    if isinstance(cat3, list) and len(cat3) > 0:
        first = cat3[0]
        if isinstance(first, dict):
            return first.get("slug") or ""
    return ""


@app.get("/db/export")
async def export_database(
    format: str = Query(...),
    scope: str = Query(...),
    search: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1),
    columns: Optional[str] = Query(None)
):
    if index is None:
        raise HTTPException(status_code=503, detail="Database not loaded")
    
    # 1. Fetch relevant dataset based on scope
    all_entries = index.entries
    
    # Deduplicate products (index has variant entries)
    seen_ids = set()
    unique_products = []
    for entry in all_entries:
        p = entry["product"]
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            unique_products.append(p)
            
    if scope == "filtered" and search:
        search_norm = normalize(search)
        results = index.search(search_norm, top_k=len(unique_products))
        products = [r["entry"]["product"] for r in results]
    elif scope == "slice":
        products = unique_products[offset : offset + limit]
    else:
        products = unique_products

    # 2. Filter columns if requested
    if columns:
        col_list = [c.strip() for c in columns.split(",") if c.strip()]
        def filter_cols(p_item):
            p = enrich_product_image_status(p_item)
            res = {}
            for col in col_list:
                if col == "image_name" or col == "local_image_name":
                    res[col] = p.get("local_image_name") or ""
                    continue
                if col == "brand_id":
                    res[col] = get_brand_id(p)
                    continue
                if col == "category_id":
                    res[col] = get_category_id(p)
                    continue
                if col == "sub_category_id":
                    res[col] = get_sub_category_id(p)
                    continue
                if col == "sub_sub_category_id":
                    res[col] = get_sub_sub_category_id(p)
                    continue
                if col in p:
                    val = p[col]
                    if isinstance(val, dict):
                        res[col] = val.get("name") or val.get("title_en") or json.dumps(val)
                    else:
                        res[col] = val
            return res
        products = [filter_cols(p) for p in products]
    else:
        def flatten_item(p_item):
            p = enrich_product_image_status(p_item)
            item = p.copy()
            if isinstance(item.get("brand"), dict):
                item["brand"] = item["brand"].get("name")
            if isinstance(item.get("category"), dict):
                item["category"] = item["category"].get("name")
            item["brand_id"] = get_brand_id(p)
            item["category_id"] = get_category_id(p)
            item["sub_category_id"] = get_sub_category_id(p)
            item["sub_sub_category_id"] = get_sub_sub_category_id(p)
            item["image_name"] = p.get("local_image_name") or ""
            item["local_image_name"] = p.get("local_image_name") or ""
            return item
        products = [flatten_item(p) for p in products]

    # 3. Stream appropriate format
    if format == "json":
        def json_generator():
            yield "[\n"
            for idx, p in enumerate(products):
                comma = ",\n" if idx < len(products) - 1 else "\n"
                yield json.dumps(p, ensure_ascii=False) + comma
            yield "]"
        
        headers = {
            "Content-Disposition": 'attachment; filename="chefaa_products_export.json"',
            "Content-Type": "application/json"
        }
        return StreamingResponse(json_generator(), headers=headers)
        
    elif format == "txt":
        def txt_generator():
            headers = list(products[0].keys()) if products else []
            yield "\t".join(headers) + "\n"
            for p in products:
                yield "\t".join(str(p.get(h, "")) for h in headers) + "\n"
                
        headers = {
            "Content-Disposition": 'attachment; filename="chefaa_products_export.txt"',
            "Content-Type": "text/tab-separated-values; charset=utf-8"
        }
        return StreamingResponse(txt_generator(), headers=headers)
        
    elif format == "xlsx":
        output = io.BytesIO()
        df = pd.DataFrame(products)
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Chefaa Products")
        output.seek(0)
        
        headers = {
            "Content-Disposition": 'attachment; filename="chefaa_products_export.xlsx"',
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        return StreamingResponse(
            io.BytesIO(output.read()), 
            headers=headers
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")

class MediaExportRequest(BaseModel):
    media_types: List[str]
    image_names: Optional[List[str]] = None

@app.post("/db/export/media")
async def export_media(req: MediaExportRequest):
    media_types = req.media_types or []
    image_names_set = set(req.image_names) if req.image_names else None
    
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        # Check products directory
        if "products" in media_types:
            prod_dir = os.path.join(project_root, "data", "media", "products")
            if os.path.exists(prod_dir):
                for filename in os.listdir(prod_dir):
                    file_path = os.path.join(prod_dir, filename)
                    if os.path.isfile(file_path):
                        if image_names_set is None or filename in image_names_set:
                            zipf.write(file_path, os.path.join("products", filename))
                            
        # Check brands directory
        if "brands" in media_types:
            brand_dir = os.path.join(project_root, "data", "media", "brands")
            if os.path.exists(brand_dir):
                for filename in os.listdir(brand_dir):
                    file_path = os.path.join(brand_dir, filename)
                    if os.path.isfile(file_path):
                        if image_names_set is None or filename in image_names_set:
                            zipf.write(file_path, os.path.join("brands", filename))
                            
        if not zipf.namelist():
            zipf.writestr("info.txt", "No matching local images found for the export.")
                            
    zip_buffer.seek(0)
    
    headers = {
        "Content-Disposition": 'attachment; filename="chefaa_media_export.zip"',
        "Content-Type": "application/zip"
    }
    return StreamingResponse(zip_buffer, headers=headers)

# =====================================================================
# TAXONOMY DRILLDOWN & BRAND/CATEGORY ADVANCED METADATA EXPORTS
# =====================================================================

@app.get("/db/categories/taxonomy")
async def get_categories_taxonomy():
    global raw_products
    if not raw_products:
        db_to_load = DEFAULT_DB_PATH
        if os.path.exists(db_to_load):
            try:
                with open(db_to_load, "r", encoding="utf-8") as f:
                    raw_products = json.load(f)
            except:
                pass
    if not raw_products:
        raise HTTPException(status_code=503, detail="Database not loaded")
    
    tree = {}
    for prod in raw_products:
        if not isinstance(prod, dict):
            continue
            
        l1 = prod.get("level_one_category")
        l1_slug = None
        if l1 and isinstance(l1, dict):
            l1_slug = l1.get("slug")
            if l1_slug:
                if l1_slug not in tree:
                    tree[l1_slug] = {
                        "name": l1.get("title_en") or l1.get("title_ar") or l1_slug,
                        "slug": l1_slug,
                        "level": 1,
                        "parent_slug": None,
                        "count": 0,
                        "children": {}
                    }
                tree[l1_slug]["count"] += 1

        l2_list = prod.get("level_two_category") or []
        if isinstance(l2_list, dict):
            l2_list = [l2_list]
        elif not isinstance(l2_list, list):
            l2_list = []
            
        for l2 in l2_list:
            if l2 and isinstance(l2, dict):
                l2_slug = l2.get("slug")
                if l1_slug and l2_slug:
                    if l2_slug not in tree[l1_slug]["children"]:
                        tree[l1_slug]["children"][l2_slug] = {
                            "name": l2.get("title_en") or l2.get("title_ar") or l2_slug,
                            "slug": l2_slug,
                            "level": 2,
                            "parent_slug": l1_slug,
                            "count": 0,
                            "children": {}
                        }
                    tree[l1_slug]["children"][l2_slug]["count"] += 1

                l3_list = prod.get("level_three_category") or []
                if isinstance(l3_list, dict):
                    l3_list = [l3_list]
                elif not isinstance(l3_list, list):
                    l3_list = []
                    
                for l3 in l3_list:
                    if l3 and isinstance(l3, dict):
                        l3_slug = l3.get("slug")
                        if l1_slug and l2_slug and l3_slug:
                            if l3_slug not in tree[l1_slug]["children"][l2_slug]["children"]:
                                tree[l1_slug]["children"][l2_slug]["children"][l3_slug] = {
                                    "name": l3.get("title_en") or l3.get("title_ar") or l3_slug,
                                    "slug": l3_slug,
                                    "level": 3,
                                    "parent_slug": l2_slug,
                                    "count": 0
                                }
                            tree[l1_slug]["children"][l2_slug]["children"][l3_slug]["count"] += 1

    formatted_tree = []
    for l1_node in sorted(tree.values(), key=lambda x: x["count"], reverse=True):
        l1_copy = l1_node.copy()
        l2_nodes = []
        for l2_node in sorted(l1_node["children"].values(), key=lambda x: x["count"], reverse=True):
            l2_copy = l2_node.copy()
            l3_nodes = sorted(l2_node["children"].values(), key=lambda x: x["count"], reverse=True)
            l2_copy["children"] = l3_nodes
            l2_nodes.append(l2_copy)
        l1_copy["children"] = l2_nodes
        formatted_tree.append(l1_copy)
        
    return formatted_tree

@app.get("/db/export/brands")
async def export_brands(
    format: str = Query(...),
    scope: str = Query(...),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    columns: Optional[str] = Query(None)
):
    global raw_products
    if not raw_products:
        db_to_load = DEFAULT_DB_PATH
        if os.path.exists(db_to_load):
            try:
                with open(db_to_load, "r", encoding="utf-8") as f:
                    raw_products = json.load(f)
            except:
                pass
    if not raw_products:
        raise HTTPException(status_code=503, detail="Database not loaded")

    brands_map = {}
    for prod in raw_products:
        if not isinstance(prod, dict):
            continue
        brand = prod.get("brands")
        if brand and isinstance(brand, dict):
            b_slug = brand.get("slug")
            name = brand.get("title_en") or brand.get("title_ar")
            if name:
                name = name.strip()
                if name not in brands_map:
                    brands_map[name] = {
                        "id": brand.get("id"),
                        "name_en": brand.get("title_en", "").strip() if brand.get("title_en") else "",
                        "name_ar": brand.get("title_ar", "").strip() if brand.get("title_ar") else "",
                        "name": name,
                        "slug": b_slug,
                        "image": brand.get("images") or brand.get("image"),
                        "count": 0
                    }
                brands_map[name]["count"] += 1

    brands_list = [enrich_brand_image(b) for b in brands_map.values()]
    brands_list.sort(key=lambda x: x["count"], reverse=True)

    if scope == "slice":
        export_data = brands_list[offset : offset + limit]
    else:
        export_data = brands_list

    if columns:
        col_list = [c.strip() for c in columns.split(",") if c.strip()]
        filtered_data = []
        for item in export_data:
            filtered_item = {}
            for col in col_list:
                if col in item:
                    filtered_item[col] = item[col]
            filtered_data.append(filtered_item)
        export_data = filtered_data

    if format == "json":
        def json_generator():
            yield "[\n"
            for idx, p in enumerate(export_data):
                comma = ",\n" if idx < len(export_data) - 1 else "\n"
                yield json.dumps(p, ensure_ascii=False) + comma
            yield "]"
        
        headers = {
            "Content-Disposition": 'attachment; filename="chefaa_brands_export.json"',
            "Content-Type": "application/json"
        }
        return StreamingResponse(json_generator(), headers=headers)
        
    elif format == "txt":
        def txt_generator():
            headers = list(export_data[0].keys()) if export_data else []
            yield "\t".join(headers) + "\n"
            for p in export_data:
                yield "\t".join(str(p.get(h, "")) for h in headers) + "\n"
                
        headers = {
            "Content-Disposition": 'attachment; filename="chefaa_brands_export.txt"',
            "Content-Type": "text/tab-separated-values; charset=utf-8"
        }
        return StreamingResponse(txt_generator(), headers=headers)
        
    elif format == "xlsx":
        output = io.BytesIO()
        df = pd.DataFrame(export_data)
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Brands Catalog")
        output.seek(0)
        
        headers = {
            "Content-Disposition": 'attachment; filename="chefaa_brands_export.xlsx"',
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        return StreamingResponse(
            io.BytesIO(output.read()), 
            headers=headers
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")

@app.get("/db/export/categories")
async def export_categories(
    format: str = Query(...),
    scope: str = Query(...),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    levels: Optional[str] = Query(None),
    columns: Optional[str] = Query(None)
):
    global raw_products
    if not raw_products:
        db_to_load = DEFAULT_DB_PATH
        if os.path.exists(db_to_load):
            try:
                with open(db_to_load, "r", encoding="utf-8") as f:
                    raw_products = json.load(f)
            except:
                pass
    if not raw_products:
        raise HTTPException(status_code=503, detail="Database not loaded")

    categories_map = {}
    allowed_levels = [1, 2, 3]
    if levels:
        try:
            allowed_levels = [int(lvl.strip()) for lvl in levels.split(",") if lvl.strip()]
        except ValueError:
            pass

    for prod in raw_products:
        if not isinstance(prod, dict):
            continue

        l1 = prod.get("level_one_category")
        l1_slug = None
        if l1 and isinstance(l1, dict):
            l1_slug = l1.get("slug")
            if l1_slug and 1 in allowed_levels:
                if l1_slug not in categories_map:
                    categories_map[l1_slug] = {
                        "id": l1_slug,
                        "name_en": l1.get("title_en", "").strip(),
                        "name_ar": l1.get("title_ar", "").strip(),
                        "slug": l1_slug,
                        "level": 1,
                        "parent_slug": "",
                        "count": 0
                    }
                categories_map[l1_slug]["count"] += 1

        l2_list = prod.get("level_two_category") or []
        if isinstance(l2_list, dict):
            l2_list = [l2_list]
        elif not isinstance(l2_list, list):
            l2_list = []
            
        for l2 in l2_list:
            if l2 and isinstance(l2, dict):
                l2_slug = l2.get("slug")
                if l2_slug and 2 in allowed_levels:
                    if l2_slug not in categories_map:
                        categories_map[l2_slug] = {
                            "id": l2_slug,
                            "name_en": l2.get("title_en", "").strip(),
                            "name_ar": l2.get("title_ar", "").strip(),
                            "slug": l2_slug,
                            "level": 2,
                            "parent_slug": l1_slug or "",
                            "count": 0
                        }
                    categories_map[l2_slug]["count"] += 1

                l3_list = prod.get("level_three_category") or []
                if isinstance(l3_list, dict):
                    l3_list = [l3_list]
                elif not isinstance(l3_list, list):
                    l3_list = []
                    
                for l3 in l3_list:
                    if l3 and isinstance(l3, dict):
                        l3_slug = l3.get("slug")
                        if l3_slug and 3 in allowed_levels:
                            if l3_slug not in categories_map:
                                categories_map[l3_slug] = {
                                    "id": l3_slug,
                                    "name_en": l3.get("title_en", "").strip(),
                                    "name_ar": l3.get("title_ar", "").strip(),
                                    "slug": l3_slug,
                                    "level": 3,
                                    "parent_slug": l2_slug or l1_slug or "",
                                    "count": 0
                                }
                            categories_map[l3_slug]["count"] += 1

    categories_list = list(categories_map.values())
    categories_list.sort(key=lambda x: (x["level"], -x["count"]))

    if scope == "slice":
        export_data = categories_list[offset : offset + limit]
    else:
        export_data = categories_list

    if columns:
        col_list = [c.strip() for c in columns.split(",") if c.strip()]
        filtered_data = []
        for item in export_data:
            filtered_item = {}
            for col in col_list:
                if col in item:
                    filtered_item[col] = item[col]
            filtered_data.append(filtered_item)
        export_data = filtered_data

    if format == "json":
        def json_generator():
            yield "[\n"
            for idx, p in enumerate(export_data):
                comma = ",\n" if idx < len(export_data) - 1 else "\n"
                yield json.dumps(p, ensure_ascii=False) + comma
            yield "]"
        
        headers = {
            "Content-Disposition": 'attachment; filename="chefaa_categories_export.json"',
            "Content-Type": "application/json"
        }
        return StreamingResponse(json_generator(), headers=headers)
        
    elif format == "txt":
        def txt_generator():
            headers = list(export_data[0].keys()) if export_data else []
            yield "\t".join(headers) + "\n"
            for p in export_data:
                yield "\t".join(str(p.get(h, "")) for h in headers) + "\n"
                
        headers = {
            "Content-Disposition": 'attachment; filename="chefaa_categories_export.txt"',
            "Content-Type": "text/tab-separated-values; charset=utf-8"
        }
        return StreamingResponse(txt_generator(), headers=headers)
        
    elif format == "xlsx":
        output = io.BytesIO()
        df = pd.DataFrame(export_data)
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Categories Taxonomy")
        output.seek(0)
        
        headers = {
            "Content-Disposition": 'attachment; filename="chefaa_categories_export.xlsx"',
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        return StreamingResponse(
            io.BytesIO(output.read()), 
            headers=headers
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")

# =====================================================================
# SHEFAA CRAWLER CORE BACKGROUND ORCHESTRATION & TELEMETRY STREAMING
# =====================================================================

job_listeners: Dict[str, Set[asyncio.Queue]] = {}

class CrawlRunRequest(BaseModel):
    target: Optional[str] = "products" # products, categories, sub-categories, brands
    category_href: Optional[str] = "all"
    localize: Optional[bool] = False
    country: Optional[str] = "eg"
    lang: Optional[str] = "en"
    deep: Optional[bool] = False
    download: Optional[bool] = False
    include_media: Optional[bool] = False
    stats_only: Optional[bool] = False
    pages: Optional[str] = "1"
    background: Optional[bool] = True
    workers: Optional[int] = 4
    crawl_mode: Optional[str] = "catalog"
    preset: Optional[str] = None
    preset_n: Optional[int] = None
    preset_pages: Optional[int] = None
    use_current_db: Optional[bool] = False

VALID_PRESETS = {
    "all-products", "all-brands", "all-categories",
    "first-n-categories", "n-pages-of-n-categories", "resource-stats"
}

def compile_cli_args(req: CrawlRunRequest, job_id: str, root_path: str) -> List[str]:
    flags = []
    
    if req.preset:
        if req.preset not in VALID_PRESETS:
            raise HTTPException(status_code=422, detail=f"Unknown preset id: '{req.preset}'")
            
        if req.preset == "all-products":
            flags.extend(["--products", "all", "--pages", "all"])
            if req.deep is not False:
                flags.append("--deep")
        elif req.preset == "all-brands":
            flags.append("--brands")
        elif req.preset == "all-categories":
            flags.append("--sub-categories")
        elif req.preset == "first-n-categories":
            n = req.preset_n or 5
            flags.extend(["--products", "all", "--pages", "1", "--category-limit", str(n)])
            if req.deep is not False:
                flags.append("--deep")
        elif req.preset == "n-pages-of-n-categories":
            n = req.preset_n or 5
            p = req.preset_pages or 1
            flags.extend(["--products", "all", "--pages", str(p), "--category-limit", str(n)])
            if req.deep is not False:
                flags.append("--deep")
        elif req.preset == "resource-stats":
            flags.append("--stats-only")
    else:
        # Existing advanced-field logic
        if req.target == "categories":
            flags.append("--categories")
        elif req.target == "sub-categories":
            flags.append("--sub-categories")
        elif req.target == "brands":
            flags.append("--brands")
        elif req.target == "products":
            flags.extend(["--products", req.category_href or "all"])
            
        if req.deep:
            flags.append("--deep")
            
        if req.include_media:
            flags.append("--include-media")
            
        flags.extend(["--pages", str(req.pages or "1")])
        
        if req.download:
            flags.append("--download")
            
        if req.stats_only:
            flags.append("--stats-only")

    # Common flags applied to both modes
    if req.lang == "both":
        flags.extend(["--lang", "en"])
        if "--localize" not in flags:
            flags.append("--localize")
    else:
        flags.extend(["--lang", req.lang or "en"])
        
    flags.extend(["--country", req.country or "eg"])
    
    if req.localize and "--localize" not in flags:
        flags.append("--localize")
        
    flags.extend(["--crawl-mode", req.crawl_mode or "catalog"])
    
    # For Campaign Presets, override workers to 1 if it's the default of 4 (or None) to prevent storefront rate limiting
    workers_val = req.workers
    if req.preset and (workers_val is None or workers_val == 4):
        workers_val = 1
    flags.extend(["--workers", str(workers_val or 4)])
        
    output_path = os.path.join(root_path, "backend", "data", "crawler", "jobs", job_id, "results.json")
    flags.extend(["--output", output_path])
    
    if req.use_current_db:
        flags.append("--use-current-db")
        
    flags.extend(["--mode", "silent"])
    return flags

async def run_crawler_subprocess(job_id: str, cmd_args: List[str], output_path: str, download_media: bool, root_path: str):
    from tools.crawler_db import update_job_pid, update_job_progress, append_job_log, finalize_job, get_job
    
    crawler_dir = os.path.join(root_path, "backend", "tools", "shefaa-crawler")
    cmd = [sys.executable, "-u", os.path.join(crawler_dir, "main.py")] + cmd_args
    print(f"Spawning crawler subprocess: {' '.join(cmd)}")
    
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=crawler_dir
        )
        
        update_job_pid(job_id, proc.pid)
        update_job_progress(job_id, {"current_action": "Crawler process spawned. Crawling catalog..."})
        
        async def read_stream(stream, log_type):
            category_regex = re.compile(r"▶ \[(\d+)/(\d+)\] Crawl Session:\s*(.*?)\s*\((.*?)\)")
            success_regex = re.compile(r"Successfully fetched Page (\d+).*?Found (\d+) products")
            meili_success_regex = re.compile(r"Successfully fetched API Page (\d+).*?Found (\d+) products of (\d+)")
            media_regex = re.compile(r"\[MEDIA\]\s+(\d+)/(\d+)\s+(Downloaded|Failed/Skipped|HTTP 429):\s*(.*)")
            media_complete_regex = re.compile(r"\[MEDIA\] COMPLETE:\s+(\d+)/(\d+)\s+images processed.*?ZIP success:\s*(True|False)")
            
            while True:
                line = await stream.readline()
                if not line:
                    break
                line_str = line.decode("utf-8", errors="replace").strip()
                if not line_str:
                    continue
                
                # Save to logs file
                append_job_log(job_id, line_str)
                
                # Broadcast log to SSE listeners
                if job_id in job_listeners:
                    event_data = json.dumps({"timestamp": datetime.now().isoformat(), "line": line_str})
                    for q in list(job_listeners[job_id]):
                        await q.put(f"event: log\ndata: {event_data}\n\n")
                
                # Telemetry analytics parsing
                cat_match = category_regex.search(line_str)
                if cat_match:
                    curr, total, cat_name, _ = cat_match.groups()
                    prog_update = {
                        "processed_categories": int(curr),
                        "total_categories": int(total),
                        "current_action": f"Scraping category: {cat_name}"
                    }
                    update_job_progress(job_id, prog_update)
                    if job_id in job_listeners:
                        for q in list(job_listeners[job_id]):
                            await q.put(f"event: progress\ndata: {json.dumps(prog_update)}\n\n")
                            
                prod_match = success_regex.search(line_str)
                if prod_match:
                    page_num, count = prod_match.groups()
                    prog_update = {
                        "current_action": f"Scraped page {page_num} containing {count} items"
                    }
                    db_job = get_job(job_id)
                    if db_job:
                        curr_found = db_job["progress"].get("products_found", 0) + int(count)
                        prog_update["products_found"] = curr_found
                    update_job_progress(job_id, prog_update)
                    if job_id in job_listeners:
                        for q in list(job_listeners[job_id]):
                            await q.put(f"event: progress\ndata: {json.dumps(prog_update)}\n\n")
                            
                meili_match = meili_success_regex.search(line_str)
                if meili_match:
                    page_num, count, total_hits = meili_match.groups()
                    prog_update = {
                        "current_action": f"Fetched API index catalog page {page_num} of {total_hits} total"
                    }
                    db_job = get_job(job_id)
                    if db_job:
                        curr_found = db_job["progress"].get("products_found", 0) + int(count)
                        prog_update["products_found"] = curr_found
                    else:
                        prog_update["products_found"] = int(count)
                    update_job_progress(job_id, prog_update)
                    if job_id in job_listeners:
                        for q in list(job_listeners[job_id]):
                            await q.put(f"event: progress\ndata: {json.dumps(prog_update)}\n\n")

                media_match = media_regex.search(line_str)
                if media_match:
                    curr, total, action, item_name = media_match.groups()
                    from tools.crawler_db import update_media_progress
                    update_media_progress(job_id, int(curr))
                    prog_update = {
                        "images_completed": int(curr),
                        "images_total": int(total),
                        "media_status": "running",
                        "current_action": f"Downloading image: {item_name}"
                    }
                    if job_id in job_listeners:
                        for q in list(job_listeners[job_id]):
                            await q.put(f"event: progress\ndata: {json.dumps(prog_update)}\n\n")

                media_comp_match = media_complete_regex.search(line_str)
                if media_comp_match:
                    curr, total, zip_status = media_comp_match.groups()
                    from tools.crawler_db import finalize_media_phase
                    status_str = "completed" if zip_status == "True" else "failed"
                    zip_file_path = os.path.join(os.path.dirname(output_path), "media.zip") if zip_status == "True" else None
                    finalize_media_phase(job_id, status_str, zip_file_path)
                    prog_update = {
                        "images_completed": int(curr),
                        "images_total": int(total),
                        "media_status": status_str,
                        "current_action": f"Image downloading complete. Zip created: {zip_status}"
                    }
                    if job_id in job_listeners:
                        for q in list(job_listeners[job_id]):
                            await q.put(f"event: progress\ndata: {json.dumps(prog_update)}\n\n")
        
        await asyncio.gather(
            read_stream(proc.stdout, "stdout"),
            read_stream(proc.stderr, "stderr")
        )
        
        return_code = await proc.wait()
        
        if return_code == 0:
            # Parse completed results file to update final stats in SQLite DB
            final_count = 0
            if os.path.exists(output_path):
                try:
                    with open(output_path, "r", encoding="utf-8") as f:
                        results_data = json.load(f)
                        if isinstance(results_data, list):
                            final_count = len(results_data)
                except Exception as parse_err:
                    print(f"Failed to parse final results JSON: {parse_err}")
            
            # Fetch current job target
            db_job = get_job(job_id)
            target_type = db_job["target"] if db_job else "items"
            
            # Formulate final progress stats
            if target_type in ["categories", "sub-categories"]:
                final_progress = {
                    "processed_categories": final_count,
                    "total_categories": final_count,
                    "products_found": 0,
                    "current_action": f"Scrape completed. Processed {final_count} {target_type}."
                }
            else:
                final_progress = {
                    "processed_categories": 0,
                    "total_categories": 0,
                    "products_found": final_count,
                    "current_action": f"Scrape completed. Found {final_count} {target_type}."
                }
            update_job_progress(job_id, final_progress)

            media_zip_path = None
            if download_media and os.path.exists(output_path):
                try:
                    zip_file_path = os.path.join(os.path.dirname(output_path), "media.zip")
                    global_media_dir = os.path.join(root_path, "backend", "data", "media")
                    
                    if os.path.exists(global_media_dir):
                        with zipfile.ZipFile(zip_file_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                            written = 0
                            for root, _, files in os.walk(global_media_dir):
                                for file in files:
                                    full_file_path = os.path.join(root, file)
                                    rel_path = os.path.relpath(full_file_path, global_media_dir)
                                    zipf.write(full_file_path, rel_path)
                                    written += 1
                            if written > 0:
                                media_zip_path = zip_file_path
                except Exception as zip_err:
                    print(f"Failed to zip media assets: {zip_err}")
            
            finalize_job(job_id, "completed", output_path=output_path, media_zip=media_zip_path)
            
            if job_id in job_listeners:
                event_data = json.dumps({"status": "completed", "output_path": output_path})
                for q in list(job_listeners[job_id]):
                    await q.put(f"event: complete\ndata: {event_data}\n\n")
        else:
            # Check if we have partially gathered results
            part_output_path = output_path if os.path.exists(output_path) and os.path.getsize(output_path) > 2 else None
            
            # Update final progress counts from the partially gathered file
            if part_output_path:
                try:
                    with open(part_output_path, "r", encoding="utf-8") as f:
                        results_data = json.load(f)
                        if isinstance(results_data, list):
                            final_count = len(results_data)
                            db_job = get_job(job_id)
                            target_type = db_job["target"] if db_job else "items"
                            if target_type in ["categories", "sub-categories"]:
                                final_progress = {
                                    "processed_categories": final_count,
                                    "total_categories": final_count,
                                    "products_found": 0,
                                    "current_action": f"Stopped. Gathered {final_count} {target_type} during session."
                                }
                            else:
                                final_progress = {
                                    "processed_categories": 0,
                                    "total_categories": 0,
                                    "products_found": final_count,
                                    "current_action": f"Stopped. Gathered {final_count} {target_type} during session."
                                }
                            update_job_progress(job_id, final_progress)
                except Exception:
                    pass
            
            # Check if job was manually stopped by user
            db_job = get_job(job_id)
            is_stopped = db_job and db_job.get("status") == "stopped"
            final_status = "stopped" if is_stopped else "failed"
            final_error = db_job.get("error_msg") if is_stopped else f"Subprocess terminated with non-zero exit code {return_code}"
            
            finalize_job(job_id, final_status, output_path=part_output_path, error_msg=final_error)
            if job_id in job_listeners:
                event_data = json.dumps({
                    "status": final_status, 
                    "message": final_error, 
                    "output_path": part_output_path
                })
                for q in list(job_listeners[job_id]):
                    await q.put(f"event: error\ndata: {event_data}\n\n")
                    
    except Exception as e:
        print(f"Crawler subprocess runner crashed: {str(e)}")
        part_output_path = output_path if os.path.exists(output_path) and os.path.getsize(output_path) > 2 else None
        finalize_job(job_id, "failed", output_path=part_output_path, error_msg=str(e))
        if job_id in job_listeners:
            event_data = json.dumps({
                "status": "failed", 
                "message": str(e), 
                "output_path": part_output_path
            })
            for q in list(job_listeners[job_id]):
                await q.put(f"event: error\ndata: {event_data}\n\n")

@app.post("/api/crawler/run")
async def run_crawler(req: CrawlRunRequest):
    from tools.crawler_db import create_job, get_job
    job_id = str(uuid.uuid4())
    
    output_dir = os.path.join(workspace_root, "backend", "data", "crawler", "jobs", job_id)
    os.makedirs(output_dir, exist_ok=True)
    
    cmd_args = compile_cli_args(req, job_id, workspace_root)
    output_path = os.path.join(output_dir, "results.json")
    
    resolved_target = req.target or "products"
    if req.preset:
        if req.preset in ["all-products", "first-n-categories", "n-pages-of-n-categories"]:
            resolved_target = "products"
        elif req.preset == "all-brands":
            resolved_target = "brands"
        elif req.preset == "all-categories":
            resolved_target = "sub-categories"
        elif req.preset == "resource-stats":
            resolved_target = "products"
            
    create_job(job_id, resolved_target, req.dict(), crawl_mode=req.crawl_mode or "catalog")
    
    if req.background:
        asyncio.create_task(
            run_crawler_subprocess(job_id, cmd_args, output_path, req.download or False, workspace_root)
        )
        return {
            "job_id": job_id,
            "status": "running",
            "message": "Crawl campaign initiated in the background successfully."
        }
    else:
        await run_crawler_subprocess(job_id, cmd_args, output_path, req.download or False, workspace_root)
        return get_job(job_id)

@app.post("/api/crawler/jobs/{job_id}/fetch-media")
async def fetch_media_for_job(job_id: str):
    from tools.crawler_db import get_job, start_media_phase, finalize_media_phase
    
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job["status"] != "completed":
        raise HTTPException(status_code=422, detail="Cannot download images for an incomplete catalog harvest.")
        
    if job.get("media_status") in ["running", "completed"]:
        raise HTTPException(status_code=409, detail=f"Media extraction is already in state: {job.get('media_status')}")
        
    output_path = job.get("output_path")
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=422, detail="Products results.json not found on disk.")
        
    # Read product catalog to determine total image count
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            catalog = json.load(f)
        images_total = len(catalog) if isinstance(catalog, list) else 0
    except Exception:
        images_total = job["progress"].get("products_found", 0)
        
    # Mark media extraction as starting/running
    start_media_phase(job_id, images_total)
    
    # Spawn background subprocess for --crawl-mode media
    cmd_args = [
        "--crawl-mode", "media",
        "--source", output_path,
        "--workers", "2",
        "--mode", "silent"
    ]
    if job["params"].get("localize"):
        cmd_args.append("--localize")
        
    asyncio.create_task(
        run_crawler_subprocess(job_id, cmd_args, output_path, False, workspace_root)
    )
    
    return {
        "job_id": job_id,
        "status": "media_running",
        "message": f"Media extraction subprocess launched for {images_total} items."
    }

@app.get("/api/crawler/diagnose")
async def diagnose_crawler(country: str = "eg"):
    import urllib.request
    index = f"products_{country.lower()}"
    if country.lower() == 'ae':
        index = "products_eg"
        
    url = f"https://meilisearch.chefaa.com/indexes/{index}/search"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': 'Bearer aa66bf66db30dea9b9746c8f6397d7a0112a055c70d80527b300c3dec85fcc41',
        'Content-Type': 'application/json'
    }
    
    try:
        data = {
            'q': '',
            'limit': 0,
            'facets': ['level_one_category.slug']
        }
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
        
        # Read response synchronously inside a run_in_executor to avoid blocking the main async loop
        def fetch_meili_stats():
            with urllib.request.urlopen(req, timeout=10) as res:
                return json.loads(res.read().decode('utf-8'))
                
        loop = asyncio.get_event_loop()
        parsed = await loop.run_in_executor(None, fetch_meili_stats)
        counts = parsed.get('facetDistribution', {}).get('level_one_category.slug', {})
        
        # Resolve category English & Arabic names dynamically using importlib to satisfy static linters
        import importlib.util
        crawler_dir = os.path.join(workspace_root, "backend", "tools", "shefaa-crawler")
        spec = importlib.util.spec_from_file_location("crawler_main", os.path.join(crawler_dir, "main.py"))
        crawler_main = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(crawler_main)
        scrape_categories_localized = crawler_main.scrape_categories_localized
        
        def fetch_categories_localized():
            try:
                return scrape_categories_localized(include_sub=False, country=country)
            except Exception:
                return []
                
        cats = await loop.run_in_executor(None, fetch_categories_localized)
        
        categories_summary = []
        total_sum = 0
        for cat_slug, count in counts.items():
            total_sum += count
            name_en = cat_slug.replace("-", " ").title()
            name_ar = "N/A"
            for c in cats:
                href_val = c.get('href_slug') or c.get('href', '')
                c_slug = href_val.strip('/').split('/')[-1] if href_val else ''
                if c_slug == cat_slug:
                    name_en = c.get('names', {}).get('en') or c.get('name') or name_en
                    name_ar = c.get('names', {}).get('ar') or name_ar
                    break
            categories_summary.append({
                "slug": cat_slug,
                "name_en": name_en,
                "name_ar": name_ar,
                "count": count
            })
            
        # Each document in Meilisearch has a unique slug and represents a distinct product.
        # Now that the crawler has been corrected to crawl both main categories and subcategories,
        # we will successfully harvest all unique products in the database.
        estimated_unique = total_sum
        
        return {
            "success": True,
            "country": country.upper(),
            "total_category_sum": total_sum,
            "estimated_unique_products": estimated_unique,
            "overlap_percentage": 0.0,
            "categories": sorted(categories_summary, key=lambda x: x["count"], reverse=True)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/crawler/jobs")
async def list_crawler_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = None
):
    from tools.crawler_db import get_jobs
    return get_jobs(limit, offset, status)

@app.get("/api/crawler/jobs/{job_id}")
async def get_crawler_job_details(job_id: str):
    from tools.crawler_db import get_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Crawl job campaign not found.")
    return job

@app.post("/api/crawler/jobs/{job_id}/stop")
async def stop_crawler_job(job_id: str):
    from tools.crawler_db import get_job, update_job_status
    import signal
    
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job["status"] not in ["running", "pending"]:
        return {"status": job["status"], "message": "Job is not actively running"}
        
    pid = job.get("pid")
    if pid:
        try:
            if sys.platform == "win32":
                os.system(f"taskkill /F /T /PID {pid}")
            else:
                os.kill(pid, signal.SIGKILL)
        except Exception as kill_err:
            print(f"Failed to terminate PID {pid}: {kill_err}")
            
    update_job_status(job_id, "stopped", error_msg="Manually terminated by user.")
    
    if job_id in job_listeners:
        event_data = json.dumps({"status": "stopped", "message": "Manually terminated."})
        for q in list(job_listeners[job_id]):
            await q.put(f"event: complete\ndata: {event_data}\n\n")
            
    return {"status": "stopped", "message": "Crawler subprocess terminated successfully."}

@app.get("/api/crawler/jobs/{job_id}/stream")
async def stream_crawler_job_telemetry(job_id: str):
    from tools.crawler_db import get_job, get_job_logs
    
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    async def sse_event_generator():
        q = asyncio.Queue()
        if job_id not in job_listeners:
            job_listeners[job_id] = set()
        job_listeners[job_id].add(q)
        
        try:
            history = get_job_logs(job_id)
            for line in history:
                clean_line = line.strip()
                event_data = json.dumps({"timestamp": datetime.now().isoformat(), "line": clean_line})
                yield f"event: log\ndata: {event_data}\n\n"
                
            while True:
                event = await q.get()
                yield event
                q.task_done()
                
                current_job = get_job(job_id)
                if current_job and current_job["status"] not in ["running", "pending"] and q.empty():
                    break
        except asyncio.CancelledError:
            pass
        finally:
            if job_id in job_listeners:
                job_listeners[job_id].discard(q)
                if not job_listeners[job_id]:
                    del job_listeners[job_id]
                    
    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")

def flatten_product(prod: dict) -> dict:
    flat = {}
    flat["id"] = prod.get("id") or prod.get("url", "").split("/")[-1]
    flat["url"] = prod.get("url")
    flat["price"] = prod.get("price")
    flat["currency"] = prod.get("currency")
    
    names = prod.get("names", {})
    if names:
        flat["name_en"] = names.get("en")
        flat["name_ar"] = names.get("ar")
    else:
        flat["name"] = prod.get("name")
        
    brand = prod.get("brand")
    if isinstance(brand, dict):
        brand_names = brand.get("names", {})
        flat["brand_id"] = brand.get("id")
        flat["brand_name_en"] = brand_names.get("en") or brand.get("name")
        flat["brand_name_ar"] = brand_names.get("ar")
    elif brand:
        flat["brand"] = brand
        
    cat = prod.get("category")
    if isinstance(cat, dict):
        cat_names = cat.get("names", {})
        flat["category_id"] = cat.get("id")
        flat["category_name_en"] = cat_names.get("en") or cat.get("name")
        flat["category_name_ar"] = cat_names.get("ar")
        
    subcat = prod.get("subcategory")
    if isinstance(subcat, dict):
        subcat_names = subcat.get("names", {})
        flat["subcategory_id"] = subcat.get("id")
        flat["subcategory_name_en"] = subcat_names.get("en") or subcat.get("name")
        flat["subcategory_name_ar"] = subcat_names.get("ar")
        
    flat["description"] = prod.get("description")
    
    overview = prod.get("overview")
    if isinstance(overview, dict):
        flat["overview_en"] = overview.get("en")
        flat["overview_ar"] = overview.get("ar")
    elif overview:
        flat["overview"] = overview
        
    specs = prod.get("specification", {})
    for k, v in specs.items():
        flat[f"spec_{k}"] = v
        
    return flat

@app.get("/api/crawler/jobs/{job_id}/download")
async def download_crawler_data(job_id: str, format: str = Query("json")):
    from tools.crawler_db import get_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    output_path = job.get("output_path")
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Scraped dataset file not found.")
        
    if format == "json":
        return FileResponse(
            output_path, 
            media_type="application/json", 
            filename=f"chefaa_scraped_{job_id}.json"
        )
        
    elif format == "excel":
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
                
            if isinstance(raw_data, list):
                flattened = [flatten_product(p) for p in raw_data]
                df = pd.DataFrame(flattened)
            else:
                df = pd.json_normalize(raw_data)
                
            excel_io = io.BytesIO()
            with pd.ExcelWriter(excel_io, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Scraped Products")
            excel_io.seek(0)
            
            return StreamingResponse(
                excel_io,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename=chefaa_scraped_{job_id}.xlsx"}
            )
        except Exception as excel_err:
            raise HTTPException(status_code=500, detail=f"Failed to generate Excel sheet: {str(excel_err)}")
            
    elif format == "media":
        media_zip = job.get("media_zip")
        if not media_zip or not os.path.exists(media_zip):
            raise HTTPException(status_code=404, detail="No media ZIP archive exists for this campaign.")
        return FileResponse(
            media_zip, 
            media_type="application/zip", 
            filename=f"chefaa_media_{job_id}.zip"
        )
        
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported download format: {format}")

@app.get("/api/crawler/jobs/{job_id}/products")
async def get_crawler_job_products(
    job_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    category: Optional[str] = None,
    brand: Optional[str] = None
):
    from tools.crawler_db import get_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    output_path = job.get("output_path")
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Dataset not ready or not found.")
        
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            all_products = json.load(f)
            
        if not isinstance(all_products, list):
            all_products = [all_products]
            
        filtered = all_products
        if search:
            q = search.lower()
            filtered = [
                p for p in filtered
                if q in (p.get("name") or "").lower()
                or q in (p.get("names", {}).get("en") or "").lower()
                or q in (p.get("names", {}).get("ar") or "").lower()
                or q in (p.get("id") or "").lower()
            ]
            
        if category:
            cat_slug = category.lower()
            filtered = [
                p for p in filtered
                if (isinstance(p.get("category"), dict) and cat_slug in (p["category"].get("id") or "").lower())
                or (isinstance(p.get("subcategory"), dict) and cat_slug in (p["subcategory"].get("id") or "").lower())
            ]
            
        if brand:
            brand_slug = brand.lower()
            filtered = [
                p for p in filtered
                if isinstance(p.get("brand"), dict) and brand_slug in (p["brand"].get("id") or "").lower()
            ]
            
        paged = filtered[offset : offset + limit]
        return {
            "total": len(filtered),
            "limit": limit,
            "offset": offset,
            "products": paged
        }
    except Exception as read_err:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset: {str(read_err)}")

@app.get("/api/crawler/jobs/{job_id}/products/{product_id}")
async def get_crawler_job_product_details(job_id: str, product_id: str):
    from tools.crawler_db import get_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    output_path = job.get("output_path")
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Dataset not ready or not found.")
        
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            all_products = json.load(f)
            
        if not isinstance(all_products, list):
            all_products = [all_products]
            
        for p in all_products:
            p_id = p.get("id") or p.get("url", "").split("/")[-1]
            if p_id == product_id:
                return p
                
        raise HTTPException(status_code=404, detail="Product not found in this dataset campaign.")
    except HTTPException:
        raise
    except Exception as read_err:
        raise HTTPException(status_code=500, detail=f"Failed to inspect item: {str(read_err)}")

# ==========================================
# DRUG MATCHER BACKGROUND & HISTORY ENDPOINTS
# ==========================================

from pydantic import BaseModel

class OverrideRequest(BaseModel):
    row_index: int
    matched_sku: str
    product_id: str
    user_comment: Optional[str] = None

@app.post("/api/matcher/run")
async def run_matcher_job(
    file: UploadFile = File(...),
    column: Optional[str] = Form(None),
    top: int = Form(5),
    match_threshold: float = Form(0.60),
    review_threshold: float = Form(0.40),
    parallel: bool = Form(True),
    workers: Optional[int] = Form(None),
    background: bool = Form(False)
):
    from tools.matcher_db import create_job
    from tools.matcher_runner import run_matcher_background, job_listeners

    # 1. Read sheet file
    content = await file.read()
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".xlsx", ".xls", ".csv"]:
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {file_ext}")
        
    try:
        if file_ext in [".xlsx", ".xls"]:
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

    # 2. Register job in SQLite database
    job_id = str(uuid.uuid4())
    job_info = create_job(
        job_id=job_id,
        filename=file.filename,
        column_used=column or "",
        match_threshold=match_threshold,
        review_threshold=review_threshold,
        total_rows=len(df)
    )

    # 3. Schedule the worker thread execution
    task = asyncio.create_task(
        run_matcher_background(
            job_id=job_id,
            file_bytes=content,
            file_ext=file_ext,
            column=column,
            top=top,
            match_threshold=match_threshold,
            review_threshold=review_threshold,
            parallel=parallel,
            workers=workers
        )
    )

    # If background, return job details immediately
    if background:
        return job_info

    # Otherwise, stream progress from the job SSE queue in real-time
    async def foreground_event_generator():
        # Await startup slightly so queue registers
        await asyncio.sleep(0.1)
        queue = asyncio.Queue()
        if job_id not in job_listeners:
            job_listeners[job_id] = set()
        job_listeners[job_id].add(queue)
        
        try:
            while True:
                event = await queue.get()
                yield event
                if "event: complete" in event or "event: error" in event:
                    break
        finally:
            job_listeners[job_id].discard(queue)
            if not job_listeners[job_id]:
                job_listeners.pop(job_id, None)

    return StreamingResponse(foreground_event_generator(), media_type="text/event-stream")

@app.get("/api/matcher/jobs")
async def list_matcher_jobs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None)
):
    from tools.matcher_db import get_jobs
    return get_jobs(limit=limit, offset=offset, status=status)

@app.get("/api/matcher/job/{job_id}")
async def get_matcher_job_details(job_id: str):
    from tools.matcher_db import get_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/api/matcher/job/{job_id}/stop")
async def stop_matcher_job(job_id: str):
    from tools.matcher_db import get_job, finalize_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job["status"] not in ["pending", "running"]:
        return {"status": job["status"], "message": f"Job is already in {job['status']} state."}
        
    finalize_job(job_id, "stopped", error_msg="Job stopped by pharmacist.")
    
    from tools.matcher_runner import job_listeners
    if job_id in job_listeners:
        import json
        stop_payload = json.dumps({"status": "stopped", "message": "Job cancellation request completed."})
        for q in list(job_listeners[job_id]):
            await q.put(f"event: complete\ndata: {stop_payload}\n\n")
            
    return {"status": "stopped", "message": "Job execution stopped successfully."}

@app.get("/api/matcher/job/{job_id}/results")
async def get_matcher_job_results(
    job_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100000),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    from tools.matcher_db import get_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    results_path = job["results_path"]
    if not results_path or not os.path.exists(results_path):
        # Return empty list if processing is still pending
        if job["status"] in ["pending", "running"]:
            return {
                "job_id": job_id,
                "total": 0,
                "limit": limit,
                "offset": offset,
                "results": []
            }
        raise HTTPException(status_code=404, detail="Job results file not found")
        
    try:
        with open(results_path, "r", encoding="utf-8") as f:
            all_results = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read results: {str(e)}")
        
    filtered_results = []
    for item in all_results:
        if search:
            q_lower = search.lower()
            orig_match = q_lower in item.get("original_name", "").lower()
            cand_match = any(q_lower in m.get("name_en", "").lower() for m in item.get("matches", []))
            if not (orig_match or cand_match):
                continue
                
        if status:
            top_status = item["matches"][0]["status"] if item.get("matches") else "no_match"
            if top_status != status:
                continue
                
        filtered_results.append(item)
        
    paginated = filtered_results[offset : offset + limit]
    
    return {
        "job_id": job_id,
        "total": len(filtered_results),
        "limit": limit,
        "offset": offset,
        "results": paginated
    }

@app.post("/api/matcher/job/{job_id}/override")
async def override_matcher_match(job_id: str, req: OverrideRequest):
    from tools.matcher_db import get_job, update_job_totals
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    results_path = job["results_path"]
    if not results_path or not os.path.exists(results_path):
        raise HTTPException(status_code=404, detail="Job results file not found")
        
    try:
        with open(results_path, "r", encoding="utf-8") as f:
            all_results = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read results: {str(e)}")
        
    # Find matching row index
    target_item = None
    for item in all_results:
        if item["row_index"] == req.row_index:
            target_item = item
            break
            
    if not target_item:
        raise HTTPException(status_code=404, detail=f"Row index {req.row_index} not found in results")
        
    global index
    product_data = None
    variant_data = None
    
    if index:
        for item_entry in index.data:
            prod = item_entry["product"]
            var = item_entry["variant"]
            if var.get("sku") == req.matched_sku or prod.get("id") == req.product_id:
                product_data = prod
                variant_data = var
                break
                
    if not product_data:
        product_data = {"id": req.product_id, "name_en": "Manual Match Override"}
        variant_data = {"sku": req.matched_sku, "price": 0.0}
        
    new_candidate = {
        "score": 1.0,
        "status": "matched",
        "id": product_data.get("id"),
        "sku": variant_data.get("sku"),
        "name_en": product_data.get("name_en"),
        "price": variant_data.get("price"),
        "variant_id": variant_data.get("id"),
        "image": variant_data.get("image") or product_data.get("image"),
        "db_normalized": "",
        "jaccard": 1.0,
        "sequence": 1.0,
        "matched_tokens": [],
        "unmatched_query_tokens": [],
        "unmatched_db_tokens": [],
        "candidate_count": 1,
        "product_data": enrich_product_image_status(product_data),
        "variant_data": variant_data,
        "comment": req.user_comment
    }
    
    # Save target overridden details
    target_item["matches"] = [new_candidate] + [m for m in target_item["matches"] if m.get("sku") != req.matched_sku]
    
    try:
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write results file: {str(e)}")
        
    matched_count = 0
    review_count = 0
    no_match_count = 0
    
    for item in all_results:
        top_status = item["matches"][0]["status"] if item.get("matches") else "no_match"
        if top_status == "matched":
            matched_count += 1
        elif top_status == "review":
            review_count += 1
        else:
            no_match_count += 1
            
    update_job_totals(job_id, matched_count, review_count, no_match_count)
    
    # Recompile Excel sheet
    try:
        excel_records = []
        for res in all_results:
            top_match = res["matches"][0] if res["matches"] else None
            status = top_match["status"] if top_match else "no_match"
            score = top_match["score"] if top_match else 0.0
            
            p = top_match.get("product_data", {}) if top_match else {}
            v = top_match.get("variant_data", {}) if top_match else {}
            
            record = {
                "original_name": res["original_name"],
                "normalized_name": res["normalized_name"],
                "match_status": status,
                "match_score": f"{score * 100:.1f}%",
                "matched_product_id": p.get("id", top_match.get("id") if top_match else ""),
                "matched_sku": top_match.get("sku") if top_match else "",
                "matched_name_en": top_match.get("name_en") if top_match else "",
                "catalog_price": v.get("price") or p.get("price") or 0.0,
                "classification_category": p.get("category", {}).get("name") if isinstance(p.get("category"), dict) else p.get("category", ""),
                "brand": p.get("brand", {}).get("name") if isinstance(p.get("brand"), dict) else p.get("brand", ""),
                "in_stock": "Yes" if (v.get("stock", 0) > 0 or p.get("in_stock", True)) else "No",
                "storefront_link": f"https://chefaa.com/product/{p.get('slug')}" if p.get("slug") else ""
            }
            
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
                    
            excel_records.append(record)
            
        excel_out_path = os.path.join(os.path.dirname(results_path), "matched.xlsx")
        df_out = pd.DataFrame(excel_records)
        with pd.ExcelWriter(excel_out_path, engine='openpyxl') as writer:
            df_out.to_excel(writer, index=False, sheet_name="Matched Catalog")
    except Exception as ex_err:
        print(f"Override sheet compiler error: {ex_err}")
        
    return {"status": "ok", "matched_count": matched_count, "review_count": review_count, "no_match_count": no_match_count}

@app.get("/api/matcher/job/{job_id}/stream")
async def stream_matcher_job_progress(job_id: str):
    from tools.matcher_db import get_job
    from tools.matcher_runner import job_listeners
    
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    async def progress_event_generator():
        queue = asyncio.Queue()
        if job_id not in job_listeners:
            job_listeners[job_id] = set()
        job_listeners[job_id].add(queue)
        
        # Immediate state update pushes
        if job["status"] == "completed":
            yield f"event: complete\ndata: {json.dumps({'status': 'completed', 'output_path': job['output_path']})}\n\n"
            job_listeners[job_id].discard(queue)
            return
        elif job["status"] == "failed":
            yield f"event: error\ndata: {json.dumps({'status': 'failed', 'message': job['error_msg']})}\n\n"
            job_listeners[job_id].discard(queue)
            return
            
        try:
            while True:
                event = await queue.get()
                yield event
                if "event: complete" in event or "event: error" in event:
                    break
        finally:
            job_listeners[job_id].discard(queue)
            if not job_listeners[job_id]:
                job_listeners.pop(job_id, None)
                
    return StreamingResponse(progress_event_generator(), media_type="text/event-stream")

@app.get("/api/matcher/job/{job_id}/export")
async def export_matcher_job_file(job_id: str):
    from tools.matcher_db import get_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    output_path = job["output_path"]
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Excel sheet output not ready or not compiled yet.")
        
    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"matched_{job['filename']}"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
