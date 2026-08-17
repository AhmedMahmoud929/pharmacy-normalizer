import sys
import json
import urllib.request
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding="utf-8")
headers = {"User-Agent": "Mozilla/5.0"}
url = "https://dwaprices.com/med.php?id=14719"
html = urllib.request.urlopen(
    urllib.request.Request(url, headers=headers), timeout=20
).read().decode("utf-8", "replace")
soup = BeautifulSoup(html, "lxml")

print("=== HEADINGS ===")
for tag in ["h1", "h2", "h3"]:
    for el in soup.select(tag)[:5]:
        print(f"{tag}: {el.get_text(strip=True)[:120]}")

print("\n=== IMAGES (product-like) ===")
for img in soup.select("img")[:20]:
    src = img.get("src") or img.get("data-src") or ""
    alt = (img.get("alt") or "")[:60]
    if src:
        print(f"  {src[:100]} | alt={alt}")

print("\n=== PRICE-LIKE TEXT ===")
for sel in [".price", "[class*='price']", "strong", "b"]:
    pass
# search for 389
import re
for m in re.finditer(r"389[^\<\n]{0,40}", html):
    snippet = m.group(0).replace("\n", " ")[:80]
    if "389" in snippet:
        print(" ", snippet)

print("\n=== TABLE ROWS (first 15) ===")
for tr in soup.select("table tr")[:15]:
    cells = [c.get_text(strip=True)[:80] for c in tr.select("td, th")]
    if cells:
        print(" | ".join(cells))

print("\n=== META / OG ===")
for meta in soup.select("meta[property], meta[name]"):
    print(meta.get("property") or meta.get("name"), "=", (meta.get("content") or "")[:100])

print("\n=== DEFAULT h1 SELECTOR ===")
h1 = soup.select_one("h1")
print(h1.get_text(strip=True) if h1 else "none")

print("\n=== FIRST img[src] ===")
img = soup.select_one("img[src]")
print(img.get("src") if img else "none")
