import urllib.request
import urllib.error
import json
import os
import argparse
import sys
import time
import random
import requests
import re
import threading
from bs4 import BeautifulSoup
from rich.console import Console

# Ensure console handles UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

console = Console()

# Global requests session for HTTP Keep-Alive and automated GZIP encoding
session = requests.Session()

def fetch_meili_with_retry(url, headers, data_dict, max_retries=5, base_delay=1.5):
    """Query Meilisearch API with robust retry and exponential backoff on network errors or rate limits."""
    data_bytes = json.dumps(data_dict).encode('utf-8')
    
    for attempt in range(max_retries):
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                return json.loads(res.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                delay = 15.0 + random.uniform(1.0, 3.0)
                time.sleep(delay)
                continue
            elif e.code >= 500:
                delay = base_delay * (2 ** attempt) + random.uniform(0.1, 0.5)
                time.sleep(delay)
                continue
            else:
                raise e
        except (urllib.error.URLError, ConnectionResetError, Exception):
            delay = base_delay * (2 ** attempt) + random.uniform(0.5, 1.5)
            time.sleep(delay)
            continue
            
    # Final fallback attempt
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode('utf-8'))

class ProxyPool:
    def __init__(self, proxy_urls):
        self.proxies = list(proxy_urls)
        self.lock = threading.Lock()
        self.index = 0

    def get_proxy(self):
        with self.lock:
            if not self.proxies:
                return None
            proxy = self.proxies[self.index % len(self.proxies)]
            self.index += 1
            return proxy

    def remove_proxy(self, proxy):
        with self.lock:
            if proxy in self.proxies:
                try:
                    self.proxies.remove(proxy)
                except ValueError:
                    pass

def load_proxy_pool():
    console.print("[yellow]⚡ Fetching free HTTP proxy list for auto-rotation...[/yellow]")
    url = "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt"
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as res:
            lines = res.read().decode('utf-8').splitlines()
        proxies = [f"http://{line.strip()}" for line in lines if line.strip()]
        console.print(f"[green]✔ Loaded {len(proxies)} proxies into the pool.[/green]")
        return ProxyPool(proxies)
    except Exception as e:
        console.print(f"[bold red]❌ Failed to load proxy list: {e}. Running without proxies.[/bold red]")
        return None

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.0.0 Safari/537.36"
]

def fetch_html(url, headers=None, proxy_pool=None):
    """Fetch raw HTML content from the specified URL. Optionally rotates proxies on failure."""
    # Always use clean browser headers for web scraping to prevent Cloudflare/WAF blocks
    browser_headers = {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
    }
    
    max_attempts = 5
    for attempt in range(max_attempts):
        proxy = proxy_pool.get_proxy() if proxy_pool else None
        proxies_arg = {'http': proxy, 'https': proxy} if proxy else None
        
        try:
            # When using public proxies, a short timeout is essential (e.g. 5s)
            timeout_val = 5 if proxy else 20
            response = session.get(url, headers=browser_headers, timeout=timeout_val, proxies=proxies_arg)
            
            if response.status_code == 429:
                if proxy_pool and proxy:
                    # Remove rate-limited proxy and retry immediately with another
                    proxy_pool.remove_proxy(proxy)
                    continue
                else:
                    # No proxy pool, wait and retry
                    console.print(f"\n[bold red]⚠ Rate limited (429) on {url}. Retrying in 10s...[/bold red]")
                    time.sleep(10.0 + random.uniform(1.0, 3.0))
                    continue
                    
            response.raise_for_status()
            return response.text
        except Exception as e:
            if proxy_pool and proxy:
                # Remove dead/slow proxy and try again
                proxy_pool.remove_proxy(proxy)
                continue
            else:
                console.print(f"[red]Error fetching HTML from {url}: {e}[/red]")
                break
    return ""

def normalize_cdn_url(url):
    """Strip Thumbor/imgproxy transform segments from CDN URLs to get the original high-resolution image."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    path = parsed.path
    idx = path.find("/public/")
    if idx > 0:
        return parsed._replace(path=path[idx:]).geturl()
    return url

def get_product_images_from_url(product_url, headers, proxy_pool=None):
    """Fetch product details page and extract all images using fast Regex scanning."""
    html = fetch_html(product_url, headers, proxy_pool=proxy_pool)
    if not html:
        return []
    
    # Scan raw HTML using fast Regex matching for product upload image formats
    pattern = r'https?://[^\s"\'>]+/public/uploads/products/[^\s"\'>]+'
    found_urls = re.findall(pattern, html)
    
    normalized_urls = []
    seen = set()
    
    # Process found URLs
    for url in found_urls:
        # Clean up common HTML escaping and quote artifacts
        url = url.replace('&quot;', '').replace('&apos;', '').replace('&amp;', '&').replace('\\', '').strip()
        if url.startswith('//'):
            url = "https:" + url
        
        # Normalize CDN transform prefixes (e.g. fit-in/144x156) to get the original image
        url = normalize_cdn_url(url)
        
        # Verify it looks like a valid image extension
        ext = url.split('.')[-1].lower()
        if ext in ['png', 'jpg', 'jpeg', 'webp']:
            if url not in seen:
                seen.add(url)
                normalized_urls.append(url)
                
    # Fallback to BeautifulSoup parsing if Regex yields nothing
    if not normalized_urls:
        soup = BeautifulSoup(html, 'html.parser')
        carousel = soup.find('div', id='carousel-slider')
        if carousel:
            carousel_items = carousel.find_all('div', class_='carousel-item')
            for item in carousel_items:
                img_tag = item.find('img')
                if img_tag:
                    src = img_tag.get('src') or img_tag.get('data-src')
                    if src and 'public/uploads/products' in src:
                        if src.startswith('//'):
                            src = "https:" + src
                        if src not in seen:
                            seen.add(src)
                            normalized_urls.append(src)
                            
        if not normalized_urls:
            for img in soup.find_all('img'):
                src = img.get('src') or img.get('data-src')
                if src and 'public/uploads/products' in src:
                    if src.startswith('//'):
                        src = "https:" + src
                    if src not in seen:
                        seen.add(src)
                        normalized_urls.append(src)
                        
    return normalized_urls

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_file = os.path.abspath(os.path.join(script_dir, "../../data/normalized/chefaa_products_eg_normalized.json"))

    parser = argparse.ArgumentParser(description="Chefaa Product Images Analyzer (Copy)")
    parser.add_argument("--country", type=str, default="eg", choices=["eg", "sa", "ae"], help="Primary country [default: eg]")
    parser.add_argument("--file", type=str, default=default_file, help="Path to the JSON database file")
    parser.add_argument("--slug", type=str, help="Filter by a specific product slug")
    parser.add_argument("--id", type=int, help="Filter by a specific product ID")
    parser.add_argument("--q", type=str, help="Search for a keyword in product slug/title")
    parser.add_argument("--count", type=int, help="Limit processing to a small set (e.g. --count 5)")
    parser.add_argument("--show-meili", action="store_true", help="Display the raw product JSON from the database")
    parser.add_argument("--workers", type=int, default=10, help="Number of parallel workers (threads) [default: 10]")
    parser.add_argument("--delay", type=float, default=0.0, help="Delay between requests in seconds [default: 0.0]")
    parser.add_argument("--proxy", type=str, help="Proxy URL (e.g. http://127.0.0.1:8080 or socks5://127.0.0.1:1080)")
    parser.add_argument("--rotate-proxies", action="store_true", help="Download and automatically rotate thousands of free HTTP/S proxies")
    args = parser.parse_args()

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': 'Bearer aa66bf66db30dea9b9746c8f6397d7a0112a055c70d80527b300c3dec85fcc41',
        'Content-Type': 'application/json'
    }

    proxy_pool = None
    if args.rotate_proxies:
        proxy_pool = load_proxy_pool()

    if args.proxy:
        session.proxies = {
            'http': args.proxy,
            'https': args.proxy
        }
        console.print(f"[bold green]✔ Configured session to use proxy: [cyan]{args.proxy}[/cyan][/bold green]")

    console.print("[bold yellow]✈ Performing Local Image Enrichment Test...[/bold yellow]")
    console.print(f"  • Source File: [cyan]{args.file}[/cyan]")

    # Load local JSON file
    console.print(f"✈ Loading local JSON database...")
    start_load = time.time()
    try:
        with open(args.file, 'r', encoding='utf-8') as f:
            all_products = json.load(f)
        console.print(f"  • Loaded [bold green]{len(all_products):,}[/bold green] products in [cyan]{time.time() - start_load:.2f}s[/cyan]")
    except Exception as e:
        console.print(f"[bold red]❌ Failed to load file {args.file}: {e}[/bold red]")
        sys.exit(1)

    # Filter products based on CLI arguments
    matched_products = []
    if args.id:
        matched_products = [p for p in all_products if p.get('id') == args.id]
        if not matched_products:
            # Try matching as string if ID in json is string
            matched_products = [p for p in all_products if str(p.get('id')) == str(args.id)]
        console.print(f"  • Filtering by ID [cyan]{args.id}[/cyan]: found [green]{len(matched_products)}[/green] match(es)")
    elif args.slug:
        matched_products = [p for p in all_products if p.get('slug') == args.slug]
        console.print(f"  • Filtering by Slug '[cyan]{args.slug}[/cyan]': found [green]{len(matched_products)}[/green] match(es)")
    elif args.q:
        q_lower = args.q.lower()
        matched_products = [
            p for p in all_products
            if q_lower in str(p.get('slug', '')).lower()
            or q_lower in str(p.get('title_en', '')).lower()
            or q_lower in str(p.get('title_ar', '')).lower()
        ]
        console.print(f"  • Filtering by keyword '[cyan]{args.q}[/cyan]': found [green]{len(matched_products)}[/green] match(es)")
    else:
        # Default fallback to all items
        matched_products = all_products
        console.print("  • No filters specified. Using all products from database...")

    # Apply count limit if specified (or default to 5 if no filters were specified to prevent crawling 29k pages)
    limit = args.count
    if limit is None and not (args.id or args.slug or args.q):
        limit = 5
        console.print("[yellow]⚠ No filter or count specified. Defaulting to first 5 products for safety.[/yellow]")

    if limit is not None:
        matched_products = matched_products[:limit]
        console.print(f"  • Limiting to first [bold green]{len(matched_products)}[/bold green] product(s)")

    if not matched_products:
        console.print("[bold red]❌ No matching products found.[/bold red]")
        sys.exit(0)

    # Show raw JSON from file if requested
    if args.show_meili:
        console.print("\n[bold green]=== Raw Product JSON from Database ===[/bold green]")
        console.print_json(data=matched_products)
        console.print("[bold green]======================================[/bold green]\n")

    # Define function to process a single product details page
    def process_product(product, proxy_pool=None):
        p_id = product.get('id')
        title = product.get('title_en') or product.get('title_ar')
        slug = product.get('slug')
        meili_image = product.get('image')
        product_url = product.get('full_url')
        
        if not product_url:
            product_url = f"https://chefaa.com/{args.country}-ar/nowProduct/{slug}"
            
        if args.delay > 0 and not proxy_pool:
            jitter = random.uniform(0.8, 1.2) * args.delay
            time.sleep(jitter)

        start_time = time.time()
        images = get_product_images_from_url(product_url, headers, proxy_pool=proxy_pool)
        duration = time.time() - start_time
        
        return {
            'id': p_id,
            'title': title,
            'slug': slug,
            'meili_image': meili_image,
            'product_url': product_url,
            'images': images,
            'duration': duration
        }

    from concurrent.futures import ThreadPoolExecutor, as_completed

    console.print(f"\n[bold yellow]🔍 Fetching and parsing product details page for {len(matched_products)} product(s)...[/bold yellow]")
    crawl_start = time.time()
    max_workers = min(args.workers, len(matched_products))
    if max_workers > 1:
        console.print(f"  • Processing in parallel using [bold green]{max_workers}[/bold green] threads (delay: {args.delay}s)...")
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_prod = {executor.submit(process_product, prod, proxy_pool): prod for prod in matched_products}
            for future in as_completed(future_to_prod):
                res = future.result()
                console.print(f"\n[bold green]✔ Product Processed:[/bold green]")
                console.print(f"  • ID:          [cyan]{res['id']}[/cyan]")
                console.print(f"  • Title:       [cyan]{res['title']}[/cyan]")
                console.print(f"  • Slug:        [cyan]{res['slug']}[/cyan]")
                console.print(f"  • Meili Image: [cyan]{res['meili_image']}[/cyan]")
                console.print(f"  • Full URL:    [cyan]{res['product_url']}[/cyan]")
                console.print(f"  • Page fetched in: [cyan]{res['duration']:.2f}s[/cyan]")
                console.print(f"  • Found [bold green]{len(res['images'])}[/bold green] images:")
                for idx, img in enumerate(res['images'], 1):
                    console.print(f"    {idx}. {img}")
    else:
        # Sequential processing for a single product or single worker
        console.print(f"  • Processing sequentially (delay: {args.delay}s)...")
        for prod in matched_products:
            res = process_product(prod, proxy_pool)
            console.print(f"\n[bold green]✔ Product Processed:[/bold green]")
            console.print(f"  • ID:          [cyan]{res['id']}[/cyan]")
            console.print(f"  • Title:       [cyan]{res['title']}[/cyan]")
            console.print(f"  • Slug:        [cyan]{res['slug']}[/cyan]")
            console.print(f"  • Meili Image: [cyan]{res['meili_image']}[/cyan]")
            console.print(f"  • Full URL:    [cyan]{res['product_url']}[/cyan]")
            console.print(f"  • Page fetched in: [cyan]{res['duration']:.2f}s[/cyan]")
            console.print(f"  • Found [bold green]{len(res['images'])}[/bold green] images:")
            for idx, img in enumerate(res['images'], 1):
                console.print(f"    {idx}. {img}")

    total_crawl_time = time.time() - crawl_start
    avg_throughput = total_crawl_time / len(matched_products)
    estimated_total_time_seconds = avg_throughput * 29818
    
    # Format estimated time
    est_hours = int(estimated_total_time_seconds // 3600)
    est_mins = int((estimated_total_time_seconds % 3600) // 60)
    est_secs = int(estimated_total_time_seconds % 60)

    console.print("\n[bold yellow]⏱ Crawling Throughput & Estimation Summary:[/bold yellow]")
    console.print(f"  • Total items processed: [cyan]{len(matched_products)}[/cyan]")
    console.print(f"  • Total time elapsed:    [cyan]{total_crawl_time:.2f}s[/cyan]")
    console.print(f"  • Effective throughput:  [cyan]{avg_throughput:.3f}s / product[/cyan]")
    console.print(f"  • Estimated time for full 29,818 items: [bold green]{est_hours}h {est_mins}m {est_secs}s[/bold green]")

    console.print("\n[bold green]Analysis complete.[/bold green]")

if __name__ == "__main__":
    main()
