import requests
import json
import os
import sys
import time

BASE_URL = "https://api.alabdellatif-tarshouby.com/api/customer/products/search"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA_DIR = os.path.join(SCRIPT_DIR, "data")

session = requests.Session()
session.headers.update({
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0",
    "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS5hbGFiZGVsbGF0aWYtdGFyc2hvdWJ5LmNvbS9hcGkvY3VzdG9tZXIvaG9tZS9pbml0aWFsaXplIiwiaWF0IjoxNzc4MDY4ODI3LCJleHAiOjM3Nzc4MDY4ODI3LCJuYmYiOjE3NzgwNjg4MjcsImp0aSI6Ijh3aVp5YzdIWTBGNXJZcEkiLCJzdWIiOjE3NjA5NjA4LCJwcnYiOiI0YWMwNTVmMGY4YWMwOGYzNjRjYjRkMDNmYjhlMWY2MzFmZWMzMjJlOCJ9.VnQEvkbVXAkEMbxV-xJ_kdAyh7UwwmLayUi1umsqaiM",
})


def prompt_input(label, default=None):
    prompt_text = f"  {label}"
    if default is not None:
        prompt_text += f" [{default}]: "
    else:
        prompt_text += ": "
    try:
        value = input(prompt_text).strip()
    except EOFError:
        print()
        return default
    if value == "" and default is not None:
        return default
    return value if value != "" else None


def prompt_int(label, default=None):
    raw = prompt_input(label, default)
    if raw is None:
        return None
    try:
        return int(raw)
    except ValueError:
        print(f"    [WARN] Invalid integer '{raw}', skipping.")
        return None


def collect_params():
    print("=" * 60)
    print("  API Search Parameters")
    print("=" * 60)
    print("  Press Enter to skip/accept default.\n")

    page = prompt_int("page (page number)", 1)
    page_size = prompt_int("page_size (items per page)", 50)
    category_id = prompt_int("category_id (filter by category)", None)
    q = prompt_input("q (search query text)", None)
    slug = prompt_input("slug (filter by category slug)", None)
    brand_id = prompt_int("brand_id (filter by brand)", None)

    params = {}
    if page is not None:
        params["page"] = page
    if page_size is not None:
        params["page_size"] = page_size
    if category_id is not None:
        params["category_id"] = category_id
    if q is not None:
        params["q"] = q
    if slug is not None:
        params["slug"] = slug
    if brand_id is not None:
        params["brand_id"] = brand_id

    return params


def collect_output_paths():
    print()
    print("=" * 60)
    print("  Output File Paths")
    print("=" * 60)
    print("  Press Enter to accept default.\n")

    default_products = os.path.join(DEFAULT_DATA_DIR, "products.json")
    default_brands = os.path.join(DEFAULT_DATA_DIR, "brands.json")
    default_categories = os.path.join(DEFAULT_DATA_DIR, "categories.json")

    products_path = prompt_input("Products output file", default_products)
    brands_path = prompt_input("Brands output file", default_brands)
    categories_path = prompt_input("Categories output file", default_categories)

    return products_path, brands_path, categories_path


def fetch_page(params):
    try:
        resp = session.get(BASE_URL, params=params, timeout=86400)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"\n  [ERROR] Request failed: {e}")
        return None


def extract_products(raw_products):
    results = []
    for p in raw_products:
        images = []
        for img in (p.get("images") or []):
            images.append({
                "id": img.get("id"),
                "url": img.get("url"),
                "thumbnail": img.get("thumbnail"),
            })

        variants = []
        for v in (p.get("product_variants") or []):
            variant_images = []
            for img in (v.get("images") or []):
                variant_images.append({
                    "id": img.get("id"),
                    "url": img.get("url"),
                    "thumbnail": img.get("thumbnail"),
                })
            variants.append({
                "id": v.get("id"),
                "name_en": v.get("name_en"),
                "name_ar": v.get("name_ar"),
                "sku": v.get("sku"),
                "price": v.get("price"),
                "discount_price": v.get("discount_price"),
                "stock": v.get("stock"),
                "in_stock": v.get("in_stock"),
                "image": v.get("image"),
                "images": variant_images,
                "options": v.get("options", []),
            })

        results.append({
            "id": p.get("id"),
            "parent_id": p.get("parent_id"),
            "sku": p.get("sku"),
            "name_en": p.get("name_en"),
            "name_ar": p.get("name_ar"),
            "slug": p.get("slug"),
            "image": p.get("image"),
            "images": images,
            "price": p.get("price"),
            "discount_price": p.get("discount_price"),
            "in_stock": p.get("in_stock"),
            "stock": p.get("stock"),
            "active": p.get("active"),
            "category": p.get("category"),
            "brand": p.get("brand"),
            "product_variants": variants,
            "need_prescription": p.get("need_prescription"),
            "share_link": p.get("share_link"),
        })
    return results


def extract_brands(raw_products):
    seen = {}
    for p in raw_products:
        brand = p.get("brand")
        if brand and isinstance(brand, dict) and brand.get("id") not in seen:
            seen[brand["id"]] = {
                "id": brand.get("id"),
                "name": brand.get("name"),
                "name_ar": brand.get("name_ar"),
                "name_en": brand.get("name_en"),
                "image": brand.get("image"),
                "slug": brand.get("slug"),
                "slug_ar": brand.get("slug_ar"),
            }
    return list(seen.values())


def extract_categories(raw_products):
    seen = {}
    for p in raw_products:
        cat = p.get("category")
        if cat and isinstance(cat, dict) and cat.get("id") not in seen:
            seen[cat["id"]] = {
                "id": cat.get("id"),
                "name": cat.get("name"),
                "name_ar": cat.get("name_ar"),
                "slug": cat.get("slug"),
                "slug_ar": cat.get("slug_ar"),
                "sub_categories": cat.get("sub_categories", []),
            }
    return list(seen.values())


def save_json(path, data):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_existing(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []


def merge_by_id(existing, new_items):
    index = {item["id"]: item for item in existing}
    for item in new_items:
        index[item["id"]] = item
    return list(index.values())


def main():
    params = collect_params()
    products_path, brands_path, categories_path = collect_output_paths()

    page_size = params.pop("page_size", 1000)
    start_page = params.pop("page", 1)

    print()
    print("=" * 60)
    print("  Fetching data...")
    print("=" * 60)
    print(f"  URL: {BASE_URL}")
    print(f"  page_size: {page_size}")
    print(f"  start_page: {start_page}")
    print(f"  filters: {json.dumps(params, ensure_ascii=False)}")

    all_raw_products = []
    total = None
    current_page = start_page
    consecutive_errors = 0

    while True:
        page_params = {**params, "page": current_page, "page_size": page_size}
        print(f"\n  [Page {current_page}] Fetching...")

        data = fetch_page(page_params)

        if data is None:
            consecutive_errors += 1
            if consecutive_errors >= 3:
                print(f"  [ABORT] 3 consecutive request failures. Stopping.")
                break
            print(f"  [RETRY] Will retry next page. ({consecutive_errors}/3 errors)")
            current_page += 1
            continue

        consecutive_errors = 0

        code = data.get("code")
        if code != 200:
            print(f"  [ERROR] API returned code {code}: {data.get('message')}")
            break

        payload = data.get("data", {})
        raw_products = payload.get("products", [])

        if total is None:
            total = payload.get("total", 0)
            total_pages = (total + page_size - 1) // page_size
            print(f"  Total products: {total} | Total pages: {total_pages} (page_size={page_size})")

        print(f"  [Page {current_page}] Got {len(raw_products)} products")

        if not raw_products:
            print(f"  [Page {current_page}] Empty page. Done.")
            break

        all_raw_products.extend(raw_products)

        print(f"  [Page {current_page}] Accumulated: {len(all_raw_products)}/{total}")

        existing_products = load_existing(products_path)
        existing_brands = load_existing(brands_path)
        existing_categories = load_existing(categories_path)

        products = extract_products(raw_products)
        brands = extract_brands(raw_products)
        categories = extract_categories(raw_products)

        merged_products = merge_by_id(existing_products, products)
        merged_brands = merge_by_id(existing_brands, brands)
        merged_categories = merge_by_id(existing_categories, categories)

        save_json(products_path, merged_products)
        save_json(brands_path, merged_brands)
        save_json(categories_path, merged_categories)

        current_page += 1

    print()
    print("=" * 60)
    print("  Final Results")
    print("=" * 60)
    print(f"  Products  : {len(all_raw_products)} fetched this run -> {products_path}")
    print(f"  Brands    : -> {brands_path}")
    print(f"  Categories: -> {categories_path}")


if __name__ == "__main__":
    main()
