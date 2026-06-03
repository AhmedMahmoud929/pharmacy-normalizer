"""
inject_units.py — One-time unit extraction script.

Reads chefaa_products_eg_normalized.json, parses the `unit` field
for each product using regex rules defined in the spec, and writes
the enriched data back to the same file (with a .bak backup first).

Run once:
    python backend/tools/inject_units.py
"""
import os
import re
import json
import shutil
import sys

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------
tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)

INPUT_PATH = os.path.join(project_root, "data", "normalized", "chefaa_products_eg_normalized.json")
BACKUP_PATH = INPUT_PATH + ".bak"

# ---------------------------------------------------------------------------
# Unit regex rules — each tuple: (unit_label, [pattern, ...])
# Patterns are compiled case-insensitively.
# ---------------------------------------------------------------------------
UNIT_PATTERNS = [
    ("Tablet", [
        r"(?:\b|\d)(?:tablet[s]?|tab[s]?)\b",
        r"\b(?:قرص|أقراص)\b",
    ]),
    ("Capsule", [
        r"(?:\b|\d)(?:capsule[s]?|cap[s]?)\b",
        r"\b(?:كبسولة|كبسولات)\b",
    ]),
    ("Ampoule", [
        r"(?:\b|\d)(?:ampoule[s]?|amp[s]?)\b",
        r"\b(?:أمبول|أمبولات|امبول|امبولات)\b",
    ]),
    ("Vial", [
        r"(?:\b|\d)(?:vial[s]?)\b",
        r"\b(?:فيل)\b",
    ]),
    ("Sachet", [
        r"(?:\b|\d)(?:sachet[s]?|sac[s]?)\b",
        r"\b(?:كيس|أكياس)\b",
    ]),
    ("Suppository", [
        r"(?:\b|\d)(?:suppositor(?:y|ies)|supp[s]?)\b",
        r"\b(?:لبوس|قمع|أقماع)\b",
    ]),
    ("Drops", [
        r"(?:\b|\d)(?:drop[s]?)\b",
        r"\b(?:نقط|قطرة|قطرات)\b",
    ]),
    ("Pen", [
        r"(?:\b|\d)(?:pen[s]?|kwikpen[s]?)\b",
        r"\b(?:قلم|أقلام)\b",
    ]),
    ("Syringe", [
        r"(?:\b|\d)(?:syringe[s]?)\b",
        r"\b(?:سرنجة|سرنجات)\b",
    ]),
    ("Cartridge", [
        r"(?:\b|\d)(?:cartridge[s]?)\b",
        r"\b(?:خرطوشة)\b",
    ]),
    ("Penfill", [
        r"(?:\b|\d)(?:penfill[s]?)\b",
    ]),
]

# Pre-compile all patterns
COMPILED_PATTERNS = [
    (label, [re.compile(p, re.IGNORECASE | re.UNICODE) for p in patterns])
    for label, patterns in UNIT_PATTERNS
]


def extract_unit(product: dict) -> str:
    """Return the matched unit label or '' if none matched."""
    # Fields to search — concatenate title_en, title_ar, description_en, description_ar
    search_fields = [
        product.get("title_en") or "",
        product.get("title_ar") or "",
        product.get("description_en") or "",
        product.get("description_ar") or "",
        product.get("meta_description_en") or "",
        product.get("meta_description_ar") or "",
    ]
    text = " ".join(f for f in search_fields if f)

    for unit_label, compiled_list in COMPILED_PATTERNS:
        for compiled_re in compiled_list:
            if compiled_re.search(text):
                return unit_label
    return ""


def main():
    if not os.path.exists(INPUT_PATH):
        print(f"ERROR: Input file not found: {INPUT_PATH}")
        sys.exit(1)

    print(f"Reading: {INPUT_PATH}  ({os.path.getsize(INPUT_PATH) // 1_000_000} MB)")

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        products = json.load(f)

    if not isinstance(products, list):
        print("ERROR: Expected a JSON list of products.")
        sys.exit(1)

    print(f"Loaded {len(products):,} products. Extracting units...")

    unit_counts: dict = {}
    for i, prod in enumerate(products):
        unit = extract_unit(prod)
        prod["unit"] = unit
        unit_counts[unit] = unit_counts.get(unit, 0) + 1
        if (i + 1) % 5000 == 0:
            print(f"  {i + 1:,}/{len(products):,} processed...")

    print("\nUnit distribution:")
    for label, count in sorted(unit_counts.items(), key=lambda x: -x[1]):
        display = label if label else "(no match)"
        print(f"  {display:20s}: {count:,}")

    # Write backup then overwrite
    print(f"\nCreating backup -> {BACKUP_PATH}")
    shutil.copy2(INPUT_PATH, BACKUP_PATH)

    print(f"Writing enriched data -> {INPUT_PATH}")
    tmp_path = INPUT_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, INPUT_PATH)

    print("Done.")


if __name__ == "__main__":
    main()
