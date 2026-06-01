import os
import sqlite3
import json
import re
from datetime import datetime

# Paths configuration
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
CRAWLER_DB = os.path.join(DATA_DIR, "crawler_jobs.db")
CRAWLER_BACKUP_DB = os.path.join(DATA_DIR, "crawler_jobs_backup.db")
JOBS_DIR = os.path.join(DATA_DIR, "crawler", "jobs")

# ANSI Color Codes for beautiful terminal report
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
RESET = "\033[0m"

def format_size(size_bytes):
    if size_bytes == 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB")
    i = 0
    while size_bytes >= 1024 and i < len(size_name) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.2f} {size_name[i]}"

def get_actual_product_count(results_path):
    """Safely count products using indentation filter (highly robust against concurrent writes / syntax errors)"""
    if not os.path.exists(results_path):
        return 0
    count = 0
    try:
        with open(results_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('        "id":') or line.startswith('        \"id\":'):
                    count += 1
    except Exception:
        pass
    return count

def inspect_databases():
    print(f"\n{BOLD}{CYAN}================================================================================{RESET}")
    print(f"{BOLD}{CYAN} 📊 SQLITE DATABASE & BACKUP STATUS{RESET}")
    print(f"{BOLD}{CYAN}================================================================================{RESET}")
    
    # 1. Primary DB
    if os.path.exists(CRAWLER_DB):
        size = format_size(os.path.getsize(CRAWLER_DB))
        mtime = datetime.fromtimestamp(os.path.getmtime(CRAWLER_DB)).strftime("%Y-%m-%d %H:%M:%S")
        print(f"  • {BOLD}Primary Database:{RESET} {GREEN}crawler_jobs.db{RESET}")
        print(f"    - Size          : {size}")
        print(f"    - Last Modified : {mtime}")
        
        try:
            conn = sqlite3.connect(CRAWLER_DB)
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM crawler_jobs")
            row_count = c.fetchone()[0]
            print(f"    - Job Records   : {BOLD}{row_count}{RESET} jobs logged")
            
            c.execute("SELECT status, COUNT(*) FROM crawler_jobs GROUP BY status")
            statuses = c.fetchall()
            status_str = ", ".join([f"{status.upper()} ({count})" for status, count in statuses])
            print(f"    - Status Summary: {status_str}")
            conn.close()
        except Exception as e:
            print(f"    {RED}Error reading primary DB: {e}{RESET}")
    else:
        print(f"  • {BOLD}Primary Database:{RESET} {RED}crawler_jobs.db NOT FOUND!{RESET}")

    # 2. Backup DB
    if os.path.exists(CRAWLER_BACKUP_DB):
        size = format_size(os.path.getsize(CRAWLER_BACKUP_DB))
        mtime = datetime.fromtimestamp(os.path.getmtime(CRAWLER_BACKUP_DB)).strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n  • {BOLD}Backup Database:{RESET} {YELLOW}crawler_jobs_backup.db{RESET}")
        print(f"    - Size          : {size}")
        print(f"    - Last Modified : {mtime}")
        
        try:
            conn = sqlite3.connect(CRAWLER_BACKUP_DB)
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM crawler_jobs")
            row_count = c.fetchone()[0]
            print(f"    - Backup Records: {BOLD}{row_count}{RESET} jobs logged in backup")
            
            c.execute("SELECT status, COUNT(*) FROM crawler_jobs GROUP BY status")
            statuses = c.fetchall()
            status_str = ", ".join([f"{status.upper()} ({count})" for status, count in statuses])
            print(f"    - Status Summary: {status_str}")
            conn.close()
        except Exception as e:
            print(f"    {RED}Error reading backup DB: {e}{RESET}")
    else:
        print(f"\n  • {BOLD}Backup Database:{RESET} {YELLOW}crawler_jobs_backup.db NOT FOUND (No backups created yet){RESET}")

def inspect_jobs_data():
    print(f"\n{BOLD}{CYAN}================================================================================{RESET}")
    print(f"{BOLD}{CYAN} 📁 DEEP CRAWLER JOB DIRECTORY & DISK AUDIT{RESET}")
    print(f"{BOLD}{CYAN}================================================================================{RESET}")
    
    if not os.path.exists(JOBS_DIR):
        print(f"{RED}❌ Jobs directory not found at: {JOBS_DIR}{RESET}")
        return

    # Gather database job profiles
    db_jobs = {}
    if os.path.exists(CRAWLER_DB):
        try:
            conn = sqlite3.connect(CRAWLER_DB)
            c = conn.cursor()
            c.execute("SELECT job_id, status, target, crawl_mode, created_at FROM crawler_jobs")
            for row in c.fetchall():
                db_jobs[row[0]] = {
                    "status": row[1],
                    "target": row[2],
                    "crawl_mode": row[3],
                    "created_at": row[4]
                }
            conn.close()
        except Exception as e:
            print(f"{RED}Warning: Could not fetch job index from SQLite: {e}{RESET}")

    # Scan disk directories
    disk_job_ids = [d for d in os.listdir(JOBS_DIR) if os.path.isdir(os.path.join(JOBS_DIR, d))]
    
    total_results_size = 0
    total_media_size = 0
    total_products_scraped = 0
    
    jobs_report = []
    
    for job_id in disk_job_ids:
        job_path = os.path.join(JOBS_DIR, job_id)
        results_path = os.path.join(job_path, "results.json")
        media_path = os.path.join(job_path, "media.zip")
        logs_path = os.path.join(job_path, "logs.txt")
        
        # Disk checks
        has_results = os.path.exists(results_path)
        results_size = os.path.getsize(results_path) if has_results else 0
        total_results_size += results_size
        
        has_media = os.path.exists(media_path)
        media_size = os.path.getsize(media_path) if has_media else 0
        total_media_size += media_size
        
        prod_count = get_actual_product_count(results_path)
        total_products_scraped += prod_count
        
        # Match with DB metadata
        metadata = db_jobs.get(job_id)
        
        jobs_report.append({
            "job_id": job_id,
            "has_results": has_results,
            "results_size": results_size,
            "has_media": has_media,
            "media_size": media_size,
            "product_count": prod_count,
            "metadata": metadata
        })

    # Group job reports for beautiful printing
    completed_jobs = [j for j in jobs_report if j["metadata"] and j["metadata"]["status"] == "completed"]
    running_jobs = [j for j in jobs_report if j["metadata"] and j["metadata"]["status"] == "running"]
    failed_stopped_jobs = [j for j in jobs_report if j["metadata"] and j["metadata"]["status"] in ["failed", "stopped"]]
    orphaned_jobs = [j for j in jobs_report if not j["metadata"]]
    
    # 1. Active / Running Jobs
    if running_jobs:
        print(f"\n{BOLD}{YELLOW}⚡ ACTIVE / RUNNING JOBS ON DISK:{RESET}")
        print(f"{'Job ID':<38} | {'Target':<12} | {'Created At':<16} | {'Products written':<16} | {'Results Size':<12} | {'Media Size'}")
        print("-" * 115)
        for j in running_jobs:
            meta = j["metadata"]
            created = meta["created_at"][:16].replace("T", " ")
            r_size = format_size(j["results_size"])
            m_size = format_size(j["media_size"]) if j["has_media"] else "N/A"
            print(f"{j['job_id']:<38} | {meta['target']:<12} | {created:<16} | {j['product_count']:<16} | {r_size:<12} | {m_size}")

    # 2. Completed Jobs with Scraped Data
    print(f"\n{BOLD}{GREEN}✅ COMPLETED JOBS DATABASE ON DISK:{RESET}")
    print(f"{'Job ID':<38} | {'Target':<12} | {'Completed Date':<16} | {'Scraped Products':<16} | {'Results Size':<12} | {'Media Archive'}")
    print("-" * 115)
    
    if completed_jobs:
        # Sort by creation date descending
        completed_jobs.sort(key=lambda x: x["metadata"]["created_at"] or "", reverse=True)
        for j in completed_jobs:
            meta = j["metadata"]
            created = meta["created_at"][:16].replace("T", " ")
            r_size = format_size(j["results_size"])
            m_size = format_size(j["media_size"]) if j["has_media"] else "No Media"
            prod_color = GREEN if j["product_count"] > 0 else RED
            print(f"{j['job_id']:<38} | {meta['target']:<12} | {created:<16} | {prod_color}{j['product_count']:<16}{RESET} | {r_size:<12} | {m_size}")
    else:
        print("  No completed jobs with data found.")

    # 3. Failed or Stopped Jobs (Which might contain partial results!)
    if failed_stopped_jobs:
        print(f"\n{BOLD}{RED}❌ FAILED / STOPPED JOBS WITH PARTIAL DISK DATA:{RESET}")
        print(f"{'Job ID':<38} | {'Status':<10} | {'Target':<12} | {'Products Saved':<15} | {'Results Size':<12} | {'Media Archive'}")
        print("-" * 115)
        for j in failed_stopped_jobs:
            meta = j["metadata"]
            status = meta["status"].upper()
            r_size = format_size(j["results_size"])
            m_size = format_size(j["media_size"]) if j["has_media"] else "No Media"
            print(f"{j['job_id']:<38} | {status:<10} | {meta['target']:<12} | {j['product_count']:<15} | {r_size:<12} | {m_size}")

    # 4. Orphaned Data Folders (Folders that exist on disk but are deleted/missing from SQLite catalog)
    if orphaned_jobs:
        print(f"\n{BOLD}{MAGENTA}⚠️ ORPHANED JOB DATA FOLDERS (No database record found):{RESET}")
        print(f"{'Folder Name (Job ID)':<38} | {'Scraped Products':<18} | {'Results Size':<12} | {'Media Size':<12} | {'Action Recommended'}")
        print("-" * 115)
        for j in orphaned_jobs:
            r_size = format_size(j["results_size"])
            m_size = format_size(j["media_size"]) if j["has_media"] else "No Media"
            print(f"{j['job_id']:<38} | {j['product_count']:<18} | {r_size:<12} | {m_size:<12} | {MAGENTA}Safe to delete or re-index{RESET}")

    # 5. DB Jobs with missing folders (stale database rows)
    missing_jobs = []
    for job_id, meta in db_jobs.items():
        if job_id not in disk_job_ids:
            missing_jobs.append({
                "job_id": job_id,
                "metadata": meta
            })
            
    if missing_jobs:
        print(f"\n{BOLD}{RED}⚠️ STALE DATABASE JOB RECORDS (Files have been deleted from disk):{RESET}")
        print(f"{'Job ID':<38} | {'Status':<12} | {'Target':<12} | {'Created At':<16}")
        print("-" * 85)
        for j in missing_jobs:
            meta = j["metadata"]
            created = meta["created_at"][:16].replace("T", " ")
            print(f"{j['job_id']:<38} | {meta['status'].upper():<12} | {meta['target']:<12} | {created:<16}")

    # Overall summary stats panel
    print(f"\n{BOLD}{CYAN}================================================================================{RESET}")
    print(f"{BOLD}{CYAN} 💾 TOTAL DISK SPACE UTILIZATION & STATS{RESET}")
    print(f"{BOLD}{CYAN}================================================================================{RESET}")
    print(f"  • {BOLD}Total Job Folders on Disk:{RESET} {len(disk_job_ids)}")
    print(f"  • {BOLD}Total Scraped Products Logged:{RESET} {BOLD}{GREEN}{total_products_scraped:,}{RESET} items")
    print(f"  • {BOLD}Total space occupied by Results JSONs:{RESET} {CYAN}{format_size(total_results_size)}{RESET}")
    print(f"  • {BOLD}Total space occupied by Media ZIPs   :{RESET} {CYAN}{format_size(total_media_size)}{RESET}")
    print(f"  • {BOLD}Combined Disk Footprint of Jobs      :{RESET} {BOLD}{CYAN}{format_size(total_results_size + total_media_size)}{RESET}")
    print(f"{BOLD}{CYAN}================================================================================{RESET}")

def main():
    print(f"{BOLD}🔍 Pharmatch AI — Deep Crawler Data & Backup Analyzer{RESET}")
    print(f"🕒 Analysis Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📁 Backend Data Path: {DATA_DIR}")
    
    inspect_databases()
    inspect_jobs_data()

if __name__ == "__main__":
    main()
