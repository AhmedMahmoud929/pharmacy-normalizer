#!/usr/bin/env python3
import os
import sys
import sqlite3
import json
from datetime import datetime

# Define base paths dynamically relative to script location
TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(TOOLS_DIR)
DATA_DIR = os.path.join(BACKEND_DIR, "data")
CRAWLER_DB = os.path.join(DATA_DIR, "crawler_jobs.db")
MAPPINGS_DB = os.path.join(BACKEND_DIR, "normalizer", "mappings", "db", "mappings.db")
JOBS_DIR = os.path.join(DATA_DIR, "crawler", "jobs")

# Ensure UTF-8 output encoding for Arabic and special chars
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def format_size(bytes_size):
    if bytes_size is None:
        return "N/A"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.1f} TB"

def get_product_count(file_path):
    if not file_path or not os.path.exists(file_path):
        return 0
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                return len(data)
            elif isinstance(data, dict):
                return len(data.get("products", data.get("items", [])))
    except Exception:
        pass
    return 0

def check_crawler_jobs():
    print("\n" + "="*80)
    print(" 📊 CRAWLER JOBS SUMMARY (crawler_jobs.db)")
    print("="*80)
    
    if not os.path.exists(CRAWLER_DB):
        print(f"❌ Crawler database not found at: {CRAWLER_DB}")
        return

    try:
        conn = sqlite3.connect(CRAWLER_DB)
        cursor = conn.cursor()
        
        # 1. Overall stats
        cursor.execute("SELECT status, COUNT(*) FROM crawler_jobs GROUP BY status")
        status_counts = cursor.fetchall()
        print("Status Breakdown:")
        for status, count in status_counts:
            print(f"  • {status.upper():<12}: {count} jobs")
        
        # 2. Detailed list of jobs
        cursor.execute("""
            SELECT job_id, status, target, crawl_mode, created_at, duration, progress 
            FROM crawler_jobs 
            ORDER BY created_at DESC 
            LIMIT 15
        """)
        jobs = cursor.fetchall()
        
        print("\nRecent 15 Jobs Details:")
        print(f"{'Job ID':<38} | {'Target':<15} | {'Mode':<10} | {'Status':<10} | {'Created At':<20} | {'Products':<10} | {'Output Size'}")
        print("-" * 125)
        
        for job_id, status, target, crawl_mode, created_at, duration, progress_str in jobs:
            # Check physical file details on disk
            job_path = os.path.join(JOBS_DIR, job_id)
            results_path = os.path.join(job_path, "results.json")
            
            size_str = "N/A"
            product_count = 0
            if os.path.exists(results_path):
                size_str = format_size(os.path.getsize(results_path))
                product_count = get_product_count(results_path)
            
            # Fallback to database real-time telemetry progress for running/in-progress jobs
            if product_count == 0 and progress_str:
                try:
                    prog_data = json.loads(progress_str)
                    product_count = prog_data.get("products_found", 0)
                except Exception:
                    pass
            
            # Format datetime
            try:
                dt = datetime.fromisoformat(created_at)
                created_str = dt.strftime("%Y-%m-%d %H:%M")
            except Exception:
                created_str = created_at[:16]
                
            print(f"{job_id:<38} | {target[:15]:<15} | {str(crawl_mode)[:10]:<10} | {status:<10} | {created_str:<20} | {product_count:<10} | {size_str}")
        
        conn.close()
    except Exception as e:
        print(f"❌ Error reading crawler jobs database: {e}")

def check_normalizer_mappings():
    print("\n" + "="*80)
    print(" 🏷️ NORMALIZER MAPPINGS & BACKUPS SUMMARY (mappings.db)")
    print("="*80)
    
    if not os.path.exists(MAPPINGS_DB):
        print(f"❌ Normalizer database not found at: {MAPPINGS_DB}")
        return

    try:
        conn = sqlite3.connect(MAPPINGS_DB)
        cursor = conn.cursor()
        
        # Count records
        cursor.execute("SELECT COUNT(*) FROM brands")
        brand_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM tokens")
        token_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM stop_words")
        stop_word_count = cursor.fetchone()[0]
        
        print("Database Record Counts:")
        print(f"  • Brands mapped       : {brand_count}")
        print(f"  • Tokens mapped       : {token_count}")
        print(f"  • Stop words defined  : {stop_word_count}")
        
        # Check source breakdown for brands
        cursor.execute("SELECT source, COUNT(*) FROM brands GROUP BY source")
        brand_sources = cursor.fetchall()
        if brand_sources:
            print("\n  Brands by source:")
            for source, count in brand_sources:
                print(f"    - {source:<12}: {count}")
                
        # Check source breakdown for tokens
        cursor.execute("SELECT source, COUNT(*) FROM tokens GROUP BY source")
        token_sources = cursor.fetchall()
        if token_sources:
            print("\n  Tokens by source:")
            for source, count in token_sources:
                print(f"    - {source:<12}: {count}")
        
        # Backup/Export file check
        export_json = os.path.join(os.path.dirname(MAPPINGS_DB), "mappings_export.json")
        print("\nExport & Backup Files:")
        if os.path.exists(export_json):
            size_str = format_size(os.path.getsize(export_json))
            mtime = datetime.fromtimestamp(os.path.getmtime(export_json)).strftime("%Y-%m-%d %H:%M:%S")
            print(f"  • mappings_export.json: EXISTS ({size_str}) - Last modified: {mtime}")
        else:
            print("  • mappings_export.json: NOT FOUND (This file is generated when exporting mappings)")
            
        conn.close()
    except Exception as e:
        print(f"❌ Error reading normalizer database: {e}")

def main():
    print(f"🔍 Pharmatch AI — Server Data Inspector Utility")
    print(f"🕒 Run Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📁 Backend Path: {BACKEND_DIR}")
    
    check_crawler_jobs()
    check_normalizer_mappings()
    print("\n" + "="*80)
    print(" ✨ Inspection complete.")
    print("="*80)

if __name__ == "__main__":
    main()
