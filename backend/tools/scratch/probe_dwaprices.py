import sys
import urllib.request
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding="utf-8")
headers = {"User-Agent": "Mozilla/5.0"}

html = urllib.request.urlopen(
    urllib.request.Request("https://dwaprices.com/", headers=headers), timeout=15
).read().decode("utf-8", "replace")
soup = BeautifulSoup(html, "lxml")
for form in soup.select("form")[:5]:
    print("FORM action=", form.get("action"), "method=", form.get("method"))
    for inp in form.select("input")[:5]:
        print("  input", inp.get("name"), inp.get("type"), inp.get("placeholder"))
