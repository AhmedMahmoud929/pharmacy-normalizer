#!/usr/bin/env python3
"""Benchmark barcode vs code vs normalizer matching on 10 known catalog items."""

from __future__ import annotations

import os
import sys
import time
import statistics
from typing import Callable, Optional

from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)

tools_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(tools_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from tools.matcher import ProductIndex, DEFAULT_DB_PATH, normalize
from tools.matcher_runner import load_reference_db, _process_single_row

WARMUP = 3
REPEATS = 50
SAMPLE_SIZE = 10

console = Console()
METHODS = ("barcode lookup", "code lookup", "normalizer search", "full barcode", "full code", "full normalizer")


def ms(seconds: float) -> float:
    return round(seconds * 1000, 3)


def bench(
    fn: Callable[[], object],
    repeats: int = REPEATS,
    on_tick: Optional[Callable[[], None]] = None,
) -> dict:
    for _ in range(WARMUP):
        fn()
    times = []
    for _ in range(repeats):
        start = time.perf_counter()
        fn()
        times.append(time.perf_counter() - start)
        if on_tick:
            on_tick()
    return {
        "mean_ms": ms(statistics.mean(times)),
        "median_ms": ms(statistics.median(times)),
        "min_ms": ms(min(times)),
        "max_ms": ms(max(times)),
        "total_ms": ms(sum(times)),
    }


def pick_samples(
    products_data: list,
    index: ProductIndex,
    n: int = SAMPLE_SIZE,
    progress: Optional[Progress] = None,
    task_id: Optional[int] = None,
) -> list[dict]:
    samples = []
    for product in products_data:
        if progress and task_id is not None:
            progress.update(
                task_id,
                description=f"Scanning catalog for samples ({len(samples)}/{n})...",
            )
        code = str(product.get("code") or "").strip()
        barcode = str(product.get("international_barcode") or "").strip()
        norm_name = product.get("normalized_name_en") or normalize(product.get("title_en") or "")
        if not code or not barcode or not norm_name:
            if progress and task_id is not None:
                progress.advance(task_id)
            continue
        if not index.lookup_entry_by_barcode(barcode) or not index.lookup_entry_by_code(code):
            if progress and task_id is not None:
                progress.advance(task_id)
            continue
        samples.append({
            "id": product.get("id"),
            "name": product.get("title_en") or product.get("name_en") or "",
            "norm_name": norm_name,
            "code": code,
            "barcode": barcode,
        })
        if progress and task_id is not None:
            progress.advance(task_id)
        if len(samples) >= n:
            break
    return samples


def main() -> None:
    console.print("[bold cyan]Match method benchmark[/bold cyan]")
    console.print(f"Catalog: [dim]{DEFAULT_DB_PATH}[/dim]\n")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        console=console,
        transient=False,
    ) as progress:
        load_task = progress.add_task("Loading catalog JSON...", total=1)
        t0 = time.perf_counter()
        products_data = load_reference_db()
        progress.update(load_task, description="Building product index...")
        index = ProductIndex(products_data)
        progress.advance(load_task)
        load_ms = ms(time.perf_counter() - t0)

        scan_task = progress.add_task("Scanning catalog for samples...", total=len(products_data))
        samples = pick_samples(products_data, index, SAMPLE_SIZE, progress, scan_task)
        progress.update(scan_task, description=f"Found {len(samples)} sample(s)")

    if len(samples) < SAMPLE_SIZE:
        raise SystemExit(f"Only found {len(samples)} valid samples (need {SAMPLE_SIZE})")

    console.print(
        f"Products loaded: {len(products_data):,} | "
        f"Index entries: {len(index.entries):,} | "
        f"Barcodes: {len(index.barcode_map):,} | "
        f"Codes: {len(index.code_map):,} | "
        f"Index build: {load_ms} ms\n"
    )

    console.print(f"Benchmarking {len(samples)} items × {REPEATS} repeats × {len(METHODS)} methods\n")
    console.print(f"{'#':<3} {'Product':<45} {'Barcode':>10} {'Code':>10} {'Normalizer':>12}")
    console.print("-" * 85)

    barcode_times = []
    code_times = []
    normalizer_times = []
    full_barcode_times = []
    full_code_times = []
    full_normalizer_times = []

    benchmark_steps = len(samples) * len(METHODS)
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        console=console,
        transient=False,
    ) as progress:
        bench_task = progress.add_task("Benchmarking...", total=benchmark_steps)

        def tick(method: str, sample_idx: int) -> Callable[[], None]:
            def _tick() -> None:
                progress.update(
                    bench_task,
                    description=f"Item {sample_idx}/{len(samples)} — {method} (repeat)",
                )
            return _tick

        def step(method: str, sample_idx: int) -> None:
            progress.update(bench_task, description=f"Item {sample_idx}/{len(samples)} — {method}")
            progress.advance(bench_task)

        for i, sample in enumerate(samples, 1):
            b = bench(
                lambda s=sample: index.lookup_entry_by_barcode(s["barcode"]),
                on_tick=tick("barcode lookup", i),
            )
            step("barcode lookup", i)

            c = bench(
                lambda s=sample: index.lookup_entry_by_code(s["code"]),
                on_tick=tick("code lookup", i),
            )
            step("code lookup", i)

            n = bench(
                lambda s=sample: index.search(s["norm_name"], top_k=5),
                on_tick=tick("normalizer search", i),
            )
            step("normalizer search", i)

            fb = bench(
                lambda s=sample: _process_single_row(
                    0, s["name"], s["norm_name"], index, 5, 0.6, 0.4,
                    match_barcode_value=s["barcode"], match_with_international_barcode=True,
                ),
                on_tick=tick("full barcode", i),
            )
            step("full barcode", i)

            fc = bench(
                lambda s=sample: _process_single_row(
                    0, s["name"], s["norm_name"], index, 5, 0.6, 0.4,
                    match_code_value=s["code"], match_with_code=True,
                ),
                on_tick=tick("full code", i),
            )
            step("full code", i)

            fn = bench(
                lambda s=sample: _process_single_row(
                    0, s["name"], s["norm_name"], index, 5, 0.6, 0.4,
                ),
                on_tick=tick("full normalizer", i),
            )
            step("full normalizer", i)

            barcode_times.append(b["mean_ms"])
            code_times.append(c["mean_ms"])
            normalizer_times.append(n["mean_ms"])
            full_barcode_times.append(fb["mean_ms"])
            full_code_times.append(fc["mean_ms"])
            full_normalizer_times.append(fn["mean_ms"])

            name = (sample["name"][:42] + "...") if len(sample["name"]) > 45 else sample["name"]
            console.print(f"{i:<3} {name:<45} {b['mean_ms']:>8.3f}ms {c['mean_ms']:>8.3f}ms {n['mean_ms']:>10.3f}ms")

    console.print("-" * 85)
    console.print("\n[bold]=== Pure lookup/search (per row, mean of 10 items) ===[/bold]")
    console.print(f"  Barcode lookup:    {statistics.mean(barcode_times):.3f} ms/row  (10 rows ≈ {statistics.mean(barcode_times)*10:.1f} ms)")
    console.print(f"  Code lookup:       {statistics.mean(code_times):.3f} ms/row  (10 rows ≈ {statistics.mean(code_times)*10:.1f} ms)")
    console.print(f"  Normalizer search: {statistics.mean(normalizer_times):.3f} ms/row  (10 rows ≈ {statistics.mean(normalizer_times)*10:.1f} ms)")
    ratio = statistics.mean(normalizer_times) / max(statistics.mean(barcode_times), 0.001)
    console.print(f"  Normalizer is ~{ratio:.0f}x slower than barcode lookup")

    console.print("\n[bold]=== Full _process_single_row (includes image enrichment) ===[/bold]")
    console.print(f"  Barcode path:     {statistics.mean(full_barcode_times):.3f} ms/row  (10 rows ≈ {statistics.mean(full_barcode_times)*10:.1f} ms)")
    console.print(f"  Code path:        {statistics.mean(full_code_times):.3f} ms/row  (10 rows ≈ {statistics.mean(full_code_times)*10:.1f} ms)")
    console.print(f"  Normalizer path:  {statistics.mean(full_normalizer_times):.3f} ms/row  (10 rows ≈ {statistics.mean(full_normalizer_times)*10:.1f} ms)")

    per_row_norm = statistics.mean(full_normalizer_times)
    per_row_barcode = statistics.mean(full_barcode_times)
    console.print("\n[bold]=== Estimated matching-only time (full row processing, sequential) ===[/bold]")
    for rows in [100, 1000, 5000, 10000]:
        console.print(f"  {rows:>5} rows — barcode: {per_row_barcode*rows/1000:.1f}s | normalizer: {per_row_norm*rows/1000:.1f}s")

    console.print("\n[dim]Note: Real matcher jobs add ProcessPool startup, per-row IPC, incremental JSON writes, and SSE.[/dim]")


if __name__ == "__main__":
    main()
