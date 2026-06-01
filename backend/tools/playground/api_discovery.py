import requests
import time
import json
import argparse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://api.alabdellatif-tarshouby.com/api"

session = requests.Session()
session.headers.update({
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS5hbGFiZGVsbGF0aWYtdGFyc2hvdWJ5LmNvbS9hcGkvY3VzdG9tZXIvaG9tZS9pbml0aWFsaXplIiwiaWF0IjoxNzc4MDY4ODI3LCJleHAiOjM3Nzc4MDY4ODI3LCJuYmYiOjE3NzgwNjg4MjcsImp0aSI6Ijh3aVp5YzdIWTBGNXJZcEkiLCJzdWIiOjE3NjA5NjA4LCJwcnYiOiI0YWMwNWMwZjhhYzA4ZjM2NGNiNGQwM2ZiOGUxZjYzMWZlYzMyMmU4In0.VnQEvkbVXAkEMbxV-xJ_kdAyh7UwwmLayUi1umsqaiM"
})

DOC_PATHS = [
    "/swagger.json", "/swagger/v1/swagger.json", "/swagger-ui.html",
    "/swagger-ui/index.html", "/openapi.json", "/openapi.yaml",
    "/api-docs", "/api-docs.json", "/docs", "/docs/json",
    "/redoc", "/.well-known/openapi.json",
    "/v1/swagger.json", "/v1/api-docs", "/v2/swagger.json",
    "/v2/api-docs", "/v3/api-docs", "/v3/api-docs/swagger-config",
    "/graphql", "/graphiql",
    "/health", "/status", "/info", "/version",
    "/routes", "/endpoints", "/sitemap.xml", "/robots.txt",
]

API_RESOURCE_PATHS = [
    "/customer/products",
    "/customer/products/search",
    "/customer/products/categories",
    "/customer/products/{id}",
    "/customer/products/slug/{slug}",
    "/customer/products/related/{id}",
    "/customer/products/recommended",
    "/customer/products/featured",
    "/customer/products/latest",
    "/customer/products/best-sellers",
    "/customer/products/offers",
    "/customer/products/deals",
    "/customer/products/compare",
    "/customer/categories",
    "/customer/categories/tree",
    "/customer/categories/{id}",
    "/customer/cart",
    "/customer/cart/add",
    "/customer/cart/remove",
    "/customer/cart/clear",
    "/customer/cart/count",
    "/customer/orders",
    "/customer/orders/{id}",
    "/customer/orders/cancel/{id}",
    "/customer/orders/track/{id}",
    "/customer/orders/reorder/{id}",
    "/customer/profile",
    "/customer/profile/update",
    "/customer/profile/avatar",
    "/customer/auth",
    "/customer/login",
    "/customer/register",
    "/customer/logout",
    "/customer/verify",
    "/customer/refresh",
    "/customer/favorites",
    "/customer/wishlist",
    "/customer/wishlist/add",
    "/customer/wishlist/remove/{id}",
    "/customer/reviews",
    "/customer/reviews/product/{id}",
    "/customer/reviews/add",
    "/customer/notifications",
    "/customer/notifications/{id}",
    "/customer/notifications/read",
    "/customer/notifications/read-all",
    "/customer/settings",
    "/customer/addresses",
    "/customer/addresses/{id}",
    "/customer/addresses/default/{id}",
    "/customer/payments",
    "/customer/payments/methods",
    "/customer/search",
    "/customer/search/suggestions",
    "/customer/stores",
    "/customer/stores/{id}",
    "/customer/stores/nearby",
    "/customer/offers",
    "/customer/offers/{id}",
    "/customer/brands",
    "/customer/brands/{id}",
    "/customer/banners",
    "/customer/sliders",
    "/customer/slider",
    "/customer/home",
    "/customer/home/data",
    "/customer/dashboard",
    "/customer/coupons",
    "/customer/coupons/validate",
    "/customer/coupons/apply",
    "/customer/checkout",
    "/customer/checkout/shipping",
    "/customer/checkout/payment",
    "/customer/checkout/confirm",
    "/customer/complaints",
    "/customer/support",
    "/customer/tickets",
    "/customer/tickets/{id}",
    "/customer/transactions",
    "/customer/wallet",
    "/customer/wallet/balance",
    "/customer/wallet/history",
    "/customer/points",
    "/customer/points/balance",
    "/customer/points/history",
    "/customer/loyalty",
    "/customer/referrals",
    "/customer/referrals/code",
    "/customer/returns",
    "/customer/returns/{id}",
    "/customer/returns/request",
    "/customer/ratings",
    "/customer/questions",
    "/customer/compare",
    "/customer/suggestions",
    "/customer/feedback",
    "/customer/contact",
    "/customer/cities",
    "/customer/areas",
    "/customer/countries",
    "/customer/shipping-methods",
    "/customer/payment-methods",
    "/customer/faqs",
    "/customer/pages",
    "/customer/pages/{slug}",
    "/customer/about",
    "/customer/terms",
    "/customer/privacy",
    "/customer/app-config",
    "/customer/config",
    "/admin/products",
    "/admin/products/{id}",
    "/admin/users",
    "/admin/users/{id}",
    "/admin/orders",
    "/admin/orders/{id}",
    "/admin/categories",
    "/admin/categories/{id}",
    "/admin/dashboard",
    "/admin/login",
    "/admin/settings",
    "/admin/stores",
    "/admin/stores/{id}",
    "/admin/offers",
    "/admin/banners",
    "/admin/brands",
    "/admin/coupons",
    "/admin/reports",
    "/admin/analytics",
    "/admin/customers",
    "/admin/inventory",
    "/admin/shipments",
    "/admin/payments",
    "/admin/notifications",
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify",
    "/auth/resend-verification",
    "/auth/social/google",
    "/auth/social/facebook",
    "/auth/social/apple",
    "/products",
    "/products/search",
    "/products/categories",
    "/products/brands",
    "/products/offers",
    "/products/featured",
    "/products/latest",
    "/products/best-sellers",
    "/products/{id}",
    "/categories",
    "/categories/{id}",
    "/categories/tree",
    "/orders",
    "/users",
    "/cart",
    "/search",
    "/stores",
    "/stores/{id}",
    "/brands",
    "/brands/{id}",
    "/offers",
    "/offers/{id}",
    "/banners",
    "/notifications",
    "/settings",
    "/config",
    "/app-config",
    "/lookup",
    "/countries",
    "/cities",
    "/areas",
    "/payment-methods",
    "/shipping-methods",
    "/coupons",
    "/coupons/validate",
    "/faqs",
    "/pages",
    "/pages/{slug}",
    "/about",
    "/contact",
    "/terms",
    "/privacy",
]

HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]

QUERY_PARAMS_MAP = {
    "search": ["q", "query", "keyword", "search", "term", "name", "title"],
    "pagination": ["page", "limit", "per_page", "pageSize", "size", "offset", "skip", "take"],
    "sorting": ["sort", "sort_by", "sortBy", "order", "order_by", "orderBy", "direction"],
    "filter": [
        "category_id", "categoryId", "category", "brand_id", "brandId", "brand",
        "price_min", "price_max", "min_price", "max_price", "price_range",
        "status", "active", "available", "in_stock", "featured",
        "city_id", "area_id", "store_id", "storeId",
        "type", "slug", "id", "tag", "tags", "lang", "language", "locale",
        "subcategory_id", "sub_category_id", "parent_id",
        "min_rating", "rating", "discount", "on_sale",
    ],
}


def is_fake_404(result):
    if result is None:
        return True
    body = result.get("body_preview", "")
    if not body:
        return True
    try:
        data = json.loads(body)
        if isinstance(data, dict) and data.get("code") == 404:
            return True
        if isinstance(data, dict) and "internalMessage" in data and data["internalMessage"] == "Not Found":
            return True
    except (json.JSONDecodeError, ValueError):
        pass
    return False


def probe_url(path, method="GET", params=None):
    url = BASE_URL.rstrip("/") + path
    try:
        resp = session.request(method, url, timeout=8, allow_redirects=True, params=params)
        result = {
            "path": path,
            "method": method,
            "status": resp.status_code,
            "content_type": resp.headers.get("Content-Type", ""),
            "size": len(resp.content),
            "url": resp.url,
            "body_preview": resp.text[:3000] if resp.status_code < 500 else "",
        }
        if is_fake_404(result):
            result["real_status"] = 404
        else:
            result["real_status"] = result["status"]
        return result
    except requests.RequestException:
        return None


def check_docs():
    print("=" * 60)
    print("PHASE 1: Checking Documentation / Spec Endpoints")
    print("=" * 60)
    found = []
    for path in DOC_PATHS:
        result = probe_url(path)
        if result is None or result["real_status"] == 404:
            print(f"  [MISS] {path}")
        else:
            rs = result["real_status"]
            size = result["size"]
            ct = result["content_type"]
            tag = "FOUND" if rs == 200 else "EXISTS"
            print(f"  [{tag}] [{rs}] {path}  ({size} bytes, {ct})")
            found.append(result)
        time.sleep(0.15)
    return found


def check_resources():
    print("\n" + "=" * 60)
    print("PHASE 2: Probing API Resource Endpoints")
    print("=" * 60)
    found = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(probe_url, path): path for path in API_RESOURCE_PATHS}
        for future in as_completed(futures):
            result = future.result()
            if result is None or result["real_status"] == 404:
                continue
            rs = result["real_status"]
            ct = result["content_type"]
            size = result["size"]
            label = {
                200: "OK", 201: "CREATED",
                401: "AUTH", 403: "FORBIDDEN",
                405: "METHOD-NOT-ALLOWED", 422: "UNPROCESSABLE",
            }.get(rs, f"OTHER-{rs}")
            print(f"  [{label}] [{rs}] {result['path']}  ({size} bytes, {ct})")
            found.append(result)
    return found


def check_methods_on_found(found_paths):
    print("\n" + "=" * 60)
    print("PHASE 3: Testing HTTP Methods on Discovered Endpoints")
    print("=" * 60)
    unique_paths = list({r["path"] for r in found_paths})
    results = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = []
        for path in unique_paths:
            for method in HTTP_METHODS:
                futures.append(pool.submit(probe_url, path, method))
        for future in as_completed(futures):
            result = future.result()
            if result and result["real_status"] != 404:
                print(f"  {result['method']:7s} [{result['real_status']}] {result['path']}")
                results.append(result)
    return results


def discover_params(found_endpoints):
    print("\n" + "=" * 60)
    print("PHASE 4: Discovering Query Parameters")
    print("=" * 60)

    real_200 = [r for r in found_endpoints if r["real_status"] == 200]
    if not real_200:
        print("  No 200-OK endpoints to test params on.")
        return {}

    param_results = {}
    all_params = []
    for group, params in QUERY_PARAMS_MAP.items():
        all_params.extend(params)

    for ep in real_200:
        path = ep["path"]
        print(f"\n  Testing params on: {path}")
        param_results[path] = {"working_params": [], "response_structure": None}

        for param in all_params:
            result = probe_url(path, "GET", params={param: "1"})
            if result is None or result["real_status"] == 404:
                continue
            if result["real_status"] == 200 and result["size"] > 0:
                baseline_size = ep["size"]
                if abs(result["size"] - baseline_size) > 50:
                    param_results[path]["working_params"].append({
                        "param": param,
                        "status": result["real_status"],
                        "response_size": result["size"],
                        "baseline_size": baseline_size,
                    })
                    print(f"    -> '{param}' affects response "
                          f"({baseline_size} -> {result['size']})")
            time.sleep(0.1)

        if ep.get("body_preview"):
            try:
                body = json.loads(ep["body_preview"])
                if isinstance(body, dict):
                    param_results[path]["response_structure"] = analyze_structure(body)
            except (json.JSONDecodeError, ValueError):
                pass

    return param_results


def analyze_structure(data, depth=0, max_depth=3):
    if depth > max_depth:
        return "..."
    if isinstance(data, dict):
        result = {}
        for k, v in data.items():
            if isinstance(v, list):
                if len(v) > 0 and isinstance(v[0], dict):
                    result[k] = [analyze_structure(v[0], depth + 1, max_depth)]
                else:
                    result[k] = f"[{type(v[0]).__name__}]" if len(v) > 0 else "[]"
            elif isinstance(v, dict):
                result[k] = analyze_structure(v, depth + 1, max_depth)
            else:
                result[k] = type(v).__name__
        return result
    return type(data).__name__


def analyze_response_bodies(found):
    print("\n" + "=" * 60)
    print("PHASE 5: Analyzing Response Bodies for Hints")
    print("=" * 60)
    hints = []
    for r in found:
        if r.get("body_preview"):
            body = r["body_preview"].lower()
            if any(kw in body for kw in ["swagger", "openapi", "paths", "endpoints", "routes", "handlers"]):
                print(f"\n  {r['path']} contains API metadata:")
                print(f"     {r['body_preview'][:500]}")
                hints.append({"path": r["path"], "preview": r["body_preview"][:500]})
    return hints


def generate_markdown(all_found, method_results, param_results, doc_results, output_path):
    lines = []
    lines.append(f"# API Documentation")
    lines.append(f"")
    lines.append(f"**Base URL:** `https://api.alabdellatif-tarshouby.com/api`")
    lines.append(f"")
    lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"")
    lines.append(f"> Auto-discovered by probing the API. Some endpoints may require authentication.")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")

    seen = set()
    endpoints_list = []
    for r in sorted(all_found, key=lambda x: x["path"]):
        key = r["path"]
        if key not in seen:
            seen.add(key)
            endpoints_list.append(r)

    lines.append(f"## Discovered Endpoints ({len(endpoints_list)})")
    lines.append(f"")
    lines.append(f"| # | Method | Status | Endpoint | Content-Type | Size |")
    lines.append(f"|---|--------|--------|----------|-------------|------|")

    idx = 1
    for r in endpoints_list:
        rs = r["real_status"]
        ct = r["content_type"].split(";")[0] if r["content_type"] else "-"
        size = r["size"]
        path = r["path"]
        status_label = {200: "OK", 201: "Created", 401: "Auth Required", 403: "Forbidden"}.get(rs, str(rs))
        lines.append(f"| {idx} | GET | {status_label} | `{path}` | {ct} | {size} |")
        idx += 1

    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")

    if method_results:
        lines.append(f"## Supported HTTP Methods")
        lines.append(f"")
        methods_by_path = {}
        for r in method_results:
            if r["real_status"] != 404:
                methods_by_path.setdefault(r["path"], []).append({
                    "method": r["method"],
                    "status": r["real_status"],
                    "size": r["size"],
                })

        for path in sorted(methods_by_path.keys()):
            methods_info = methods_by_path[path]
            lines.append(f"### `{path}`")
            lines.append(f"")
            lines.append(f"| Method | Status | Response Size |")
            lines.append(f"|--------|--------|---------------|")
            for mi in sorted(methods_info, key=lambda x: HTTP_METHODS.index(x["method"]) if x["method"] in HTTP_METHODS else 99):
                lines.append(f"| {mi['method']} | {mi['status']} | {mi['size']} |")
            lines.append(f"")

        lines.append(f"---")
        lines.append(f"")

    if param_results:
        lines.append(f"## Query Parameters")
        lines.append(f"")
        for path in sorted(param_results.keys()):
            info = param_results[path]
            working = info.get("working_params", [])
            if working:
                lines.append(f"### `{path}`")
                lines.append(f"")
                lines.append(f"| Parameter | Baseline Size | Response Size | Change |")
                lines.append(f"|-----------|--------------|---------------|--------|")
                for p in working:
                    change = p["response_size"] - p["baseline_size"]
                    change_str = f"+{change}" if change > 0 else str(change)
                    lines.append(f"| `{p['param']}` | {p['baseline_size']} | {p['response_size']} | {change_str} |")
                lines.append(f"")

        lines.append(f"---")
        lines.append(f"")

    lines.append(f"## Response Structures")
    lines.append(f"")
    for path in sorted(param_results.keys()):
        info = param_results[path]
        struct = info.get("response_structure")
        if struct:
            lines.append(f"### `{path}`")
            lines.append(f"")
            lines.append(f"```json")
            lines.append(json.dumps(struct, indent=2, ensure_ascii=False))
            lines.append(f"```")
            lines.append(f"")

    lines.append(f"---")
    lines.append(f"")
    lines.append(f"## Notes")
    lines.append(f"")
    lines.append(f"- The API returns HTTP 200 even for non-existent endpoints, with a JSON body containing `\"code\": 404`")
    lines.append(f"- Endpoints returning 401 require authentication (e.g., Bearer token)")
    lines.append(f"- Endpoints returning 403 are forbidden (authentication + authorization required)")
    lines.append(f"- Response format is JSON with structure: `{{\"message\": \"...\", \"data\": ..., \"code\": ...}}`")
    lines.append(f"")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\n  Docs written to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="API Discovery Tool")
    parser.add_argument("--skip-params", action="store_true", help="Skip query parameter discovery (Phase 4)")
    parser.add_argument("--skip-methods", action="store_true", help="Skip HTTP method testing (Phase 3)")
    parser.add_argument("--skip-docs", action="store_true", help="Skip documentation endpoint checks (Phase 1)")
    parser.add_argument("--output", default="api-docs.md", help="Output markdown file (default: api-docs.md)")
    args = parser.parse_args()

    output_md = args.output
    print(f"Target: {BASE_URL}")
    print(f"Known:  {BASE_URL}/customer/products/search?page=2760")
    print(f"Options: skip_params={args.skip_params}, skip_methods={args.skip_methods}, skip_docs={args.skip_docs}\n")

    doc_results = [] if args.skip_docs else check_docs()
    res_results = check_resources()

    all_found = doc_results + res_results

    method_results = []
    if res_results and not args.skip_methods:
        method_results = check_methods_on_found(res_results)

    param_results = {}
    if not args.skip_params:
        param_results = discover_params(all_found)
    else:
        print("\n  [SKIP] Phase 4: Parameter Discovery (--skip-params)")
        for r in all_found:
            if r.get("body_preview") and r["real_status"] == 200:
                try:
                    body = json.loads(r["body_preview"])
                    if isinstance(body, dict):
                        param_results[r["path"]] = {"working_params": [], "response_structure": analyze_structure(body)}
                except (json.JSONDecodeError, ValueError):
                    pass

    analyze_response_bodies(all_found)

    print("\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)

    seen = set()
    endpoints_list = []
    for r in sorted(all_found, key=lambda x: x["path"]):
        key = r["path"]
        if key not in seen:
            seen.add(key)
            endpoints_list.append(r)
            rs = r["real_status"]
            ct = r["content_type"]
            print(f"  [{rs}] {BASE_URL}{key}  ({ct})")

    print(f"\nTotal discovered: {len(endpoints_list)} endpoints")

    if param_results:
        print("\n--- Parameter Discovery Results ---")
        for path, info in param_results.items():
            if info["working_params"]:
                print(f"\n  {path}:")
                for p in info["working_params"]:
                    print(f"    ?{p['param']}=...  (size: {p['baseline_size']} -> {p['response_size']})")

    if method_results:
        print("\n--- Supported Methods per Endpoint ---")
        methods_by_path = {}
        for r in method_results:
            if r["real_status"] != 404:
                methods_by_path.setdefault(r["path"], []).append(r["method"])
        for path, methods in methods_by_path.items():
            print(f"  {path}: {', '.join(methods)}")

    generate_markdown(all_found, method_results, param_results, doc_results, output_md)


if __name__ == "__main__":
    main()
