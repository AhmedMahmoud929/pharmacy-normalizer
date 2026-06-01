import urllib.request
import urllib.error
import json
import os
import argparse
import sys
import time
import random
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, MofNCompleteColumn, TaskProgressColumn

# Ensure console handles UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

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

def main():
    parser = argparse.ArgumentParser(description="Chefaa Fast Slugs & Full DB Extractor")
    parser.add_argument("--country", type=str, default="eg", choices=["eg", "sa", "ae"], help="Primary country [default: eg]")
    parser.add_argument("--output-dir", type=str, default="data/extracted", help="Output directory [default: data/extracted]")
    parser.add_argument("--format", type=str, default="both", choices=["json", "txt", "both"], help="Output format [default: both]")
    parser.add_argument("--preflight", action="store_true", help="Perform a preflight test query, show the raw Meilisearch response, and exit")
    parser.add_argument("--full-db", action="store_true", help="Fetch the complete product database records instead of just the slugs")
    args = parser.parse_args()

    console = Console()
    
    index = f"products_{args.country.lower()}"
    if args.country.lower() == 'ae':
        index = "products_eg"

    url = f"https://meilisearch.chefaa.com/indexes/{index}/search"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': 'Bearer aa66bf66db30dea9b9746c8f6397d7a0112a055c70d80527b300c3dec85fcc41',
        'Content-Type': 'application/json'
    }

    if args.preflight:
        console.print("[bold yellow]✈ Performing Preflight Connection Test...[/bold yellow]")
        console.print(f"  • Target URL:    [cyan]{url}[/cyan]")
        console.print(f"  • Bearer Token:  [cyan]{headers['Authorization'][:20]}...[/cyan]")
        
        sample_data = {
            'q': '',
            'limit': 1
        }
        console.print("\n[bold]Sent Query Payload:[/bold]")
        console.print_json(json.dumps(sample_data))
        
        try:
            parsed = fetch_meili_with_retry(url, headers, sample_data, max_retries=1)
            if 'hits' in parsed:
                for hit in parsed['hits']:
                    hit.pop('zones_variations', None)
                    hit.pop('availability', None)
            console.print("\n[bold green]✔ Preflight Response Received successfully:[/bold green]")
            console.print_json(json.dumps(parsed, ensure_ascii=False))
            console.print("\n[bold green]Preflight check finished. Exiting gracefully.[/bold green]")
            sys.exit(0)
        except Exception as e:
            console.print(f"\n[bold red]❌ Preflight Query Failed: {e}[/bold red]")
            sys.exit(1)

    console.print("[bold cyan]Chefaa Fast Slugs & Full DB Extractor[/bold cyan]")
    console.print(f"  • Country: [bold green]{args.country.upper()}[/bold green]")
    console.print(f"  • Output Directory: [bold green]{args.output_dir}[/bold green]")
    console.print(f"  • Extraction Mode: [bold magenta]{'Complete Product Database' if args.full_db else 'Slugs & IDs Only'}[/bold magenta]")
    console.print(f"  • Format: [bold green]{args.format}[/bold green]\n")

    os.makedirs(args.output_dir, exist_ok=True)

    # Fetch exact total catalog count from Meilisearch
    console.print("[yellow]Querying Meilisearch catalog statistics...[/yellow]")
    total_products = 29000
    try:
        data = {
            'q': '',
            'limit': 0
        }
        parsed = fetch_meili_with_retry(url, headers, data)
        total_products = parsed.get('estimatedTotalHits', 29000)
        console.print(f"  [green]✔[/green] Total products in index: [bold cyan]{total_products:,}[/bold cyan]")
    except Exception as e:
        console.print(f"  [yellow]⚠[/yellow] Could not get total hits, using default fallback of 29,000: {e}")

    # Fetch max price to establish price-slicing bounds
    max_price = 100000
    try:
        data = {
            'q': '',
            'limit': 1,
            'sort': ['price:desc']
        }
        parsed = fetch_meili_with_retry(url, headers, data)
        if parsed.get('hits'):
            raw_max = parsed['hits'][0].get('price', 100000)
            if raw_max > 500000:
                max_price = 250000
                console.print(f"  [yellow]⚠[/yellow] High price anomaly detected ({raw_max}). Clipping search boundary to: [bold]{max_price} EGP/SAR[/bold]")
            else:
                max_price = raw_max
                console.print(f"  [green]✔[/green] Maximum item price found: [bold]{max_price} EGP/SAR[/bold]")
    except Exception as e:
        console.print(f"  [yellow]⚠[/yellow] Failed to fetch max price, using fallback of 100,000: {e}")

    ranges_to_check = [(0, max_price)]
    seen_ids = set()
    collected_items = []

    console.print("\n[bold magenta]Starting Price-Slicing Query Engine...[/bold magenta]")
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=40),
        TaskProgressColumn(),
        MofNCompleteColumn(),
        transient=False,
        console=console
    ) as progress:
        label = "Fetching products database..." if args.full_db else "Fetching product slugs..."
        query_task = progress.add_task(f"[cyan]{label}", total=total_products)
        
        while ranges_to_check:
            min_p, max_p = ranges_to_check.pop(0)
            price_filter = f"price >= {min_p} AND price <= {max_p}"

            try:
                # Check hits in the current slice
                data = {
                    'q': '',
                    'limit': 0,
                    'filter': price_filter
                }
                parsed = fetch_meili_with_retry(url, headers, data)
                est_hits = parsed.get('estimatedTotalHits', 0)
            except Exception as e:
                console.print(f"\n[red]Failed to check range {min_p} - {max_p}: {e}[/red]")
                continue

            if est_hits == 0:
                continue

            # If the hits in this price slice are less than 1,000 (Meilisearch ceiling), fetch them!
            if est_hits < 1000 or min_p >= max_p:
                progress.console.print(f"[dim]→ Fetching Meilisearch: [cyan]filter=\"{price_filter}\"[/cyan] (est. hits: [yellow]{est_hits}[/yellow])[/dim]")
                offset = 0
                limit = 250
                while True:
                    try:
                        data = {
                            'q': '',
                            'limit': limit,
                            'offset': offset,
                            'filter': price_filter
                        }
                        # Retrieve only slug if full-db is not requested (maximizes speed and saves bandwidth)
                        if not args.full_db:
                            data['attributesToRetrieve'] = ['slug']

                        parsed = fetch_meili_with_retry(url, headers, data)
                        hits = parsed.get('hits', [])
                        if not hits:
                            break
                        for hit in hits:
                            slug = hit.get('slug')
                            if slug and slug not in seen_ids:
                                seen_ids.add(slug)
                                if args.full_db:
                                    # Strip out heavy and redundant regional keys to keep file size lightweight
                                    hit.pop('zones_variations', None)
                                    hit.pop('availability', None)
                                    collected_items.append(hit)
                                else:
                                    collected_items.append(slug)
                        
                        # Dynamically update the visual progress bar
                        desc = f"[cyan]Collected {len(collected_items):,} products" if args.full_db else f"[cyan]Collected {len(collected_items):,} unique slugs"
                        progress.update(query_task, completed=len(collected_items), description=desc)
                        
                        if len(hits) < limit:
                            break
                        offset += limit
                    except Exception as e:
                        console.print(f"\n[red]Failed to fetch hits in range {min_p} - {max_p} offset {offset}: {e}[/red]")
                        break
            else:
                # Divide and conquer (Split price range in half)
                mid_p = round((min_p + max_p) / 2.0, 2)
                if mid_p == min_p or mid_p == max_p:
                    min_p = max_p
                    ranges_to_check.append((min_p, max_p))
                else:
                    ranges_to_check.append((min_p, mid_p))
                    ranges_to_check.append((mid_p + 0.01, max_p))

        # Check for products that might be higher than our clipped price boundary
        try:
            data = {
                'q': '',
                'limit': 250,
                'filter': f"price > {max_price}"
            }
            if not args.full_db:
                data['attributesToRetrieve'] = ['slug']

            parsed = fetch_meili_with_retry(url, headers, data)
            hits = parsed.get('hits', [])
            for hit in hits:
                slug = hit.get('slug')
                if slug and slug not in seen_ids:
                    seen_ids.add(slug)
                    if args.full_db:
                        # Strip out heavy and redundant regional keys to keep file size lightweight
                        hit.pop('zones_variations', None)
                        hit.pop('availability', None)
                        collected_items.append(hit)
                    else:
                        collected_items.append(slug)
            progress.update(query_task, completed=len(collected_items))
        except Exception:
            pass

        # Finalize the progress display
        progress.update(query_task, total=len(collected_items), completed=len(collected_items), description="[green]Data retrieval complete!")

    # Determine file paths and data formatting
    if args.full_db:
        json_path = os.path.join(args.output_dir, f"chefaa_products_{args.country}.json")
        txt_path = os.path.join(args.output_dir, f"chefaa_slugs_{args.country}.txt")
        slugs_only = [item.get('slug') for item in collected_items if item.get('slug')]
    else:
        json_path = os.path.join(args.output_dir, f"chefaa_slugs_{args.country}.json")
        txt_path = os.path.join(args.output_dir, f"chefaa_slugs_{args.country}.txt")
        slugs_only = collected_items

    # Save output JSON
    if args.format in ["json", "both"]:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(collected_items, f, indent=4, ensure_ascii=False)
        console.print(f"[green]✔ Saved JSON database:[bold] {json_path}[/bold] ({len(collected_items):,} elements)[/green]")

    # Save output TXT (slugs)
    if args.format in ["txt", "both"]:
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(slugs_only) + "\n")
        console.print(f"[green]✔ Saved TXT sluglist:[bold] {txt_path}[/bold] (one slug per line)[/green]")

    console.print(f"\n[bold green]Success! Complete extraction finished perfectly. Collected {len(collected_items):,} entries.[/bold green]")

if __name__ == "__main__":
    main()
