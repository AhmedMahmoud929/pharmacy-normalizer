import requests
import json

BASE_URL = "https://api.alabdellatif-tarshouby.com/api"
TOKEN = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS5hbGFiZGVsbGF0aWYtdGFyc2hvdWJ5LmNvbS9hcGkvY3VzdG9tZXIvaG9tZS9pbml0aWFsaXplIiwiaWF0IjoxNzc4MDY4ODI3LCJleHAiOjM3Nzc4MDY4ODI3LCJuYmYiOjE3NzgwNjg4MjcsImp0aSI6Ijh3aVp5YzdIWTBGNXJZcEkiLCJzdWIiOjE3NjA5NjA4LCJwcnYiOiI0YWMwNTVmMGY4YWMwOGYzNjRjYjRkMDNmYjhlMWY2MzFmZWMzMjJlOCJ9.VnQEvkbVXAkEMbxV-xJ_kdAyh7UwwmLayUi1umsqaiM"

session = requests.Session()
session.headers.update({
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0",
    "Authorization": TOKEN,
})

ENDPOINTS = [
    "/customer/products/search?page=1&page_size=10",
    "/customer/products/featured",
    "/customer/products/latest",
    "/customer/products/best-sellers",
    "/customer/products/recommended",
    "/customer/products/offers",
    "/customer/products/deals",
    "/customer/products/categories",
    "/customer/products/compare",
    "/customer/brands",
    "/customer/orders",
    "/customer/profile",
    "/customer/auth",
    "/customer/settings",
    "/customer/notifications",
    "/customer/pages",
    "/customer/stores",
    "/customer/wallet",
    "/admin/dashboard",
    "/admin/products",
    "/admin/categories",
    "/admin/customers",
    "/admin/brands",
    "/admin/orders",
    "/categories",
    "/cities",
]


def is_error_response(data):
    if isinstance(data, dict):
        if data.get("code") == 404:
            return True
        if "errors" in data and data.get("code") and data.get("code") != 200:
            return True
    return False


def fetch_endpoint(endpoint):
    url = BASE_URL + endpoint
    try:
        resp = session.get(url, timeout=30)
        data = resp.json()
        if is_error_response(data):
            return None, data
        return data, None
    except Exception as e:
        return None, {"error": str(e)}


def main():
    print("=" * 70)
    print("CHECKING ALL ENDPOINTS WITH AUTH TOKEN...")
    print("=" * 70)

    available = []

    for ep in ENDPOINTS:
        data, err = fetch_endpoint(ep)
        if data is not None:
            size = len(json.dumps(data))
            code = data.get("code", "?")
            msg = data.get("message", "")[:60]
            keys = list(data.get("data", {}).keys()) if isinstance(data.get("data"), dict) else []
            if isinstance(data.get("data"), list):
                keys = [f"list[{len(data['data'])}]"]
            available.append({
                "endpoint": ep,
                "size": size,
                "code": code,
                "message": msg,
                "data_keys": keys,
                "data": data,
            })
            print(f"  [OK] [{code}] {ep:50s} ({size:,} bytes) keys={keys[:5]}")
        else:
            err_code = err.get("code", "?") if isinstance(err, dict) else "?"
            err_msg = err.get("message", "")[:50] if isinstance(err, dict) else str(err)[:50]
            print(f"  [--] [{err_code}] {ep:50s} {err_msg}")

    if not available:
        print("\nNo endpoints returned valid data.")
        return

    while True:
        print("\n" + "=" * 70)
        print("AVAILABLE ENDPOINTS (with auth token)")
        print("=" * 70)
        for i, ep in enumerate(available, 1):
            print(f"  {i:2d}. {ep['endpoint']}")
            print(f"      code={ep['code']}, size={ep['size']:,} bytes, keys={ep['data_keys'][:6]}")

        print(f"\n  0. Exit")
        print()

        try:
            choice = int(input("Select endpoint # to fetch full response: "))
        except (ValueError, EOFError):
            break

        if choice == 0:
            break
        if 1 <= choice <= len(available):
            ep = available[choice - 1]
            print(f"\n{'='*70}")
            print(f"GET {ep['endpoint']}")
            print(f"{'='*70}")
            print(json.dumps(ep["data"], indent=2, ensure_ascii=False)[:5000])
            if len(json.dumps(ep["data"])) > 5000:
                print(f"\n... (truncated, total {ep['size']:,} bytes)")
        else:
            print("Invalid choice.")


if __name__ == "__main__":
    main()
