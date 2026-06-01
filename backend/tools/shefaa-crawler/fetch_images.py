#!/usr/bin/env python3
"""
Chefaa CDN Image Downloader
============================
Downloads product and brand images from a Chefaa JSON export.

Usage:
    python download_images.py products.json
    python download_images.py products.json --workers 8 --count 50 --output-dir ./media
    python download_images.py products.json --workers 4 --output-dir /var/www/media
"""

import argparse
import json
import logging
import os
import sys
import time
import hashlib
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, quote

import urllib.request
import urllib.error

try:
    from rich.console import Console
    from rich.progress import (
        Progress,
        SpinnerColumn,
        BarColumn,
        TextColumn,
        TimeElapsedColumn,
        TimeRemainingColumn,
        DownloadColumn,
        TransferSpeedColumn,
        TaskID,
    )
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich import print as rprint
    from rich.live import Live
    from rich.columns import Columns
    from rich.rule import Rule
    from rich.style import Style
except ImportError:
    print("Installing rich...")
    os.system(f"{sys.executable} -m pip install rich -q")
    from rich.console import Console
    from rich.progress import (
        Progress,
        SpinnerColumn,
        BarColumn,
        TextColumn,
        TimeElapsedColumn,
        TimeRemainingColumn,
        DownloadColumn,
        TransferSpeedColumn,
        TaskID,
    )
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich import print as rprint
    from rich.live import Live
    from rich.columns import Columns
    from rich.rule import Rule
    from rich.style import Style

console = Console()

# ─── Logging Setup ────────────────────────────────────────────────────────────
# File logger — always writes structured lines to download.log
# Configured in main() once we know the output dir.
logger = logging.getLogger("chefaa_dl")
logger.setLevel(logging.DEBUG)

# Thread-safe buffer so worker threads can queue log lines to be printed
# by the main thread between progress refreshes (avoids corrupting the TUI).
_log_buffer: list[tuple[str, str]] = []   # [(level, message), ...]
_log_lock = threading.Lock()

def _queue_log(level: str, msg: str) -> None:
    with _log_lock:
        _log_buffer.append((level, msg))

def _flush_log_buffer(progress) -> None:
    """Called from the main thread — prints queued log lines via rich console."""
    with _log_lock:
        lines = _log_buffer.copy()
        _log_buffer.clear()
    for level, msg in lines:
        color = {"ERROR": "red", "WARNING": "yellow", "INFO": "cyan", "DEBUG": "dim"}.get(level, "white")
        progress.console.print(f"  [{color}]{level:7s}[/]  {msg}")

def _setup_file_logger(log_path: Path) -> None:
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter(
        "%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    logger.addHandler(fh)

# ─── Data Structures ──────────────────────────────────────────────────────────

@dataclass
class ImageTask:
    url: str
    dest_path: Path
    label: str          # human-readable (product title or brand name)
    category: str       # "product" or "brand"
    product_id: int

@dataclass
class DownloadResult:
    task: ImageTask
    success: bool
    bytes_downloaded: int = 0
    error: str = ""
    error_type: str = ""   # "http_429", "http_5xx", "http_4xx", "timeout", "network", "unknown"
    status_code: int = 0
    skipped: bool = False  # already exists on disk
    attempt: int = 1


# ─── Helpers ──────────────────────────────────────────────────────────────────

def sanitize_filename(url: str) -> str:
    """Derive a clean, ASCII-safe filename from a CDN URL."""
    parsed = urlparse(url)
    name = Path(parsed.path).name.split("?")[0]
    if not name:
        return hashlib.md5(url.encode()).hexdigest() + ".jpg"
    # Percent-encode any non-ASCII or unsafe filesystem characters,
    # then replace the encoded %XX sequences with underscores so the
    # filename stays readable and won't trip up any OS or shell.
    name = name.encode("utf-8", errors="replace").decode("ascii", errors="replace")
    # Replace any character that isn't alphanumeric, dot, dash, or underscore
    import re
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    # Collapse multiple underscores
    name = re.sub(r"_+", "_", name)
    return name


def extract_tasks(data: list[dict], output_dir: Path, count: Optional[int]) -> list[ImageTask]:
    """Walk the JSON and collect all image download tasks."""
    tasks: list[ImageTask] = []
    seen_urls: set[str] = set()

    products_dir = output_dir / "products"
    brands_dir   = output_dir / "brands"

    for item in data:
        pid   = item.get("id", 0)
        label = item.get("title_en") or item.get("title_ar") or f"product_{pid}"

        # Product image
        product_url = item.get("image")
        if product_url and product_url not in seen_urls:
            seen_urls.add(product_url)
            fname = sanitize_filename(product_url)
            tasks.append(ImageTask(
                url=product_url,
                dest_path=products_dir / fname,
                label=label,
                category="product",
                product_id=pid,
            ))

        # Brand image
        brand = item.get("brands") or {}
        brand_url = brand.get("images") if brand else None
        if brand_url and brand_url not in seen_urls:
            seen_urls.add(brand_url)
            brand_name = brand.get("title_en") or brand.get("title_ar") or "unknown_brand"
            fname = sanitize_filename(brand_url)
            tasks.append(ImageTask(
                url=brand_url,
                dest_path=brands_dir / fname,
                label=brand_name,
                category="brand",
                product_id=pid,
            ))

    if count:
        tasks = tasks[:count]

    return tasks


# ─── Downloader ───────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ChefaaImageBot/1.0)",
    "Accept": "image/webp,image/avif,image/*,*/*;q=0.8",
}

TIMEOUT = 30  # seconds per attempt

# Backoff config for rate-limited / server-error responses
_BACKOFF_BASE   = 2.0   # seconds — doubled each retry
_BACKOFF_MAX    = 60.0  # cap
_RATE_LIMIT_PAUSE = 5.0 # extra flat pause on first 429 before backoff


def _classify_http_error(code: int) -> str:
    if code == 429:
        return "http_429"
    if 500 <= code < 600:
        return "http_5xx"
    return "http_4xx"


def download_one(task: ImageTask, attempt: int = 1, backoff: float = _BACKOFF_BASE) -> DownloadResult:
    """Download a single image with inline logging. Thread-safe."""
    label = f"[id={task.product_id}] {task.label[:50]}"

    # Skip if already on disk
    if task.dest_path.exists():
        logger.debug("SKIP   %s  already exists at %s", task.url, task.dest_path)
        return DownloadResult(task=task, success=True, skipped=True,
                              bytes_downloaded=task.dest_path.stat().st_size,
                              attempt=attempt)

    task.dest_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = task.dest_path.with_suffix(".tmp")

    try:
        logger.debug("GET    %s", task.url)
        # Percent-encode non-ASCII characters in the URL path (e.g. accented letters)
        # while leaving the scheme, host, and already-encoded sequences intact.
        parsed = urlparse(task.url)
        safe_url = parsed._replace(path=quote(parsed.path, safe="/%+")).geturl()
        req = urllib.request.Request(safe_url, headers=HEADERS)

        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            data = response.read()

        tmp_path.write_bytes(data)
        tmp_path.rename(task.dest_path)

        logger.info("OK     %s  (%s)  →  %s",
                    task.url, _fmt_bytes(len(data)), task.dest_path.name)
        return DownloadResult(task=task, success=True,
                              bytes_downloaded=len(data), attempt=attempt)

    # ── HTTP errors ───────────────────────────────────────────────────────────
    except urllib.error.HTTPError as e:
        code = e.code
        error_type = _classify_http_error(code)

        # Read Retry-After header if present (works for 429 and some 503s)
        retry_after_raw = e.headers.get("Retry-After") if e.headers else None
        retry_after: Optional[float] = None
        if retry_after_raw:
            try:
                retry_after = float(retry_after_raw)
            except ValueError:
                retry_after = None

        if code == 429:
            wait = retry_after if retry_after else min(backoff + _RATE_LIMIT_PAUSE, _BACKOFF_MAX)
            msg = (f"RATE LIMIT (429)  {task.url}  "
                   f"{'Retry-After=' + str(retry_after) + 's' if retry_after else 'no Retry-After header'}  "
                   f"→ backing off {wait:.1f}s  (attempt {attempt})")
            logger.warning(msg)
            _queue_log("WARNING", f"[yellow]429 Rate-limit[/] {task.url[:80]}  ⏳ wait {wait:.0f}s")
            time.sleep(wait)
            return DownloadResult(task=task, success=False,
                                  error=f"HTTP 429 — rate limited (backed off {wait:.1f}s)",
                                  error_type=error_type, status_code=code, attempt=attempt)

        elif 500 <= code < 600:
            wait = min(backoff, _BACKOFF_MAX)
            msg = (f"SERVER ERROR ({code})  {task.url}  "
                   f"reason={e.reason}  → backing off {wait:.1f}s  (attempt {attempt})")
            logger.error(msg)
            _queue_log("ERROR", f"[red]HTTP {code}[/] {task.url[:80]}  reason={e.reason}")
            time.sleep(wait)
            return DownloadResult(task=task, success=False,
                                  error=f"HTTP {code} {e.reason}",
                                  error_type=error_type, status_code=code, attempt=attempt)

        else:
            msg = f"HTTP ERROR ({code})  {task.url}  reason={e.reason}  (attempt {attempt})"
            logger.error(msg)
            _queue_log("ERROR", f"[red]HTTP {code}[/] {task.url[:80]}  reason={e.reason}")
            return DownloadResult(task=task, success=False,
                                  error=f"HTTP {code} {e.reason}",
                                  error_type=error_type, status_code=code, attempt=attempt)

    # ── Network / timeout errors ──────────────────────────────────────────────
    except TimeoutError:
        msg = f"TIMEOUT  {task.url}  after {TIMEOUT}s  (attempt {attempt})"
        logger.error(msg)
        _queue_log("ERROR", f"[red]Timeout[/] {task.url[:80]}  after {TIMEOUT}s")
        return DownloadResult(task=task, success=False,
                              error=f"Timeout after {TIMEOUT}s",
                              error_type="timeout", attempt=attempt)

    except urllib.error.URLError as e:
        msg = f"NETWORK  {task.url}  reason={e.reason}  (attempt {attempt})"
        logger.error(msg)
        _queue_log("ERROR", f"[red]Network error[/] {task.url[:80]}  → {e.reason}")
        return DownloadResult(task=task, success=False,
                              error=str(e.reason),
                              error_type="network", attempt=attempt)

    except Exception as e:
        msg = f"UNKNOWN  {task.url}  {type(e).__name__}: {e}  (attempt {attempt})"
        logger.exception(msg)
        _queue_log("ERROR", f"[red]{type(e).__name__}[/] {task.url[:80]}  → {e}")
        return DownloadResult(task=task, success=False,
                              error=f"{type(e).__name__}: {e}",
                              error_type="unknown", attempt=attempt)

    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass


# ─── Stats Tracker ────────────────────────────────────────────────────────────

@dataclass
class Stats:
    total: int = 0
    done: int = 0
    succeeded: int = 0
    failed: int = 0
    skipped: int = 0
    bytes_total: int = 0
    rate_limited: int = 0   # 429 count
    server_errors: int = 0  # 5xx count
    timeouts: int = 0
    network_errors: int = 0
    errors: list[tuple[str, str, str]] = field(default_factory=list)  # (url, error_msg, error_type)
    start_time: float = field(default_factory=time.time)

    @property
    def elapsed(self) -> float:
        return time.time() - self.start_time

    @property
    def rate(self) -> float:
        return self.done / self.elapsed if self.elapsed > 0 else 0.0

    def record(self, result: DownloadResult):
        self.done += 1
        self.bytes_total += result.bytes_downloaded
        if result.skipped:
            self.skipped += 1
            self.succeeded += 1
        elif result.success:
            self.succeeded += 1
        else:
            self.failed += 1
            self.errors.append((result.task.url, result.error, result.error_type))
            if result.error_type == "http_429":
                self.rate_limited += 1
            elif result.error_type == "http_5xx":
                self.server_errors += 1
            elif result.error_type == "timeout":
                self.timeouts += 1
            elif result.error_type == "network":
                self.network_errors += 1


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Download Chefaa product & brand images from CDN",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "file", 
        nargs="?", 
        default="data/extracted/chefaa_products_eg.json", 
        help="Path to the JSON products file [default: data/extracted/chefaa_products_eg.json]"
    )
    parser.add_argument(
        "--output-dir", "-o",
        default="media",
        help="Root output directory (default: media)",
    )
    parser.add_argument(
        "--workers", "-w",
        type=int, default=4,
        help="Number of parallel download workers (default: 4)",
    )
    parser.add_argument(
        "--count", "-n",
        type=int, default=None,
        help="Limit to first N images (default: all)",
    )
    parser.add_argument(
        "--retries", "-r",
        type=int, default=3,
        help="Retry failed downloads N times with exponential backoff (default: 3)",
    )
    parser.add_argument(
        "--delay", "-d",
        type=float, default=0.0,
        help="Fixed delay in seconds between each request per worker (default: 0). "
             "Useful to self-throttle and avoid 429s proactively.",
    )
    parser.add_argument(
        "--log-file",
        default=None,
        help="Path for the structured log file (default: {output-dir}/download.log)",
    )
    return parser.parse_args()


# ─── Entry Point ──────────────────────────────────────────────────────────────

def fmt_bytes(n: int) -> str:
    return _fmt_bytes(n)

def _fmt_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def main():
    args = parse_args()

    # ── Load JSON ──
    json_path = Path(args.file)
    if not json_path.exists():
        console.print(f"[bold red]✗ File not found:[/] {json_path}")
        sys.exit(1)

    console.print(Rule("[bold cyan]Chefaa CDN Image Downloader[/]"))
    console.print(f"  [dim]📂 Source:[/]  {json_path}")
    console.print(f"  [dim]📁 Output:[/]  {args.output_dir}")
    console.print(f"  [dim]⚙  Workers:[/] {args.workers}")
    console.print(f"  [dim]↻  Retries:[/] {args.retries}  (exponential backoff)")
    if args.delay:
        console.print(f"  [dim]⏱  Delay:[/]   {args.delay}s per request (rate-limit guard)")
    if args.count:
        console.print(f"  [dim]🔢 Limit:[/]   first {args.count} images")
    console.print()

    with console.status("[bold cyan]Parsing JSON…"):
        raw = json_path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if isinstance(data, dict):
            # Handle wrapped responses like { "data": [...] }
            data = data.get("data") or data.get("products") or data.get("results") or list(data.values())[0]
        if not isinstance(data, list):
            console.print("[bold red]✗ JSON root must be a list of product objects.[/]")
            sys.exit(1)

    output_dir = Path(args.output_dir)
    tasks = extract_tasks(data, output_dir, args.count)

    if not tasks:
        console.print("[yellow]⚠  No image URLs found in the JSON.[/]")
        sys.exit(0)

    # ── File logger ──
    log_path = Path(args.log_file) if args.log_file else output_dir / "download.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    _setup_file_logger(log_path)
    logger.info("Session started — source=%s  workers=%d  count=%s  delay=%s",
                json_path, args.workers, args.count or "all", args.delay)

    n_products = sum(1 for t in tasks if t.category == "product")
    n_brands   = sum(1 for t in tasks if t.category == "brand")

    summary = Table.grid(padding=(0, 2))
    summary.add_row(
        f"[bold]{len(tasks)}[/] total images",
        f"[green]{n_products}[/] products",
        f"[blue]{n_brands}[/] brands",
    )
    console.print(Panel(summary, title="[bold]Download Queue[/]", border_style="cyan"))

    # ── Create output dirs ──
    (output_dir / "products").mkdir(parents=True, exist_ok=True)
    (output_dir / "brands").mkdir(parents=True, exist_ok=True)

    stats = Stats(total=len(tasks))

    # ── Progress UI ──
    progress = Progress(
        SpinnerColumn(),
        TextColumn("[bold cyan]{task.description}"),
        BarColumn(bar_width=40),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TextColumn("•"),
        TextColumn("[green]{task.fields[n_done]}[/]/[white]{task.fields[n_total]}[/]"),
        TextColumn("•"),
        TextColumn("[yellow]{task.fields[speed]:.1f}[/][dim] img/s[/]"),
        TextColumn("•"),
        TimeElapsedColumn(),
        TextColumn("ETA"),
        TimeRemainingColumn(),
        console=console,
        refresh_per_second=10,
    )

    failed_tasks: list[ImageTask] = []
    _abort = threading.Event()  # set on Ctrl+C to stop workers cleanly

    # Wrap download_one with optional fixed delay + abort check
    def _download(task: ImageTask, attempt: int = 1) -> DownloadResult:
        if _abort.is_set():
            return DownloadResult(task=task, success=False,
                                  error="aborted", error_type="aborted")
        if args.delay > 0:
            # interruptible sleep — check abort every 50 ms
            deadline = time.monotonic() + args.delay
            while time.monotonic() < deadline:
                if _abort.is_set():
                    return DownloadResult(task=task, success=False,
                                          error="aborted", error_type="aborted")
                time.sleep(0.05)
        backoff = _BACKOFF_BASE * (2 ** (attempt - 1))
        return download_one(task, attempt=attempt, backoff=min(backoff, _BACKOFF_MAX))

    def _run_pool(task_list: list[ImageTask], attempt: int = 1) -> list[ImageTask]:
        """Submit tasks, collect results, return list of failed tasks."""
        pool = ThreadPoolExecutor(max_workers=args.workers)
        futures = {pool.submit(_download, t, attempt): t for t in task_list}
        failed: list[ImageTask] = []
        try:
            for future in as_completed(futures):
                if _abort.is_set():
                    break
                result: DownloadResult = future.result()
                if result.error_type == "aborted":
                    continue
                stats.record(result)
                if not result.success and not result.skipped:
                    failed.append(result.task)
                _flush_log_buffer(progress)
                speed = stats.rate
                progress.update(overall, advance=1, n_done=stats.done, speed=speed)
                if result.task.category == "product":
                    progress.update(product_task, advance=1,
                        n_done=sum(1 for t in tasks[:stats.done] if t.category == "product"),
                        speed=speed)
                else:
                    progress.update(brand_task, advance=1,
                        n_done=sum(1 for t in tasks[:stats.done] if t.category == "brand"),
                        speed=speed)
        except KeyboardInterrupt:
            _abort.set()
        finally:
            # Cancel queued (not-yet-started) futures immediately
            for f in futures:
                f.cancel()
            pool.shutdown(wait=False, cancel_futures=True)
        return failed

    with progress:
        overall = progress.add_task(
            "Downloading",
            total=len(tasks),
            n_done=0,
            n_total=len(tasks),
            speed=0.0,
        )

        product_task = progress.add_task(
            "[green]  Products",
            total=n_products,
            n_done=0,
            n_total=n_products,
            speed=0.0,
        )

        brand_task = progress.add_task(
            "[blue]  Brands  ",
            total=n_brands if n_brands else 1,
            n_done=0,
            n_total=n_brands,
            speed=0.0,
        )

        try:
            failed_tasks = _run_pool(tasks)

            # ── Retry loop with exponential backoff ──────────────────────────
            for attempt in range(2, args.retries + 2):
                if not failed_tasks or _abort.is_set():
                    break

                retryable = failed_tasks[:]
                wait_before = min(_BACKOFF_BASE * (2 ** (attempt - 2)), _BACKOFF_MAX)
                progress.console.print(
                    f"\n[yellow]↻  Retry {attempt - 1}/{args.retries}[/]  "
                    f"[dim]({len(retryable)} tasks, waiting {wait_before:.0f}s…)[/]"
                )
                logger.warning("Retry attempt %d/%d — %d tasks — waiting %.1fs",
                               attempt - 1, args.retries, len(retryable), wait_before)

                # Interruptible sleep between retry passes
                deadline = time.monotonic() + wait_before
                while time.monotonic() < deadline:
                    if _abort.is_set():
                        break
                    time.sleep(0.1)

                if _abort.is_set():
                    break

                failed_tasks = _run_pool(retryable, attempt=attempt)
                # Reconcile retry successes back into stats
                for t in retryable:
                    if t not in failed_tasks:
                        stats.failed    = max(0, stats.failed - 1)
                        stats.succeeded += 1
                        stats.errors = [(u, e, et) for u, e, et in stats.errors
                                        if u != t.url]

        except KeyboardInterrupt:
            _abort.set()

    if _abort.is_set():
        console.print("\n[bold yellow]⚠  Interrupted — partial download.[/]")
        logger.warning("Session interrupted by user after %d/%d images", stats.done, stats.total)

    # ── Final Report ──
    console.print()
    console.print(Rule("[bold]Download Complete[/]"))

    result_table = Table(show_header=True, header_style="bold cyan", box=None, padding=(0, 2))
    result_table.add_column("Metric", style="dim")
    result_table.add_column("Value",  justify="right")

    result_table.add_row("Total images",        f"[white]{stats.total}[/]")
    result_table.add_row("✓ Succeeded",          f"[green]{stats.succeeded}[/]")
    result_table.add_row("  — Already cached",   f"[dim]{stats.skipped}[/]")
    result_table.add_row("✗ Failed",             f"[red]{stats.failed}[/]")
    if stats.rate_limited:
        result_table.add_row("  — 429 Rate-limited", f"[yellow]{stats.rate_limited}[/]")
    if stats.server_errors:
        result_table.add_row("  — 5xx Server errors", f"[red]{stats.server_errors}[/]")
    if stats.timeouts:
        result_table.add_row("  — Timeouts",          f"[red]{stats.timeouts}[/]")
    if stats.network_errors:
        result_table.add_row("  — Network errors",    f"[red]{stats.network_errors}[/]")
    result_table.add_row("Data downloaded",      f"[cyan]{_fmt_bytes(stats.bytes_total)}[/]")
    result_table.add_row("Elapsed",              f"[yellow]{stats.elapsed:.1f}s[/]")
    result_table.add_row("Avg speed",            f"[yellow]{stats.rate:.1f} img/s[/]")

    console.print(result_table)
    console.print()
    console.print(f"[dim]📁 Products → [/][white]{output_dir / 'products'}[/]")
    console.print(f"[dim]📁 Brands   → [/][white]{output_dir / 'brands'}[/]")
    console.print(f"[dim]📋 Log      → [/][white]{log_path}[/]")

    if stats.errors:
        console.print()
        console.print(f"[bold red]Failed URLs ({len(stats.errors)}):[/]")
        for url, err, etype in stats.errors[:20]:
            badge_color = "yellow" if etype == "http_429" else "red"
            badge = f"[{badge_color}]{etype}[/]"
            console.print(f"  [red]✗[/] {badge}  [dim]{url[:75]}[/]  →  {err}")
        if len(stats.errors) > 20:
            console.print(f"  [dim]… and {len(stats.errors) - 20} more (see log)[/]")

        # Write failures file — tab-separated: url | error | type
        failures_path = output_dir / "failed_downloads.tsv"
        lines = ["url\terror\terror_type"]
        lines += [f"{url}\t{err}\t{etype}" for url, err, etype in stats.errors]
        failures_path.write_text("\n".join(lines), encoding="utf-8")
        console.print(f"\n[dim]Failures saved to → [/][white]{failures_path}[/]")
        logger.warning("Session ended with %d failures — see %s", stats.failed, failures_path)
    else:
        logger.info("Session complete — all %d images downloaded successfully", stats.total)

    sys.exit(0 if stats.failed == 0 else 1)


if __name__ == "__main__":
    main()