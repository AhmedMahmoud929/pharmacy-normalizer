import json
import re
import urllib.request

URL_EN = "https://eg.looliacloset.com/collections/luna/products/dorin-anti-acne-emulsion-30-ml"
URL_AR = "https://eg.looliacloset.com/ar/collections/luna/products/dorin-anti-acne-emulsion-30-ml"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8", errors="replace")

for label, url in [("EN", URL_EN), ("AR", URL_AR)]:
    html = fetch(url)
    print(f"\n=== {label} len={len(html)} ===")

    # ShopifyAnalytics
    m = re.search(r"ShopifyAnalytics\.meta\s*=\s*(\{.*?\});", html, re.DOTALL)
    if m:
        try:
            meta = json.loads(m.group(1))
            prod = meta.get("product", {})
            print("ShopifyAnalytics.product keys:", list(prod.keys())[:10])
            print("  id", prod.get("id"), "vendor", prod.get("vendor"), "type", prod.get("type"))
            variants = prod.get("variants") or []
            if variants:
                v = variants[0]
                print("  variant price", v.get("price"), "barcode", v.get("barcode"), "sku", v.get("sku"))
        except Exception as e:
            print("ShopifyAnalytics parse err", e)

    # application/json scripts
    soup_scripts = re.findall(r'<script type="application/json"[^>]*>(.*?)</script>', html, re.DOTALL)
    print("application/json scripts:", len(soup_scripts))
    for i, text in enumerate(soup_scripts[:5]):
        if "variants" in text or "product" in text:
            try:
                data = json.loads(text)
                if isinstance(data, dict):
                    print(f"  script[{i}] keys:", list(data.keys())[:12])
                    if data.get("title"):
                        print("   title", data.get("title"))
            except Exception:
                pass

    # ld+json
    for block in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            ld = json.loads(block)
            items = ld if isinstance(ld, list) else [ld]
            for item in items:
                if str(item.get("@type", "")).lower() == "product":
                    print("ld+json product:", item.get("name"))
                    offers = item.get("offers") or {}
                    if isinstance(offers, list):
                        offers = offers[0] if offers else {}
                    print("  price", offers.get("price"), "image", item.get("image"))
        except Exception:
            pass

    # h1 title
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.DOTALL | re.IGNORECASE)
    if m:
        title = re.sub(r"<[^>]+>", "", m.group(1)).strip()
        print("h1:", title)
    handle = "dorin-anti-acne-emulsion-30-ml"
    js_url = f"https://eg.looliacloset.com/products/{handle}.js"
    try:
        js_data = json.loads(fetch(js_url))
        print(".js endpoint title:", js_data.get("title"))
        print("  vendor:", js_data.get("vendor"), "price:", js_data.get("price"))
        v = (js_data.get("variants") or [{}])[0]
        print("  variant barcode:", v.get("barcode"), "price:", v.get("price"))
        print("  featured_image:", js_data.get("featured_image"))
        print("  images count:", len(js_data.get("images") or []))
        if js_data.get("images"):
            print("  first image:", js_data["images"][0])
    except Exception as e:
        print(".js endpoint failed:", e)
