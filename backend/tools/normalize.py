#!/usr/bin/env python3
"""
CLI tool for the pharmacy product name normalizer.

Usage:
  # Normalize individual values
  python normalize.py "AUGMENTIN 1GM TABS" "بانادول 500مجم اقراص"

  # Normalize a column from an Excel sheet -> output new sheet
  python normalize.py --file sheet-1.xlsx
  python normalize.py --file sheet-1.xlsx --column Name
  python normalize.py --file sheet-1.xlsx --column Name --output normalized.xlsx

  # Normalize all sheets in the directory
  python normalize.py --file standard.xlsx sheet-1.xlsx sheet-2.xlsx

  # Show help
  python normalize.py --help
"""

import argparse
import json
import sys
import os
import warnings
from tqdm import tqdm

# Suppress openpyxl warnings
warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Fix imports when running from tools/ directory
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer import normalize
from normalizer.core.pipeline import create_pipeline


# ─────────────────────────────────────────────────────────────────────
#  Column detection — reused from log_sheets.py
# ─────────────────────────────────────────────────────────────────────
NAME_COLUMN_CANDIDATES = [
    "name", "Name", "NAME",
    "الاسم", "الاسم الانجليزى", "الاسم العربي",
    "product_name", "Product Name", "item_name", "Item Name",
    "drug_name", "Drug Name",
]


def _detect_name_column(columns: list[str]) -> str | None:
    """
    Auto-detect the product name column from a list of DataFrame columns.
    Tries exact matches first, then substring matching.
    """
    # Exact match
    for candidate in NAME_COLUMN_CANDIDATES:
        if candidate in columns:
            return candidate

    # Substring match (case-insensitive)
    for col in columns:
        col_lower = str(col).lower()
        if "name" in col_lower or "الاسم" in col_lower:
            return col

    return None


# ─────────────────────────────────────────────────────────────────────
#  Mode 1: Normalize inline values
# ─────────────────────────────────────────────────────────────────────
def normalize_values(values: list[str], norm_fn=None) -> None:
    """Normalize and print individual values to stdout."""
    if norm_fn is None:
        norm_fn = normalize
    max_input_len = max(len(v) for v in values)

    for raw in values:
        result = norm_fn(raw)
        print(f"  {raw:<{max_input_len + 2}} -> {result}")


# ─────────────────────────────────────────────────────────────────────
#  Mode 2: Normalize column from Excel -> new Excel
# ─────────────────────────────────────────────────────────────────────
def normalize_sheet(
    file_path: str,
    column: str | None = None,
    output: str | None = None,
    sheet_name: str | int = 0,
    norm_fn=None,
) -> None:
    """
    Read an Excel file, normalize the specified column,
    and write a new file with a 'normalized_name' column added.
    """
    import pandas as pd
    import shutil

    if norm_fn is None:
        norm_fn = normalize

    if not os.path.exists(file_path):
        print(f"  x File not found: {file_path}")
        sys.exit(1)

    # Read the sheet (copy to temp file first to bypass Excel locks)
    print(f"  [Folder] Reading: {file_path}")
    temp_file = file_path + ".tmp.xlsx"
    try:
        shutil.copy(file_path, temp_file)
        df = pd.read_excel(temp_file, sheet_name=sheet_name)
    except Exception as e:
        print(f"  x Failed to read {file_path}: {e}")
        sys.exit(1)
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
                
    print(f"     Rows: {len(df)}, Columns: {list(df.columns)}")

    # Detect or validate the name column
    if column:
        if column not in df.columns:
            print(f"  x Column '{column}' not found in {file_path}")
            print(f"     Available columns: {list(df.columns)}")
            sys.exit(1)
        name_col = column
    else:
        name_col = _detect_name_column(df.columns.tolist())
        if name_col is None:
            print(f"  x Could not auto-detect name column in {file_path}")
            print(f"     Available columns: {list(df.columns)}")
            print(f"     Tip: use --column to specify the column name")
            sys.exit(1)
        print(f"     Auto-detected name column: '{name_col}'")

    # Normalize the column
    print(f"  [*] Normalizing '{name_col}'...")
    tqdm.pandas(desc="     Progress", leave=False)
    df["normalized_name"] = df[name_col].fillna("").astype(str).progress_apply(norm_fn)

    # Count how many values changed
    changed = (df[name_col].fillna("").astype(str).str.strip() != df["normalized_name"]).sum()
    print(f"     {changed}/{len(df)} values modified by normalization")

    # Generate output path
    if output is None:
        base_name = os.path.basename(file_path)
        base, ext = os.path.splitext(base_name)
        # Use data/normalized directory if it exists
        norm_dir = os.path.join(project_root, "data", "normalized")
        if os.path.exists(norm_dir):
            output = os.path.join(norm_dir, f"{base}_normalized{ext}")
        else:
            output = f"{base}_normalized{ext}"

    # Write the output
    df.to_excel(output, index=False, engine="openpyxl")
    print(f"  [Checkmark] Output saved: {output}")

    # Show a preview (first 5 rows)
    print(f"\n  Preview (first 5 rows):")
    print(f"  {'Original':<45s} {'Normalized':<45s}")
    print(f"  {'=' * 45} {'=' * 45}")
    for i, row in df.head(5).iterrows():
        original = str(row[name_col])[:44]
        normalized = str(row["normalized_name"])[:44]
        print(f"  {original:<45s} {normalized:<45s}")


# ─────────────────────────────────────────────────────────────────────
#  Mode 3: Normalize JSON file
# ─────────────────────────────────────────────────────────────────────


def _detect_json_name_fields(data: any) -> list[str]:
    """
    Recursively scan a JSON structure and collect all unique keys
    that contain 'name' (case-insensitive) or match 'title_en' / 'title_ar'.
    """
    found = set()

    def _scan(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if ("name" in key.lower() or key.lower() in ["title_en", "title_ar"]) and isinstance(value, str):
                    found.add(key)
                _scan(value)
        elif isinstance(obj, list):
            for item in obj:
                _scan(item)

    _scan(data)
    return sorted(found)


def _normalize_json_recursive(data, fields: list[str], stats: dict, norm_fn=None, depth=0, max_depth=None) -> any:
    """
    Recursively walk a JSON structure and normalize specified fields.
    Adds a 'normalized_<field>' key next to each matched field.
    Also adds 'normalized_name_en' / 'normalized_name_ar' for compatibility if applicable.
    Supports a max_depth limit to avoid deep recursions into complex datasets.
    """
    if norm_fn is None:
        norm_fn = normalize

    if isinstance(data, list):
        return [_normalize_json_recursive(item, fields, stats, norm_fn, depth, max_depth) for item in data]

    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if key in fields and isinstance(value, str) and value.strip():
                normalized = norm_fn(value)
                result[key] = value
                result[f"normalized_{key}"] = normalized
                if key == "title_en":
                    result["normalized_name_en"] = normalized
                elif key == "title_ar":
                    result["normalized_name_ar"] = normalized
                if value.strip() != normalized:
                    stats["changed"] += 1
                stats["total"] += 1
            elif isinstance(value, (dict, list)) and (max_depth is None or depth < max_depth):
                result[key] = _normalize_json_recursive(value, fields, stats, norm_fn, depth + 1, max_depth)
            else:
                result[key] = value
        return result

    return data


def normalize_json_file(
    file_path: str,
    fields: list[str] | None = None,
    output: str | None = None,
    norm_fn=None,
    english_only: bool = False,
    max_depth: int | None = None,
) -> None:
    """
    Read a JSON file, normalize name fields recursively,
    and write a new file with 'normalized_<field>' keys added.
    """
    if not os.path.exists(file_path):
        print(f"  x File not found: {file_path}")
        sys.exit(1)

    print(f"  📂 Reading: {file_path}")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  x Failed to read {file_path}: {e}")
        sys.exit(1)

    if fields is None:
        fields = _detect_json_name_fields(data)
        if english_only:
            fields = [f for f in fields if "ar" not in f.lower()]
        if not fields:
            print(f"  x No name fields found in {file_path}")
            sys.exit(1)
        print(f"     Auto-detected name fields: {fields}")

    if norm_fn is None:
        norm_fn = normalize

    # Auto-optimize for the standard Chefaa products database to bypass redundant nested metadata
    if max_depth is None and "chefaa_products_eg" in os.path.basename(file_path):
        print("  ⚡ Detected Chefaa products database. Using max_depth=0 to optimize normalization speed.")
        max_depth = 0

    stats = {"total": 0, "changed": 0}

    print(f"  [*] Normalizing fields: {fields}...")
    normalized_data = _normalize_json_recursive(data, fields, stats, norm_fn, depth=0, max_depth=max_depth)

    print(f"     {stats['changed']}/{stats['total']} values modified by normalization")

    if output is None:
        base_name = os.path.basename(file_path)
        base, ext = os.path.splitext(base_name)
        norm_dir = os.path.join(project_root, "data", "normalized")
        if os.path.exists(norm_dir):
            output = os.path.join(norm_dir, f"{base}_normalized{ext}")
        else:
            output = f"{base}_normalized{ext}"

    with open(output, "w", encoding="utf-8") as f:
        json.dump(normalized_data, f, ensure_ascii=False, indent=2)

    print(f"  ✅ Output saved: {output}")

    _print_json_preview(normalized_data, fields)


def _print_json_preview(data: any, fields: list[str], limit: int = 5) -> None:
    """Print a preview table of original vs normalized values."""
    items = []
    _collect_name_items(data, fields, items)

    if not items:
        return

    items = items[:limit]
    print(f"\n  Preview (first {len(items)} entries):")
    print(f"  {'Original':<50s} {'Normalized':<50s}")
    print(f"  {'─' * 50} {'─' * 50}")
    for original, normalized in items:
        print(f"  {original[:49]:<50s} {normalized[:49]:<50s}")


def _collect_name_items(data: any, fields: list[str], items: list) -> None:
    """Recursively collect (original, normalized) pairs from the JSON."""
    if isinstance(data, list):
        for item in data:
            _collect_name_items(item, fields, items)
    elif isinstance(data, dict):
        for key, value in data.items():
            norm_key = f"normalized_{key}"
            if key in fields and norm_key in data and isinstance(value, str):
                items.append((value, data[norm_key]))
            elif isinstance(value, (dict, list)):
                _collect_name_items(value, fields, items)


# ─────────────────────────────────────────────────────────────────────
#  Argument parsing
# ─────────────────────────────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="normalize",
        description="Pharmacy product name normalizer -- CLI tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Normalize values directly
  python tools/normalize.py "AUGMENTIN 1GM TABS" "بانادول 500مجم اقراص"

  # Normalize a column from an Excel sheet
  python tools/normalize.py --file data/sheets_input/sheet-1.xlsx
  python tools/normalize.py --file data/sheets_input/sheet-1.xlsx --column Name
  python tools/normalize.py --file data/sheets_input/sheet-1.xlsx --column Name --output result.xlsx

  # Normalize a JSON file (auto-detected by .json extension)
  python tools/normalize.py --file data-extractor/data/categories.json
  python tools/normalize.py --file categories.json --output result.json

  # English-only mode (skip Arabic processing, only normalize 'name' field)
  python tools/normalize.py --english-only --file categories.json

  # Process multiple files
  python tools/normalize.py --file data/sheets_input/standard.xlsx data/sheets_input/sheet-1.xlsx
        """,
    )

    # Positional: inline values to normalize
    parser.add_argument(
        "values",
        nargs="*",
        help="Product name(s) to normalize (inline mode)",
    )

    # File mode
    parser.add_argument(
        "-f", "--file",
        nargs="+",
        metavar="FILE",
        help="Excel/JSON file(s) to normalize. Adds normalized columns/keys.",
    )

    parser.add_argument(
        "-c", "--column",
        metavar="COL",
        help="Name of the column to normalize (auto-detected if omitted).",
    )

    parser.add_argument(
        "-o", "--output",
        metavar="FILE",
        help="Output file path (only valid with a single --file). "
             "Defaults to 'data/normalized/<input>_normalized.xlsx'.",
    )

    parser.add_argument(
        "-s", "--sheet",
        default=0,
        help="Sheet name or index to read (default: first sheet).",
    )

    parser.add_argument(
        "-e", "--english-only",
        action="store_true",
        help="Skip Arabic processing (normalization, mapping, brand translation). "
             "For JSON files, only normalize English 'name' fields.",
    )

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    # Nothing provided
    if not args.values and not args.file:
        parser.print_help()
        sys.exit(0)

    # Can't use both modes at once
    if args.values and args.file:
        print("x Cannot use inline values and --file at the same time.")
        print("   Use one or the other.")
        sys.exit(1)

    # Output only valid for single file
    if args.output and args.file and len(args.file) > 1:
        print("x --output can only be used with a single --file.")
        sys.exit(1)

    # -- Mode 1: Inline values --
    if args.values:
        print("🔬 Normalizing values:\n")
        norm_fn = create_pipeline(enable_arabic=False) if args.english_only else normalize
        normalize_values(args.values, norm_fn=norm_fn)
        print()
        return

    # -- Mode 2: File processing --
    if args.file:
        # Parse sheet name/index
        sheet = args.sheet
        try:
            sheet = int(sheet)
        except (ValueError, TypeError):
            pass

        norm_fn = create_pipeline(enable_arabic=False) if args.english_only else normalize

        print("📊 Normalizing files:\n")
        if args.english_only:
            print("  ⚡ English-only mode: Arabic processing disabled\n")

        for i, file_path in enumerate(args.file):
            if i > 0:
                print("\n" + "-" * 60 + "\n")

            output = args.output if len(args.file) == 1 else None

            if file_path.lower().endswith(".json"):
                normalize_json_file(
                    file_path=file_path,
                    output=output,
                    norm_fn=norm_fn,
                    english_only=args.english_only,
                )
            else:
                normalize_sheet(
                    file_path=file_path,
                    column=args.column,
                    output=output,
                    sheet_name=sheet,
                    norm_fn=norm_fn,
                )

        print()


if __name__ == "__main__":
    main()
