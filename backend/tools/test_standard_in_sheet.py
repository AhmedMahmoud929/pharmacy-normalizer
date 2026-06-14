#!/usr/bin/env python3
"""
Coverage spot-check: pick items from the standard Chefaa catalog (source) and
search for them inside sheet_with_code.xlsx (destination).

Direction:
  source      → backend/data/normalized/chefaa_products_eg_normalized.json (~29k)
  destination → backend/data/input/sheet_with_code.xlsx (~31k)

Steps:
  1. Normalize the destination sheet (adds normalized_name column).
  2. Build a ProductIndex from the normalized destination rows.
  3. Sample N catalog items and run the matcher against the destination index.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import multiprocessing
import os
import random
import sys
import time

import pandas as pd
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, MofNCompleteColumn, Progress, SpinnerColumn, TextColumn, TimeRemainingColumn
from rich.table import Table

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer import normalize
from tools.matcher import ProductIndex, DEFAULT_DB_PATH, resolve_db_path
from tools.normalize import normalize_sheet

console = Console()

DEFAULT_SHEET = os.path.join(project_root, "data", "input", "sheet_with_code.xlsx")
DEFAULT_SHEET_NORMALIZED = os.path.join(
    project_root, "data", "normalized", "sheet_with_code_normalized.xlsx"
)
DEFAULT_NAME_COLUMN = "en name"
DEFAULT_FULL_REPORT = os.path.join(
    project_root, "data", "normalized", "sheet_coverage_report.xlsx"
)
SHEET_INDEX_CACHE = os.path.join(project_root, "data", "tmp", "sheet_dest_index.json")

_sheet_worker_index = None


def init_sheet_worker(index_json_path: str) -> None:
    global _sheet_worker_index
    with open(index_json_path, "r", encoding="utf-8") as f:
        products = json.load(f)
    _sheet_worker_index = ProductIndex(products)


def match_catalog_item(task: tuple) -> dict:
    product, norm_query, top_k, match_threshold, review_threshold = task
    matches = _sheet_worker_index.search(norm_query, top_k=top_k)
    best = matches[0] if matches else None
    best_score = best["score"] if best else 0.0
    status = classify_match(best_score, match_threshold, review_threshold)

    row = {
        "source_id": product.get("id"),
        "source_name": product.get("title_en") or product.get("name_en") or "",
        "source_normalized": norm_query,
        "status": status,
        "best_score": round(best_score, 4),
        "dest_id": "",
        "dest_name": "",
        "dest_normalized": "",
        "dest_code": "",
    }
    if best:
        entry = best["entry"]["product"]
        row["dest_id"] = entry.get("id", "")
        row["dest_name"] = entry.get("title_en", "")
        row["dest_normalized"] = best["entry"]["normalized"]
        row["dest_code"] = entry.get("code", "")
    return row


def write_sheet_index_cache(products: list[dict], cache_path: str) -> None:
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False)


def enrich_rows_with_dest_fields(rows: list[dict], dest_products: list[dict]) -> None:
    """Attach dest_code and dest_international_barcode from the destination sheet."""
    lookup = {
        str(p["id"]): {
            "dest_code": p.get("code"),
            "dest_international_barcode": p.get("international_barcode"),
        }
        for p in dest_products
    }
    for row in rows:
        dest_id = row.get("dest_id")
        if dest_id is None or dest_id == "":
            row["dest_code"] = ""
            row["dest_international_barcode"] = ""
            continue
        dest_key = str(int(dest_id)) if not isinstance(dest_id, str) else dest_id.split(".")[0]
        fields = lookup.get(dest_key, {})
        row["dest_code"] = fields.get("dest_code", "")
        row["dest_international_barcode"] = fields.get("dest_international_barcode", "")


def load_standard_catalog(path: str) -> list[dict]:
    resolved = resolve_db_path(path)
    if not os.path.exists(resolved):
        console.print(f"[bold red]Standard catalog not found:[/bold red] {resolved}")
        sys.exit(1)

    console.print(f"[dim]Loading standard catalog from {resolved}...[/dim]")
    with open(resolved, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        console.print("[bold red]Expected standard catalog to be a JSON array.[/bold red]")
        sys.exit(1)
    return data


def sheet_rows_to_products(df: pd.DataFrame) -> list[dict]:
    products = []
    for _, row in df.iterrows():
        norm_name = str(row.get("normalized_name", "") or "").strip()
        title = str(row.get(DEFAULT_NAME_COLUMN, "") or "").strip()
        if not norm_name and title:
            norm_name = normalize(title)
        if not norm_name:
            continue
        products.append(
            {
                "id": str(row.get("id", "")),
                "title_en": title,
                "normalized_name_en": norm_name,
                "slug": row.get("slug"),
                "code": row.get("code"),
                "international_barcode": row.get("international_barcode"),
                "unit_price": row.get("unit_price"),
            }
        )
    return products


def pick_source_samples(catalog: list[dict], count: int, seed: int) -> list[dict]:
    eligible = [
        p for p in catalog
        if (p.get("normalized_name_en") or "").strip()
        and (p.get("title_en") or p.get("name_en") or "").strip()
    ]
    if len(eligible) < count:
        console.print(
            f"[yellow]Only {len(eligible)} eligible catalog rows; using all of them.[/yellow]"
        )
        return eligible

    rng = random.Random(seed)
    return rng.sample(eligible, count)


def prepare_destination(
    sheet_path: str,
    sheet_normalized_path: str,
    skip_normalize: bool,
) -> tuple[list[dict], set[str]]:
    if not skip_normalize:
        console.print("\n[bold yellow]Step 1 — Normalizing destination sheet[/bold yellow]")
        normalize_sheet(
            file_path=sheet_path,
            column=DEFAULT_NAME_COLUMN,
            output=sheet_normalized_path,
        )
    else:
        console.print("\n[dim]Step 1 — Skipping normalization (--skip-normalize)[/dim]")

    if not os.path.exists(sheet_normalized_path):
        console.print(f"[bold red]Normalized sheet not found:[/bold red] {sheet_normalized_path}")
        sys.exit(1)

    console.print("\n[bold yellow]Step 2 — Building destination index[/bold yellow]")
    dest_df = pd.read_excel(sheet_normalized_path)
    dest_products = sheet_rows_to_products(dest_df)
    dest_norm_set = {p["normalized_name_en"] for p in dest_products}
    console.print(f"  Destination rows indexed: [green]{len(dest_products):,}[/green]")
    return dest_products, dest_norm_set


def print_summary(
    status_counts: dict[str, int],
    total: int,
    match_threshold: float,
    review_threshold: float,
    dest_count: int,
    catalog_count: int,
    elapsed_sec: float,
    report_path: str | None = None,
) -> None:
    matched_pct = status_counts["matched"] / total * 100 if total else 0
    review_pct = status_counts["review"] / total * 100 if total else 0
    no_match_pct = status_counts["no_match"] / total * 100 if total else 0
    exact_pct = status_counts["exact"] / total * 100 if total else 0

    body = (
        f"[bold]Summary[/bold]\n\n"
        f"  Matcher ≥ {match_threshold * 100:.0f}% (matched) : "
        f"[green]{status_counts['matched']:,}[/green] / {total:,} ({matched_pct:.1f}%)\n"
        f"  Matcher ≥ {review_threshold * 100:.0f}% (review)  : "
        f"[yellow]{status_counts['review']:,}[/yellow] / {total:,} ({review_pct:.1f}%)\n"
        f"  Below review threshold            : "
        f"[red]{status_counts['no_match']:,}[/red] / {total:,} ({no_match_pct:.1f}%)\n"
        f"  Exact normalized in destination   : "
        f"{status_counts['exact']:,} / {total:,} ({exact_pct:.1f}%)\n\n"
        f"  Destination indexed rows          : {dest_count:,}\n"
        f"  Standard catalog rows             : {catalog_count:,}\n"
        f"  Elapsed                           : {elapsed_sec / 60:.1f} min"
    )
    if report_path:
        body += f"\n  Report saved                      : {report_path}"
    console.print(Panel(body, border_style="green"))


def classify_match(score: float, match_threshold: float, review_threshold: float) -> str:
    if score >= match_threshold:
        return "matched"
    if score >= review_threshold:
        return "review"
    return "no_match"


def run_full_scan(
    sheet_path: str,
    sheet_normalized_path: str,
    standard_path: str,
    top_k: int,
    match_threshold: float,
    review_threshold: float,
    skip_normalize: bool,
    parallel: bool,
    workers: int | None,
    output_path: str,
) -> None:
    worker_count = workers or min(multiprocessing.cpu_count() or 1, 8)
    console.print(
        Panel(
            "[bold]Full catalog → sheet coverage scan[/bold]\n\n"
            f"  [cyan]Source (queries)[/cyan]      : {standard_path}\n"
            f"  [magenta]Destination (index)[/magenta]: {sheet_path}\n"
            f"  [dim]Parallel[/dim]                : {parallel} ({worker_count} workers)\n"
            f"  [dim]Report[/dim]                  : {output_path}",
            border_style="blue",
        )
    )

    started = time.perf_counter()
    dest_products, dest_norm_set = prepare_destination(
        sheet_path, sheet_normalized_path, skip_normalize
    )
    catalog = load_standard_catalog(standard_path)
    samples = pick_source_samples(catalog, len(catalog), seed=0)
    console.print(f"  Standard catalog size : [cyan]{len(catalog):,}[/cyan]")
    console.print(f"  Queries to match      : [cyan]{len(samples):,}[/cyan]")

    console.print("\n[bold yellow]Step 3 — Matching all catalog items → destination[/bold yellow]")
    tasks = []
    for product in samples:
        raw_name = product.get("title_en") or product.get("name_en") or ""
        norm_query = (product.get("normalized_name_en") or "").strip() or normalize(raw_name)
        tasks.append((product, norm_query, top_k, match_threshold, review_threshold))

    rows: list[dict] = []
    if parallel:
        write_sheet_index_cache(dest_products, SHEET_INDEX_CACHE)
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
            console=console,
        ) as progress:
            task_id = progress.add_task("Matching catalog...", total=len(tasks))
            with concurrent.futures.ProcessPoolExecutor(
                max_workers=worker_count,
                initializer=init_sheet_worker,
                initargs=(SHEET_INDEX_CACHE,),
            ) as executor:
                for row in executor.map(match_catalog_item, tasks, chunksize=64):
                    row["exact_in_destination"] = row["source_normalized"] in dest_norm_set
                    rows.append(row)
                    progress.update(task_id, advance=1)
    else:
        dest_index = ProductIndex(dest_products)
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeRemainingColumn(),
            console=console,
        ) as progress:
            task_id = progress.add_task("Matching catalog...", total=len(tasks))
            for product, norm_query, tk, _, _ in tasks:
                matches = dest_index.search(norm_query, top_k=tk)
                best = matches[0] if matches else None
                best_score = best["score"] if best else 0.0
                row = {
                    "source_id": product.get("id"),
                    "source_name": product.get("title_en") or product.get("name_en") or "",
                    "source_normalized": norm_query,
                    "exact_in_destination": norm_query in dest_norm_set,
                    "status": classify_match(best_score, match_threshold, review_threshold),
                    "best_score": round(best_score, 4),
                    "dest_id": "",
                    "dest_name": "",
                    "dest_normalized": "",
                    "dest_code": "",
                }
                if best:
                    entry = best["entry"]["product"]
                    row["dest_id"] = entry.get("id", "")
                    row["dest_name"] = entry.get("title_en", "")
                    row["dest_normalized"] = best["entry"]["normalized"]
                    row["dest_code"] = entry.get("code", "")
                rows.append(row)
                progress.update(task_id, advance=1)

    enrich_rows_with_dest_fields(rows, dest_products)
    report_df = pd.DataFrame(rows)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    report_df.to_excel(output_path, index=False, engine="openpyxl")

    status_counts = {"matched": 0, "review": 0, "no_match": 0, "exact": 0}
    for row in rows:
        status_counts[row["status"]] += 1
        if row["exact_in_destination"]:
            status_counts["exact"] += 1

    print_summary(
        status_counts,
        len(rows),
        match_threshold,
        review_threshold,
        len(dest_products),
        len(catalog),
        time.perf_counter() - started,
        output_path,
    )


def run_test(
    sheet_path: str,
    sheet_normalized_path: str,
    standard_path: str,
    sample_count: int,
    seed: int,
    top_k: int,
    match_threshold: float,
    review_threshold: float,
    skip_normalize: bool,
) -> None:
    console.print(
        Panel(
            "[bold]Standard catalog → sheet_with_code coverage test[/bold]\n\n"
            f"  [cyan]Source (queries)[/cyan]      : {standard_path}\n"
            f"  [magenta]Destination (index)[/magenta]: {sheet_path}\n"
            f"  [dim]Samples[/dim]                : {sample_count} (seed={seed})",
            border_style="blue",
        )
    )

    dest_products, dest_norm_set = prepare_destination(
        sheet_path, sheet_normalized_path, skip_normalize
    )
    dest_index = ProductIndex(dest_products)

    console.print("\n[bold yellow]Step 3 — Sampling source catalog items[/bold yellow]")
    catalog = load_standard_catalog(standard_path)
    samples = pick_source_samples(catalog, sample_count, seed)
    console.print(f"  Standard catalog size : [cyan]{len(catalog):,}[/cyan]")
    console.print(f"  Sampled for test      : [cyan]{len(samples)}[/cyan]")

    console.print("\n[bold yellow]Step 4 — Matching source → destination[/bold yellow]\n")

    results = []
    for i, product in enumerate(samples, start=1):
        raw_name = product.get("title_en") or product.get("name_en") or ""
        norm_query = (product.get("normalized_name_en") or "").strip() or normalize(raw_name)
        exact_hit = norm_query in dest_norm_set

        matches = dest_index.search(norm_query, top_k=top_k)
        best = matches[0] if matches else None
        best_score = best["score"] if best else 0.0
        status = classify_match(best_score, match_threshold, review_threshold)

        best_dest = None
        if best:
            entry = best["entry"]["product"]
            best_dest = {
                "id": entry.get("id"),
                "title_en": entry.get("title_en"),
                "normalized_name_en": best["entry"]["normalized"],
                "code": entry.get("code"),
            }

        results.append(
            {
                "index": i,
                "source_id": product.get("id"),
                "source_name": raw_name,
                "source_normalized": norm_query,
                "exact_in_destination": exact_hit,
                "status": status,
                "best_score": best_score,
                "best_dest": best_dest,
                "top_matches": matches,
            }
        )

    table = Table(
        title=f"Source → Destination match results ({len(results)} samples)",
        box=box.ROUNDED,
        header_style="bold magenta",
        show_lines=True,
    )
    table.add_column("#", justify="center", style="dim")
    table.add_column("Source (standard catalog)", style="cyan", max_width=36)
    table.add_column("Normalized query", style="dim", max_width=30)
    table.add_column("Exact?", justify="center")
    table.add_column("Best score", justify="right")
    table.add_column("Status", justify="center")
    table.add_column("Best destination match", style="green", max_width=36)

    status_counts = {"matched": 0, "review": 0, "no_match": 0, "exact": 0}

    for r in results:
        if r["exact_in_destination"]:
            status_counts["exact"] += 1
        status_counts[r["status"]] += 1

        exact_str = "[green]yes[/green]" if r["exact_in_destination"] else "[red]no[/red]"
        score_pct = r["best_score"] * 100
        score_str = f"{score_pct:.1f}%"
        if score_pct >= match_threshold * 100:
            score_str = f"[green]{score_str}[/green]"
        elif score_pct >= review_threshold * 100:
            score_str = f"[yellow]{score_str}[/yellow]"
        else:
            score_str = f"[red]{score_str}[/red]"

        status = r["status"]
        if status == "matched":
            status_str = "[green]matched[/green]"
        elif status == "review":
            status_str = "[yellow]review[/yellow]"
        else:
            status_str = "[red]no_match[/red]"

        dest_label = "—"
        if r["best_dest"]:
            dest_label = r["best_dest"]["title_en"] or r["best_dest"]["normalized_name_en"]

        table.add_row(
            str(r["index"]),
            str(r["source_name"])[:36],
            str(r["source_normalized"])[:30],
            exact_str,
            score_str,
            status_str,
            str(dest_label)[:36],
        )

    console.print(table)

    print_summary(
        status_counts,
        len(results),
        match_threshold,
        review_threshold,
        len(dest_products),
        len(catalog),
        0.0,
    )

    console.print("\n[bold]Detailed top matches per sample[/bold]\n")
    for r in results:
        console.print(
            f"[bold cyan]#{r['index']}[/bold cyan] "
            f"[white]{r['source_name']}[/white] "
            f"([dim]{r['source_normalized']}[/dim])"
        )
        if not r["top_matches"]:
            console.print("  [red]No candidates returned by matcher.[/red]\n")
            continue
        detail = Table(box=box.SIMPLE, show_header=True, header_style="bold")
        detail.add_column("Rank", justify="center")
        detail.add_column("Score", justify="right")
        detail.add_column("Destination name", style="green")
        detail.add_column("Destination normalized", style="dim")
        detail.add_column("ID")
        detail.add_column("Code")
        for rank, m in enumerate(r["top_matches"][:top_k], start=1):
            prod = m["entry"]["product"]
            detail.add_row(
                str(rank),
                f"{m['score'] * 100:.1f}%",
                str(prod.get("title_en", ""))[:50],
                str(m["entry"]["normalized"])[:50],
                str(prod.get("id", "")),
                str(prod.get("code", "")),
            )
        console.print(detail)
        console.print()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Test whether standard catalog items appear in sheet_with_code.xlsx"
    )
    parser.add_argument(
        "--sheet",
        default=DEFAULT_SHEET,
        help="Destination Excel file (default: sheet_with_code.xlsx)",
    )
    parser.add_argument(
        "--sheet-normalized",
        default=DEFAULT_SHEET_NORMALIZED,
        help="Output path for normalized destination sheet",
    )
    parser.add_argument(
        "--standard",
        default=DEFAULT_DB_PATH,
        help="Source standard catalog JSON (default: chefaa_products_eg_normalized.json)",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=10,
        help="Number of catalog items to sample (default: 10)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for sampling (default: 42)",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=3,
        help="Top-K destination candidates per query (default: 3)",
    )
    parser.add_argument(
        "--match-threshold",
        type=float,
        default=0.60,
        help="Score threshold for a confident match (default: 0.60)",
    )
    parser.add_argument(
        "--review-threshold",
        type=float,
        default=0.40,
        help="Score threshold for review (default: 0.40)",
    )
    parser.add_argument(
        "--skip-normalize",
        action="store_true",
        help="Skip re-normalizing the destination sheet",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Match the entire standard catalog (~30k) instead of a sample",
    )
    parser.add_argument(
        "--parallel",
        action="store_true",
        help="Use multiple CPU workers (recommended with --full)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,
        help="Worker count for --parallel (default: min(cpu_count, 8))",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_FULL_REPORT,
        help="Excel report path for --full mode",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.full:
        run_full_scan(
            sheet_path=args.sheet,
            sheet_normalized_path=args.sheet_normalized,
            standard_path=args.standard,
            top_k=args.top,
            match_threshold=args.match_threshold,
            review_threshold=args.review_threshold,
            skip_normalize=args.skip_normalize,
            parallel=args.parallel,
            workers=args.workers,
            output_path=args.output,
        )
        return
    run_test(
        sheet_path=args.sheet,
        sheet_normalized_path=args.sheet_normalized,
        standard_path=args.standard,
        sample_count=args.count,
        seed=args.seed,
        top_k=args.top,
        match_threshold=args.match_threshold,
        review_threshold=args.review_threshold,
        skip_normalize=args.skip_normalize,
    )


if __name__ == "__main__":
    main()
