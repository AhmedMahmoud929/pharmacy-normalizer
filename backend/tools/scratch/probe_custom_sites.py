import sys
import json
import urllib.request
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding="utf-8")
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

URLS = [
    "https://dwaprices.com/med.php?id=14719",
    "https://xn--ggblx4h.xn--wgbh1c/product/dorco-evy-4-cases-4-machines-4-blades-womens-31-vwhan",
    "https://sourcebeauty.com/products/dorco-eve-4-disposable-razor-3-1",
]

for url in URLS:
    print("=" * 80)
    print(url)
    html = urllib.request.urlopen(
        urllib.request.Request(url, headers=headers), timeout=25
    ).read().decode("utf-8", "replace")
    soup = BeautifulSoup(html, "lxml")
    og = {}
    for m in soup.select("meta[property^='og:'], meta[name='twitter:']"):
        key = m.get("property") or m.get("name") or ""
        og[key] = (m.get("content") or "")[:120]
    print("OG:", json.dumps(og, ensure_ascii=False, indent=2))
    h1 = soup.select_one("h1")
    h2 = soup.select_one("h2")
    print("h1:", (h1.get_text(strip=True) if h1 else "")[:100])
    print("h2:", (h2.get_text(strip=True) if h2 else "")[:100])
    # ld+json
    for script in soup.select('script[type="application/ld+json"]'):
        txt = script.string or script.get_text()
        if txt and "Product" in txt:
            print("ld+json snippet:", txt[:300])
    # first 5 imgs
    for img in soup.select("img")[:8]:
        print(" img:", (img.get("src") or "")[:90], "|", (img.get("alt") or "")[:40])
    print()
