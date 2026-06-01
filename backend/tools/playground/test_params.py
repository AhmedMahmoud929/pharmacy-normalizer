import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://api.alabdellatif-tarshouby.com/api"

session = requests.Session()
session.headers.update({
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0",
    "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS5hbGFiZGVsbGF0aWYtdGFyc2hvdWJ5LmNvbS9hcGkvY3VzdG9tZXIvaG9tZS9pbml0aWFsaXplIiwiaWF0IjoxNzc4MDY4ODI3LCJleHAiOjM3Nzc4MDY4ODI3LCJuYmYiOjE3NzgwNjg4MjcsImp0aSI6Ijh3aVp5YzdIWTBGNXJZcEkiLCJzdWIiOjE3NjA5NjA4LCJwcnYiOiI0YWMwNTVmMGY4YWMwOGYzNjRjYjRkMDNmYjhlMWY2MzFmZWMzMjJlOCJ9.VnQEvkbVXAkEMbxV-xJ_kdAyh7UwwmLayUi1umsqaiM",
})

CUSTOMER_PRODUCT_ENDPOINTS = [
    "/customer/products/search",
    "/customer/products/featured",
    "/customer/products/latest",
    "/customer/products/best-sellers",
    "/customer/products/recommended",
    "/customer/products/offers",
    "/customer/products/deals",
    "/customer/products/categories",
    "/customer/products/compare",
    "/customer/products/{id}",
]

PARAMS_TO_TEST = [
    ("page", [1, 2, 5, 10, 100, 2760]),
    ("limit", [1, 5, 10, 20, 50, 100]),
    ("per_page", [1, 5, 10, 20, 50]),
    ("pageSize", [5, 10, 20, 50]),
    ("size", [5, 10, 20]),
    ("offset", [0, 10, 20, 50]),
    ("skip", [0, 10, 20]),
    ("take", [5, 10, 20]),
    ("q", ["a", "test", "panadol"]),
    ("query", ["a", "test"]),
    ("keyword", ["a", "test"]),
    ("search", ["a", "test"]),
    ("term", ["a", "test"]),
    ("name", ["a", "test"]),
    ("category_id", [1, 2, 3]),
    ("categoryId", [1, 2, 3]),
    ("category", [1, 2]),
    ("brand_id", [1, 2]),
    ("brandId", [1, 2]),
    ("brand", ["test"]),
    ("price_min", [0, 10]),
    ("price_max", [100, 500]),
    ("min_price", [0, 10]),
    ("max_price", [100, 500]),
    ("sort", ["asc", "desc", "name", "price", "created_at"]),
    ("sort_by", ["name", "price", "created_at"]),
    ("sortBy", ["name", "price", "createdAt"]),
    ("order", ["asc", "desc"]),
    ("orderBy", ["asc", "desc"]),
    ("direction", ["asc", "desc"]),
    ("status", ["active", "available"]),
    ("featured", ["true", "1"]),
    ("available", ["true", "1"]),
    ("in_stock", ["true", "1"]),
    ("store_id", [1]),
    ("storeId", [1]),
    ("type", ["product", "service"]),
    ("lang", ["en", "ar"]),
    ("language", ["en", "ar"]),
    ("locale", ["en", "ar"]),
    ("tag", ["test"]),
    ("tags", ["test"]),
    ("slug", ["test"]),
    ("discount", ["true", "1"]),
    ("on_sale", ["true", "1"]),
    ("rating", [1, 3, 5]),
    ("min_rating", [1, 3]),
    ("subcategory_id", [1, 2]),
    ("sub_category_id", [1, 2]),
    ("parent_id", [1, 2]),
]


def is_real_response(data):
    if isinstance(data, dict) and data.get("code") == 404:
        return False
    return True


def get_baseline(endpoint):
    url = BASE_URL + endpoint
    try:
        params = {"page": 1} if "search" in endpoint else None
        resp = session.get(url, timeout=30, params=params)
        data = resp.json()
        if not is_real_response(data):
            return None
        return {
            "size": len(resp.content),
            "body": data,
            "text": resp.text[:5000],
        }
    except Exception as e:
        print(f"  [ERROR] get_baseline: {e}")
        return None


def test_param(endpoint, param_name, param_value, baseline_size):
    url = BASE_URL + endpoint
    try:
        resp = session.get(url, params={param_name: param_value}, timeout=30)
        data = resp.json()
        if not is_real_response(data):
            return None
        size = len(resp.content)
        changed = abs(size - baseline_size) > 50
        return {
            "param": param_name,
            "value": param_value,
            "size": size,
            "baseline_size": baseline_size,
            "changed": changed,
            "status": "AFFECTS" if changed else "NO EFFECT",
            "preview": resp.text[:300],
        }
    except Exception:
        return None


def main():
    print("=" * 70)
    print("PARAMETER DISCOVERY FOR /customer/products/* ENDPOINTS")
    print("=" * 70)

    for endpoint in CUSTOMER_PRODUCT_ENDPOINTS:
        print(f"\n{'='*60}")
        print(f"ENDPOINT: {endpoint}")
        print(f"{'='*60}")

        baseline = get_baseline(endpoint)
        if baseline is None:
            print(f"  [SKIP] Endpoint not found or returns 404")
            continue

        baseline_size = baseline["size"]
        print(f"  Baseline response size: {baseline_size} bytes")

        body = baseline["body"]
        print(f"  Response keys: {list(body.keys()) if isinstance(body, dict) else type(body)}")

        if isinstance(body, dict):
            for key in ["data", "items", "products", "result", "results"]:
                if key in body:
                    val = body[key]
                    if isinstance(val, list):
                        print(f"  '{key}' is a list with {len(val)} items")
                        if len(val) > 0 and isinstance(val[0], dict):
                            print(f"  '{key}[0]' fields: {list(val[0].keys())}")
                    elif isinstance(val, dict):
                        print(f"  '{key}' keys: {list(val.keys())}")

            for key in ["meta", "pagination", "links", "paginator"]:
                if key in body:
                    print(f"  '{key}': {json.dumps(body[key], ensure_ascii=False)}")

        print(f"\n  --- Testing params ---")

        found_params = {}

        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = []
            for param_name, values in PARAMS_TO_TEST:
                for val in values:
                    futures.append(pool.submit(
                        test_param, endpoint, param_name, val, baseline_size
                    ))

            for future in as_completed(futures):
                result = future.result()
                if result is None:
                    continue
                if result["changed"]:
                    p = result["param"]
                    if p not in found_params:
                        found_params[p] = []
                    found_params[p].append({
                        "value": result["value"],
                        "size": result["size"],
                    })

        if found_params:
            print(f"\n  DISCOVERED PARAMS:")
            for param, details in sorted(found_params.items()):
                sizes = [d["size"] for d in details]
                values = [str(d["value"]) for d in details]
                print(f"    ?{param}")
                print(f"      Values tested: {', '.join(values)}")
                print(f"      Response sizes: {', '.join(str(s) for s in sizes)}")
        else:
            print(f"\n  No params found that affect the response.")

        time.sleep(0.3)

    print(f"\n{'='*70}")
    print("DONE")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
