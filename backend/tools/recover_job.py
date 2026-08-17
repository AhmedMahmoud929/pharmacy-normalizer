import os
import sys
import json
import sqlite3
import pandas as pd
import re

# Ensure path imports
tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)
if project_root not in sys.path:
    sys.path.append(project_root)

from tools.matcher_export import build_custom_columns, build_original_row_dict, load_original_sheet
from tools.matcher_runner import clean_df_for_excel

from tools.matcher_db import load_results, export_path_for_job

def recover(job_id: str):
    backend_root = os.path.join(project_root)
    db_path = os.path.join(backend_root, "data", "extracted", "matcher_jobs.db")
    excel_out_path = export_path_for_job(job_id)

    try:
        results_list = load_results(job_id)
    except FileNotFoundError:
        print(f"Error: job {job_id} not found.")
        return
    if not results_list:
        print(f"Error: no results stored for job {job_id}.")
        return

    print(f"Loading results from DB ({len(results_list)} rows)...")

    # Sort results_list by original row_index to preserve Excel file ordering
    results_list.sort(key=lambda x: x["row_index"])

    print("Compiling finalized records...")
    excel_records = []
    
    # Query database for job info to check price and stock configurations
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT use_uploaded_price, price_column, use_uploaded_stock, stock_column, default_stock, filename FROM matcher_jobs WHERE job_id = ?",
        (job_id,),
    )
    row = cursor.fetchone()
    use_uploaded_price = bool(row[0]) if row else False
    price_column = row[1] if row else None
    use_uploaded_stock = bool(row[2]) if row else False
    stock_column = row[3] if row else None
    default_stock = row[4] if row else 10
    filename = row[5] if row else ""
    conn.close()

    original_df = load_original_sheet(job_id, filename)

    for res in results_list:
        top_match = res["matches"][0] if res["matches"] else None
        status = top_match["status"] if top_match else "no_match"
        score = top_match["score"] if top_match else 0.0
        
        p = top_match.get("product_data") if top_match else {}
        v = top_match.get("variant_data") if top_match else {}
        
        uploaded_price = res.get("uploaded_price")
        catalog_price_val = (v or {}).get("price") or (p or {}).get("price") or 0.0
        if uploaded_price is not None:
            catalog_price_val = uploaded_price

        uploaded_stock = res.get("uploaded_stock")
        if uploaded_stock is None:
            uploaded_stock = default_stock

        record = build_original_row_dict(original_df, res["row_index"])
        record.update({
            "original_name": res["original_name"],
            "normalized_name": res["normalized_name"],
            "match_status": status,
            "match_score": f"{score * 100:.1f}%",
            "matched_product_id": (p or {}).get("id") or (top_match.get("id") if top_match else ""),
            "matched_sku": top_match.get("sku") if top_match else "",
            "matched_name_en": top_match.get("name_en") if top_match else "",
            "catalog_price": catalog_price_val,
            "classification_category": (p or {}).get("category", {}).get("name") if isinstance((p or {}).get("category"), dict) else (p or {}).get("category", ""),
            "brand": (p or {}).get("brand", {}).get("name") if isinstance((p or {}).get("brand"), dict) else (p or {}).get("brand", ""),
            "in_stock": "Yes" if ((v or {}).get("stock", 0) > 0 or (p or {}).get("in_stock", True)) else "No",
            "storefront_link": f"https://chefaa.com/product/{(p or {}).get('slug')}" if (p or {}).get("slug") else ""
        })
        
        # Map up to 3 candidates
        for k in range(3):
            prefix = f"candidate_{k+1}_"
            if k < len(res["matches"]):
                cand = res["matches"][k]
                record.update({
                    f"{prefix}score": f"{cand['score'] * 100:.1f}%",
                    f"{prefix}id": cand.get("id"),
                    f"{prefix}name_en": cand.get("name_en")
                })
            else:
                record.update({
                    f"{prefix}score": "",
                    f"{prefix}id": "",
                    f"{prefix}name_en": ""
                })

        # Append custom export columns per spec (matcher-custom-export.md)
        record.update(build_custom_columns(
            p or None,
            override_price=uploaded_price,
            override_stock=uploaded_stock,
            default_stock=default_stock,
            override_code=res.get("uploaded_code"),
            override_international_barcode=res.get("uploaded_international_barcode")
        ))
                
        excel_records.append(record)

    df_out = pd.DataFrame(excel_records)
    df_out = clean_df_for_excel(df_out)
    
    print(f"Writing to {excel_out_path}...")
    with pd.ExcelWriter(excel_out_path, engine='openpyxl') as writer:
        df_out.to_excel(writer, index=False, sheet_name="Matched Catalog")

    print("Updating SQLite database status...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE matcher_jobs SET status = 'completed', output_path = ?, error_msg = NULL WHERE job_id = ?",
        (excel_out_path, job_id)
    )
    conn.commit()
    conn.close()
    print("Success! Job recovered successfully.")

if __name__ == "__main__":
    jid = "d6657643-212b-4e95-aa92-d9190bf44d87"
    if len(sys.argv) > 1:
        jid = sys.argv[1]
    recover(jid)
