"""
merge_ghanem_products.py
Merges Ghanem-sourced product stubs into chefaa_products_eg_normalized.json.
Deduplicates by normalized_name_en so re-running is safe.
"""
import json, sys, os
sys.stdout.reconfigure(encoding='utf-8')

CHEFAA_DB  = 'backend/data/normalized/chefaa_products_eg_normalized.json'
GHANEM_DB  = 'backend/data/ghanem_products.json'

if not os.path.exists(GHANEM_DB):
    print(f"❌ {GHANEM_DB} not found. Run extract_missing_to_db.py first.")
    sys.exit(1)

print(f"Loading {CHEFAA_DB}...")
with open(CHEFAA_DB, 'r', encoding='utf-8') as f:
    chefaa = json.load(f)

print(f"Loading {GHANEM_DB}...")
with open(GHANEM_DB, 'r', encoding='utf-8') as f:
    ghanem = json.load(f)

# Build set of normalized names already in Chefaa DB
existing_norms = {p.get('normalized_name_en', '') for p in chefaa}

# Only add entries that don't already exist
to_add = [p for p in ghanem if p.get('normalized_name_en', '') not in existing_norms]
skipped = len(ghanem) - len(to_add)

print(f"\nChefaa DB:     {len(chefaa):,} products")
print(f"Ghanem stubs:  {len(ghanem):,} products")
print(f"Already exist: {skipped}")
print(f"To add:        {len(to_add)}")

combined = chefaa + to_add

print(f"\nSaving merged DB ({len(combined):,} products) to {CHEFAA_DB}...")
with open(CHEFAA_DB, 'w', encoding='utf-8') as f:
    json.dump(combined, f, ensure_ascii=False, indent=2)

print(f"✅ Done. Total products in DB: {len(combined):,}")
print(f"\n⚠️  Restart the backend for changes to take effect.")
