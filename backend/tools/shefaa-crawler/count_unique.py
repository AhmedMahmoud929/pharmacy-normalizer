import json
import os
import argparse
import sys
from rich.console import Console
from rich.panel import Panel

# Ensure console handles UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    parser = argparse.ArgumentParser(description="Count Unique Items in any JSON dataset file")
    parser.add_argument("file_path", type=str, nargs="?", default="data/chefaa_products_eg.json", help="Path to the JSON file to analyze")
    args = parser.parse_args()

    console = Console()
    console.print("[bold cyan]Dataset Uniqueness Analyzer[/bold cyan]\n")

    if not args.file_path:
        console.print("[bold red]❌ Error: No JSON file path provided.[/bold red]")
        console.print("Usage: [bold green]python shefaa-crawler/count_unique.py <file_path>[/bold green]")
        sys.exit(1)

    if not os.path.exists(args.file_path):
        console.print(f"[bold red]❌ Error: File not found at {args.file_path}[/bold red]")
        sys.exit(1)

    console.print(f"[yellow]Reading and parsing [bold]{args.file_path}[/bold]...[/yellow]")
    
    try:
        with open(args.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        console.print(f"[bold red]❌ Error parsing JSON file: {e}[/bold red]")
        sys.exit(1)

    if not isinstance(data, list):
        console.print(f"[yellow]⚠ Warning: The JSON root is a {type(data).__name__}, not a List. Counting values instead.[/yellow]")
        total_items = len(data)
        unique_items = 1 # Dict is singular
        console.print(f"Total keys/items: [bold cyan]{total_items}[/bold cyan]")
        sys.exit(0)

    total_items = len(data)
    
    if total_items == 0:
        console.print("[bold yellow]The dataset is empty (0 items).[/bold yellow]")
        sys.exit(0)

    first_item = data[0]

    # Check if elements are dictionaries (Objects) or simple types (Strings/Numbers)
    if isinstance(first_item, dict):
        # Extract unique counts by various keys
        unique_slugs = len(set(item.get('slug') for item in data if item.get('slug') is not None))
        unique_ids = len(set(item.get('id') for item in data if item.get('id') is not None))
        
        # Check overall object string hash uniqueness
        try:
            unique_objects = len(set(json.dumps(item, sort_keys=True) for item in data))
        except Exception:
            unique_objects = total_items

        report_text = (
            f"📦 [bold]Total Elements in File:[/bold] [cyan]{total_items:,}[/cyan]\n\n"
            f"🔑 [bold green]Unique by 'slug':[/bold green] [bold]{unique_slugs:,}[/bold] ({'100% Unique' if unique_slugs == total_items else f'{total_items - unique_slugs:,} duplicates'})\n"
            f"🆔 [bold green]Unique by 'id':  [/bold green] [bold]{unique_ids:,}[/bold] ({'100% Unique' if unique_ids == total_items else f'{total_items - unique_ids:,} duplicates'})\n"
            f"🧩 [bold green]Unique by Content (Hash):[/bold green] [bold]{unique_objects:,}[/bold]"
        )
    else:
        # Simple list of strings/numbers
        unique_items = len(set(data))
        report_text = (
            f"📦 [bold]Total Elements in File:[/bold] [cyan]{total_items:,}[/cyan]\n"
            f"🔑 [bold green]Unique Elements:       [/bold green] [bold]{unique_items:,}[/bold] ({'100% Unique' if unique_items == total_items else f'{total_items - unique_items:,} duplicates'})"
        )

    console.print(Panel(report_text, title=f"Uniqueness Analytics: {os.path.basename(args.file_path)}", expand=False))

if __name__ == "__main__":
    main()
