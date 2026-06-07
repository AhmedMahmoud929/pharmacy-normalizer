import json
import os
import sys

# Ensure UTF-8 output
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

file_path = r"a:\drug-mapping\backend\data\extracted\chefaa_products_eg.json"

if not os.path.exists(file_path):
    print("File not found:", file_path)
    exit()

print("Reading JSON file...")
with open(file_path, "r", encoding="utf-8") as f:
    products = json.load(f)

print(f"Total products: {len(products)}")

print("\n--- SAMPLE PRODUCTS ---")
for p in products[:15]:
    print(f"ID: {p.get('id')}")
    print(f"AR: {p.get('title_ar')}")
    print(f"EN: {p.get('title_en')}")
    print(f"Brand AR: {p.get('brands', {}).get('title_ar') if p.get('brands') else 'None'}")
    print(f"Brand EN: {p.get('brands', {}).get('title_en') if p.get('brands') else 'None'}")
    print("-" * 50)
