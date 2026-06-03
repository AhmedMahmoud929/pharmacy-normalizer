#!/usr/bin/env python3
"""
Drug Matcher CLI Tool (Turbo v8)
Maps product names to the reference database using parallel processing.
"""

import argparse
import sys
import os
import json
import warnings
import difflib
import re
import concurrent.futures
import multiprocessing
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

# Suppress openpyxl warnings
warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

# Excel formatting helpers
ILLEGAL_CHARACTERS_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')

def clean_df_for_excel(df):
    """Removes Excel-illegal control characters from all string columns in the DataFrame."""
    import pandas as pd
    clean_fn = lambda x: ILLEGAL_CHARACTERS_RE.sub('', x) if isinstance(x, str) else x
    return df.map(clean_fn) if hasattr(df, 'map') else df.applymap(clean_fn)


# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Fix imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer import normalize
from normalizer.core.pipeline import create_pipeline
from normalizer.core.cleaner import clean, collapse_whitespace, remove_stop_words
from normalizer.core.arabic import normalize_arabic
from normalizer.core.mapper import map_arabic_tokens, map_abbreviations, map_arabic_number_words
from normalizer.core.units import process_units
from normalizer.core.tokenizer import reorder_tokens
from normalizer.core.equivalence import map_brands, normalize_form_synonyms, normalize_dose_equivalence

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn, MofNCompleteColumn

console = Console()
error_console = Console(stderr=True)

# ─────────────────────────────────────────────────────────────────────
#  Constants & Config
# ─────────────────────────────────────────────────────────────────────

DEFAULT_DB_PATH = os.path.join(project_root, "data", "normalized", "chefaa_products_eg_normalized.json")
RAW_DB_PATH = os.path.join(project_root, "data", "extracted", "chefaa_products_eg.json")

def resolve_db_path(db_path: str) -> str:
    if os.path.exists(db_path):
        return db_path
    if db_path == DEFAULT_DB_PATH and os.path.exists(RAW_DB_PATH):
        console.print(f"⚠️ [yellow]Warning: Normalized database not found at {DEFAULT_DB_PATH}. Falling back to raw database at {RAW_DB_PATH}...[/yellow]")
        return RAW_DB_PATH
    return db_path

NAME_COLUMN_CANDIDATES = [
    "name", "Name", "NAME",
    "الاسم", "الاسم الانجليزى", "الاسم العربي",
    "product_name", "Product Name", "item_name", "Item Name",
    "drug_name", "Drug Name",
]

LOW_WEIGHT_TOKENS = {
    "protect", "plus", "slim", "film", "coated", "48h", "72h", "deodorant", 
    "slow", "release", "sustained", "extra", "long", "thick", "soft",
    "gentle", "daily", "care", "advanced", "ultra", "pro", "max",
    "fragrance", "free", "natural", "active", "total", "original",
    "cotton", "cottony", "breathable", "sensitive", "growth", "nourishing",
    "caffeine", "anti", "dandruff", "fresh", "cool", "dry", "skin",
    "essentials", "travel", "size", "random", "color", "choice", "value", "pack", 
    "protection", "intensive", "total", "care", "instant", "granules", "in", 
    "topical", "flavor", "mouthwash", "toothpaste", "advance", "stage", 
    "prefilled", "fridge", "dry", "powder", "oral", "coated", "film", "sugar",
    "delayed", "release", "prolonged", "infantile", "action", "double", "paint",
    "wet", "wipes", "liquid"
}

SKIP_PATTERNS = [
    "razor", "blade", "shaving brush", "makeup brush", "makeup set",
    "comb", "hair brush", "eyelash", "nail clipper", "scissors",
    "tweezers", "glass cleaner", "handle", "loofah", "socks"
]

# ─────────────────────────────────────────────────────────────────────
#  Scoring Engine
# ─────────────────────────────────────────────────────────────────────

def get_token_similarity(t1: str, t2: str) -> float:
    if t1 == t2: return 1.0
    if t1.startswith(t2) or t2.startswith(t1):
        if abs(len(t1) - len(t2)) <= 2: return 0.9
    return difflib.SequenceMatcher(None, t1, t2).ratio()

def score_match_detailed(q_norm: str, c_norm: str, w_j: float = 0.7, w_s: float = 0.3) -> dict:
    if not isinstance(c_norm, str) or not c_norm:
        return {"score": 0.0, "jaccard": 0.0, "sequence": 0.0, "matched_tokens": [], "unmatched_query_tokens": [], "unmatched_db_tokens": []}
    
    q_tokens = q_norm.split()
    c_tokens = c_norm.split()
    
    if not q_tokens or not c_tokens:
        return {"score": 0.0, "jaccard": 0.0, "sequence": 0.0, "matched_tokens": [], "unmatched_query_tokens": list(q_tokens), "unmatched_db_tokens": list(c_tokens)}

    total_q_weight = 0.0
    weighted_intersection = 0.0
    matched_c_indices = set()
    matched_tokens = []
    unmatched_query_tokens = []
    
    for i, qt in enumerate(q_tokens):
        weight = 1.0
        if i == 0: weight = 3.0
        elif any(char.isdigit() for char in qt): weight = 2.0
        elif qt in LOW_WEIGHT_TOKENS: weight = 0.2
        
        total_q_weight += weight
        best_sim = 0.0
        best_idx = -1
        for j, ct in enumerate(c_tokens):
            if j in matched_c_indices: continue
            sim = get_token_similarity(qt, ct)
            if sim > best_sim:
                best_sim = sim
                best_idx = j
        
        if best_sim > 0.7:
            weighted_intersection += (best_sim * weight)
            if best_idx != -1:
                matched_c_indices.add(best_idx)
                matched_tokens.append(qt)
        else:
            unmatched_query_tokens.append(qt)

    unmatched_c_weight = sum((0.1 if c_tokens[j] in LOW_WEIGHT_TOKENS else 1.0) for j in range(len(c_tokens)) if j not in matched_c_indices)
    unmatched_db_tokens = [c_tokens[j] for j in range(len(c_tokens)) if j not in matched_c_indices]
    
    jaccard_weighted = weighted_intersection / (total_q_weight + unmatched_c_weight)
    seq_match = difflib.SequenceMatcher(None, q_norm, c_norm).ratio()
    final_score = (jaccard_weighted * w_j) + (seq_match * w_s)
    
    is_brand_exact = False
    if q_tokens and c_tokens:
        if q_tokens[0] in c_tokens: is_brand_exact = True

    query_coverage = len(matched_c_indices) / len(q_tokens) if q_tokens else 0
    if query_coverage >= 0.8: final_score *= 1.10

    q_nums = set(re.findall(r'\d+', q_norm))
    c_nums = set(re.findall(r'\d+', c_norm))
    
    if q_nums and c_nums:
        q_doses = set(re.findall(r'(\d+(?:\.\d+)?)\s*(?:mg|mcg|gm|iu|ml|l)', q_norm))
        c_doses = set(re.findall(r'(\d+(?:\.\d+)?)\s*(?:mg|mcg|gm|iu|ml|l)', c_norm))
        if q_doses and c_doses:
            if not q_doses.intersection(c_doses): final_score *= (0.90 if is_brand_exact else 0.70)
        elif not q_nums.intersection(c_nums): final_score *= (0.95 if is_brand_exact else 0.90)

    if q_tokens and q_tokens[0] not in matched_tokens:
        if any(c.isalpha() for c in q_tokens[0]): final_score *= 0.50

    return {"score": min(final_score, 1.0), "jaccard": round(jaccard_weighted, 4), "sequence": round(seq_match, 4),
            "matched_tokens": matched_tokens, "unmatched_query_tokens": unmatched_query_tokens, "unmatched_db_tokens": unmatched_db_tokens}

# ─────────────────────────────────────────────────────────────────────
#  Reference Indexing
# ─────────────────────────────────────────────────────────────────────

class ProductIndex:
    def __init__(self, products_data: List[Dict[str, Any]]):
        self.entries = []
        self.token_map = {}
        self._build_index(products_data)

    def _build_index(self, products_data: List[Dict[str, Any]]):
        for product in products_data:
            if "product_variants" in product:
                parent_norm = product.get("normalized_name_en")
                for variant in product.get("product_variants", []):
                    var_norm = variant.get("normalized_name_en") or parent_norm
                    if not var_norm: continue
                    idx = len(self.entries)
                    tokens = set(var_norm.split())
                    self.entries.append({"normalized": var_norm, "tokens": tokens, "product": product, "variant": variant})
                    for token in tokens:
                        if token not in self.token_map: self.token_map[token] = []
                        self.token_map[token].append(idx)
            else:
                title_en = product.get("title_en") or ""
                var_norm = product.get("normalized_name_en") or normalize(title_en)
                if not var_norm: continue
                
                brand_data = product.get("brands")
                brand_obj = None
                if brand_data:
                    brand_obj = {
                        "id": brand_data.get("id"),
                        "name": brand_data.get("title_en") or brand_data.get("title_ar"),
                        "name_en": brand_data.get("title_en") or brand_data.get("title_ar") or "",
                        "name_ar": brand_data.get("title_ar") or brand_data.get("title_en") or "",
                        "title_en": brand_data.get("title_en") or "",
                        "title_ar": brand_data.get("title_ar") or "",
                        "slug": brand_data.get("slug"),
                        "image": brand_data.get("images"),
                        "images": brand_data.get("images"),
                        "logo_url": brand_data.get("images")
                    }
                
                cat_data = product.get("level_one_category")
                cat_obj = None
                if cat_data:
                    cat_obj = {
                        "name": cat_data.get("title_en") or cat_data.get("title_ar"),
                        "name_en": cat_data.get("title_en") or "",
                        "name_ar": cat_data.get("title_ar") or "",
                        "title_en": cat_data.get("title_en") or "",
                        "title_ar": cat_data.get("title_ar") or "",
                        "slug": cat_data.get("slug")
                    }
                
                mapped_item = {
                    "id": str(product.get("id")),
                    "name_en": product.get("title_en"),
                    "name_ar": product.get("title_ar"),
                    "sku": product.get("slug") or str(product.get("id")),
                    "brand": brand_obj,
                    "brands": brand_data,
                    "category": cat_obj,
                    "level_one_category": cat_data,
                    "level_two_category": product.get("level_two_category"),
                    "level_three_category": product.get("level_three_category"),
                    "price": product.get("final_price") or product.get("price") or 0,
                    "in_stock": product.get("in_stock", True),
                    "stock": 10 if product.get("in_stock", True) else 0,
                    "share_link": product.get("full_url") or product.get("url") or "",
                    "image": product.get("image") or "",
                    "description_en": product.get("description_en") or product.get("meta_description_en") or "",
                    "description_ar": product.get("description_ar") or product.get("meta_description_ar") or "",
                    "unit": product.get("unit") or ""
                }
                
                idx = len(self.entries)
                tokens = set(var_norm.split())
                self.entries.append({"normalized": var_norm, "tokens": tokens, "product": mapped_item, "variant": mapped_item})
                for token in tokens:
                    if token not in self.token_map: self.token_map[token] = []
                    self.token_map[token].append(idx)

    def search(self, query_norm: str, top_k: int = 5, w_j: float = 0.7, w_s: float = 0.3) -> List[Dict[str, Any]]:
        query_tokens = set(query_norm.split())
        matching_tokens = [t for t in query_tokens if t in self.token_map]
        if not matching_tokens and len(query_tokens) > 0:
            if any(p in query_norm.lower() for p in SKIP_PATTERNS): return []
            return []

        candidates_idx = set()
        for t in query_tokens:
            if t in self.token_map: candidates_idx.update(self.token_map[t])
        
        candidates = [self.entries[i] for i in candidates_idx] if candidates_idx else self.entries
        fast_results = []
        for cand in candidates:
            cand_tokens = cand["tokens"]
            inter = query_tokens.intersection(cand_tokens)
            union = query_tokens.union(cand_tokens)
            jaccard = len(inter) / len(union) if union else 0
            fast_results.append((jaccard, cand))
        
        fast_results.sort(key=lambda x: x[0], reverse=True)
        results = []
        for jaccard_fast, cand in fast_results[:200]:
            details = score_match_detailed(query_norm, cand["normalized"], w_j, w_s)
            results.append({**details, "db_normalized": cand["normalized"], "candidate_count": len(candidates), "entry": cand})
            
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

# ─────────────────────────────────────────────────────────────────────
#  Parallel Workers
# ─────────────────────────────────────────────────────────────────────

_global_index = None

def init_worker(db_path: str):
    global _global_index
    resolved_path = resolve_db_path(db_path)
    with open(resolved_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    _global_index = ProductIndex(data)

def match_row_task(q_norm: str, top_k: int, w_j: float, w_s: float):
    if not q_norm or not isinstance(q_norm, str): return None
    return _global_index.search(q_norm, top_k=top_k, w_j=w_j, w_s=w_s)

# ─────────────────────────────────────────────────────────────────────
#  Execution Modes
# ─────────────────────────────────────────────────────────────────────

def run_sheet(file_path: str, index: ProductIndex, args):
    import pandas as pd
    if not os.path.exists(file_path): error_console.print(f"[red]Error: {file_path} not found[/red]"); sys.exit(1)
    ext = os.path.splitext(file_path)[1].lower()
    df = pd.read_excel(file_path) if ext in [".xlsx", ".xls"] else pd.read_csv(file_path)
    
    norm_col = "normalized_name"
    # v8 Force: Always re-normalize to ensure v6/v7 typo-tolerance is applied to all rows
    console.print(f"🛠️ [yellow]Force Normalizing column '{norm_col or 'Name'}'...[/yellow]")
    name_col = args.column or next((c for c in NAME_COLUMN_CANDIDATES if c in df.columns), None)
    if not name_col: error_console.print("[red]Error: Could not detect name column[/red]"); sys.exit(1)
    df[norm_col] = df[name_col].fillna("").astype(str).apply(normalize)

    total_rows = len(df)
    results_list = []
    stats = {"matched": 0, "review": 0, "no_match": 0, "sum_score": 0.0, "sum_score_matched": 0.0}
    m_thresh, r_thresh = args.match_threshold / 100, args.review_threshold / 100

    console.print(f"🚀 [bold cyan]Starting Matcher (Turbo v8)[/bold cyan] | Parallel: {args.parallel} | Workers: {args.workers or 'Auto'}")
    
    queries = df[norm_col].tolist()
    
    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), BarColumn(), 
                  MofNCompleteColumn(), TextColumn("[progress.percentage]{task.percentage:>3.0f}%"), 
                  TimeRemainingColumn(), console=console) as progress:
        task = progress.add_task(f"Matching {os.path.basename(file_path)}...", total=total_rows)
        
        if args.parallel:
            # v8 Safety: 16 workers x 2GB index = 32GB RAM (might crash). Limit to 4-8.
            workers = args.workers or min(os.cpu_count() or 1, 4)
            results_list = []
            stats = {"matched": 0, "review": 0, "no_match": 0, "sum_score": 0.0, "sum_score_matched": 0.0}
            
            resolved_db = resolve_db_path(args.db)
            with concurrent.futures.ProcessPoolExecutor(max_workers=workers, initializer=init_worker, initargs=(resolved_db,)) as executor:
                # Use executor.map to maintain row order
                for matches in executor.map(match_row_task, queries, [args.top]*total_rows, [args.jaccard_weight]*total_rows, [args.seq_weight]*total_rows):
                    results_list.append(process_matches(matches, m_thresh, r_thresh, stats, args))
                    progress.update(task, advance=1)
        else:
            for q in queries:
                matches = index.search(str(q), top_k=args.top, w_j=args.jaccard_weight, w_s=args.seq_weight)
                results_list.append(process_matches(matches, m_thresh, r_thresh, stats, args))
                progress.update(task, advance=1)


    final_df = pd.concat([df.reset_index(drop=True), pd.DataFrame(results_list)], axis=1)
    
    # 1. Apply range filtering if specified
    if args.export_range:
        try:
            parts = args.export_range.split("-")
            start_idx = max(1, int(parts[0])) - 1
            end_idx = int(parts[1])
            final_df = final_df.iloc[start_idx:end_idx]
            console.print(f"✂️ [yellow]Exporting range bounds: rows {start_idx + 1} to {end_idx} (Total: {len(final_df)} rows)[/yellow]")
        except Exception as e:
            console.print(f"⚠️ [yellow]Warning: Failed to parse export range '{args.export_range}'. Exporting all rows. Error: {e}[/yellow]")

    # 2. Apply field selection if specified
    if args.export_fields:
        selected_cols = [c.strip() for c in args.export_fields.split(",") if c.strip()]
        existing_cols = [c for c in selected_cols if c in final_df.columns]
        if existing_cols:
            final_df = final_df[existing_cols]
            console.print(f"📋 [yellow]Exporting selected columns: {', '.join(existing_cols)}[/yellow]")
        else:
            console.print("⚠️ [yellow]Warning: None of the specified export-fields were found in the output. Exporting all fields.[/yellow]")

    # 3. Determine output path and format
    fmt = args.export_type or "xlsx"
    ext_map = {"xlsx": ".xlsx", "json": ".json", "txt": ".txt"}
    target_ext = ext_map.get(fmt, ".xlsx")

    out_dir = os.path.join(project_root, "data", "normalized")
    os.makedirs(out_dir, exist_ok=True)

    if args.output:
        if not args.output.lower().endswith(target_ext):
            output_path = os.path.splitext(args.output)[0] + target_ext
        else:
            output_path = args.output
    else:
        output_path = os.path.join(out_dir, f"{os.path.splitext(os.path.basename(file_path))[0]}_matched{target_ext}")

    # 4. Serialize to chosen format
    if fmt == "xlsx":
        final_df = clean_df_for_excel(final_df)
        final_df.to_excel(output_path, index=False)
    elif fmt == "json":
        final_df.to_json(output_path, orient="records", indent=2, force_ascii=False)
    elif fmt == "txt":
        final_df.to_csv(output_path, index=False, sep="\t")
    
    console.print(f"\n✅ [bold green]Matching complete![/bold green]")
    console.print(f"📂 [cyan]Output saved to:[/cyan] [bold]{output_path}[/bold]")
    
    summary_path = os.path.splitext(output_path)[0] + "_summary.json"
    summary = {"total": total_rows, "matched": stats["matched"], "review": stats["review"], "no_match": stats["no_match"],
               "matched_pct": round(stats["matched"]/total_rows*100, 1), "avg_score": round(stats["sum_score"]/total_rows, 3)}
    with open(summary_path, "w") as f: json.dump(summary, f, indent=2)
    console.print(f"📊 [cyan]Summary JSON saved to:[/cyan] [bold]{summary_path}[/bold]\n")

    # Always show summary table if not in JSON mode
    if not args.json:
        t = Table(title=f"Performance Summary: {os.path.basename(file_path)}", box=box.ROUNDED, header_style="bold magenta")
        t.add_column("Metric", style="cyan"); t.add_column("Count", justify="right"); t.add_column("Percentage", justify="right")
        t.add_row("Matched", str(stats["matched"]), f"[green]{summary['matched_pct']}%[/green]")
        t.add_row("Review", str(stats["review"]), f"[yellow]{round(stats['review']/total_rows*100,1)}%[/yellow]")
        t.add_row("No Match", str(stats["no_match"]), f"[red]{round(stats['no_match']/total_rows*100,1)}%[/red]")
        t.add_section()
        t.add_row("Avg Score", f"{summary['avg_score']*100:.1f}%", "")
        console.print(t)

def process_matches(matches, m_thresh, r_thresh, stats, args):
    res_row = {}
    if matches:
        top = matches[0]; score = top["score"]
        status = "matched" if score >= m_thresh else ("review" if score >= r_thresh else "no_match")
        stats[status] += 1; stats["sum_score"] += score
        if status == "matched": stats["sum_score_matched"] += score
        prod, var = top["entry"]["product"], top["entry"]["variant"]
        res_row.update({
            "match_status": status, 
            "match_score": round(score, 3), 
            "matched_id": prod.get("id"), 
            "matched_sku": var.get("sku"), 
            "matched_name_en": prod.get("name_en"),
            "db_normalized": top.get("db_normalized"),
            "jaccard_score": top.get("jaccard"),
            "sequence_score": top.get("sequence"),
            "matched_tokens": ", ".join(top.get("matched_tokens", [])),
            "unmatched_query": ", ".join(top.get("unmatched_query_tokens", [])),
            "unmatched_db": ", ".join(top.get("unmatched_db_tokens", [])),
            "candidate_count": top.get("candidate_count")
        })
        for k in range(args.top):
            prefix = f"candidate_{k+1}_"
            if k < len(matches):
                m = matches[k]; m_p, m_v = m["entry"]["product"], m["entry"]["variant"]
                res_row.update({
                    f"{prefix}score": round(m["score"], 3), 
                    f"{prefix}id": m_p.get("id"), 
                    f"{prefix}name_en": m_p.get("name_en"),
                    f"{prefix}db_normalized": m.get("db_normalized"),
                    f"{prefix}jaccard": m.get("jaccard"),
                    f"{prefix}sequence": m.get("sequence"),
                    f"{prefix}matched": ", ".join(m.get("matched_tokens", []))
                })
    else:
        stats["no_match"] += 1; res_row.update({"match_status": "no_match", "match_score": 0.0})
    return res_row

def run_single(query: str, index: ProductIndex, args):
    norm_q = normalize(query)
    matches = index.search(norm_q, top_k=args.top, w_j=args.jaccard_weight, w_s=args.seq_weight)
    
    if args.json:
        serializable_matches = []
        for m in matches:
            prod = m["entry"]["product"]
            var = m["entry"]["variant"]
            serializable_matches.append({
                "score": round(m["score"], 3),
                "id": prod.get("id"),
                "sku": var.get("sku") if var else None,
                "name_en": prod.get("name_en") or prod.get("title_en"),
                "normalized": m["entry"]["normalized"]
            })
        print(json.dumps(serializable_matches, indent=2, ensure_ascii=False))
        return

    console.print(f"\n🔍 [bold cyan]Query:[/bold cyan] [bold]{query}[/bold] (Normalized: [italic]{norm_q}[/italic])\n")
    
    if not matches:
        console.print("[bold red]❌ No matches found.[/bold red]")
        return
        
    t = Table(title="Matching Results", box=box.ROUNDED, header_style="bold magenta")
    t.add_column("Rank", justify="center", style="dim")
    t.add_column("Score", justify="right", style="bold green")
    t.add_column("Matched ID", justify="center")
    t.add_column("Matched Name (EN)", style="green")
    t.add_column("DB Normalized", style="cyan")
    
    for idx, m in enumerate(matches):
        prod = m["entry"]["product"]
        score_pct = m["score"] * 100
        score_str = f"{score_pct:.1f}%"
        if score_pct < 50:
            score_str = f"[red]{score_str}[/red]"
        elif score_pct < 80:
            score_str = f"[yellow]{score_str}[/yellow]"
            
        t.add_row(
            str(idx + 1),
            score_str,
            str(prod.get("id")),
            prod.get("name_en") or prod.get("title_en") or "",
            m["entry"]["normalized"]
        )
    console.print(t)

def main():
    parser = argparse.ArgumentParser(description="Drug Matcher CLI Tool (Turbo v8)")
    parser.add_argument("query", nargs="?", help="Single product name to match")
    parser.add_argument("--file", "-f", help="Input sheet path")
    parser.add_argument("--column", "-c", help="Name column override")
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help="Path to reference JSON")
    parser.add_argument("--top", type=int, default=5, help="Number of candidates")
    parser.add_argument("--match-threshold", type=float, default=60.0, help="Minimum score for automatic match (default: 60.0)")
    parser.add_argument("--review-threshold", type=float, default=40.0, help="Minimum score for pharmacist review (default: 40.0)")
    parser.add_argument("--jaccard-weight", type=float, default=0.7)
    parser.add_argument("--seq-weight", type=float, default=0.3)
    parser.add_argument("--parallel", action="store_true", help="Enable multi-core processing")
    parser.add_argument("--workers", type=int, help="Number of parallel workers")
    parser.add_argument("--rich", action="store_true", help="Show rich statistical summary")
    parser.add_argument("--yes", "-y", action="store_true", help="Auto-confirm")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show progress")
    parser.add_argument("--json", action="store_true", help="JSON output")
    
    # Advanced Export Overrides
    parser.add_argument("--export-type", choices=["xlsx", "json", "txt"], default="xlsx", help="Export file format type (default: xlsx)")
    parser.add_argument("--export-fields", type=str, help="Comma-separated list of columns to include in output")
    parser.add_argument("--export-range", type=str, help="Contiguous subset range to export (e.g. '1-100')")
    
    args = parser.parse_args()

    if not args.query and not args.file: parser.print_help(); sys.exit(0)
    # Turbo v8.2: Enable Arabic mapping to catch cosmetic/personal care items
    norm_fn = create_pipeline(enable_arabic=True)
    index = None if args.parallel else load_reference(args.db)
    if args.query: 
        run_single(args.query, index, args)
    elif args.file: run_sheet(args.file, index, args)

def load_reference(db_path: str) -> ProductIndex:
    resolved_path = resolve_db_path(db_path)
    
    with open(resolved_path, "r", encoding="utf-8") as f:
        content = f.read().strip()
        
    if content.startswith("["):
        content = content[1:]
    if content.endswith("]"):
        content = content[:-1]
        
    raw_objects = content.split("\n  },")
    products = []
    
    for obj_str in raw_objects:
        obj_str = obj_str.strip()
        if not obj_str:
            continue
        if not obj_str.endswith("}"):
            obj_str += "}"
        try:
            products.append(json.loads(obj_str))
        except:
            pass
            
    return ProductIndex(products)

if __name__ == "__main__":
    multiprocessing.set_start_method('spawn', force=True) # Required for Windows + Multiprocessing
    main()
