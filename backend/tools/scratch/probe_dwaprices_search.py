import sys
import urllib.request
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding="utf-8")
headers = {"User-Agent": "Mozilla/5.0"}

urls = [
    "https://dwaprices.com/search.php?q=avene",
    "https://dwaprices.com/search.php?keyword=avene",
    "https://dwaprices.com/medsearch.php?q=avene",
    "https://dwaprices.com/database.php?q=avene",
]
for url in urls:
    try:
        html = urllib.request.urlopen(
            urllib.request.Request(url, headers=headers), timeout=15
        ).read().decode("utf-8", "replace")
        soup = BeautifulSoup(html, "lxml")
        links = []
        for a in soup.select("a[href]"):
            href = a.get("href") or ""
            if "med.php" in href:
                links.append((href, a.get_text(strip=True)[:50]))
            if len(links) >= 3:
                break
        print(url)
        print("  med links:", links)
        print("  title:", (soup.title.string if soup.title else "")[:80])
    except Exception as e:
        print(url, "ERR", e)
    print("---")
