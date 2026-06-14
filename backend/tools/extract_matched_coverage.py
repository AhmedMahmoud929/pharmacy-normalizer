#!/usr/bin/env python3
"""Extract matched rows from sheet_coverage_report and enrich with code + barcode."""

import os
import sys

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REPORT = os.path.join(project_root, "data", "normalized", "sheet_coverage_report.xlsx")
SHEET = os.path.join(project_root, "data", "normalized", "sheet_with_code_normalized.xlsx")
OUTPUT = os.path.join(project_root, "data", "normalized", "sheet_coverage_matched.xlsx")


def enrich_with_dest_fields(df: pd.DataFrame, sheet_path: str) -> pd.DataFrame:
    sheet = pd.read_excel(sheet_path)
    sheet["id"] = sheet["id"].astype(str)
    lookup = sheet.set_index("id")[["code", "international_barcode"]]

    out = df.copy()
    out["dest_id"] = out["dest_id"].apply(lambda x: "" if pd.isna(x) else str(int(x)))
    out = out.drop(columns=["dest_code"], errors="ignore")
    out = out.join(lookup, on="dest_id", how="left")
    out = out.rename(
        columns={
            "code": "dest_code",
            "international_barcode": "dest_international_barcode",
        }
    )
    return out


def main() -> None:
    report = pd.read_excel(REPORT)
    matched = report[report["status"] == "matched"].copy()
    matched = enrich_with_dest_fields(matched, SHEET)
    matched = matched.sort_values("best_score", ascending=False)
    matched.to_excel(OUTPUT, index=False, engine="openpyxl")

    print(f"Saved {len(matched):,} matched rows to:\n  {OUTPUT}")
    print(f"  With dest_code: {matched['dest_code'].notna().sum():,}")
    print(f"  With dest_international_barcode: {matched['dest_international_barcode'].notna().sum():,}")


if __name__ == "__main__":
    main()
