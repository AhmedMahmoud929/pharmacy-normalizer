#!/usr/bin/env python3
"""
CLI tool to search for a product in the standard database.

Usage:
  python scripts/search.py "AUGMENTIN 1GM TABS"
"""

import argparse
import sys
import os
import warnings
import difflib

# Suppress openpyxl warnings
warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Fix imports when running from scripts/ directory
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer import normalize
import pandas as pd
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

console = Console()

def get_jaccard_sim(str1, str2): 
    a = set(str1.split()) 
    b = set(str2.split())
    if not a or not b:
        return 0.0
    c = a.intersection(b)
    return float(len(c)) / (len(a) + len(b) - len(c))

def get_similarity_score(query_norm, cand_norm):
    """
    Combined Jaccard (token overlap) and SequenceMatcher (character similarity) score.
    """
    if not isinstance(cand_norm, str):
        return 0.0
    
    jaccard = get_jaccard_sim(query_norm, cand_norm)
    seq_match = difflib.SequenceMatcher(None, query_norm, cand_norm).ratio()
    
    # Weight Jaccard heavily since tokens matching exactly (e.g. '500', 'mg', 'tab') is very important
    return (jaccard * 0.7) + (seq_match * 0.3)

def search_product(query: str, standard_file: str, top_k: int = 5):
    # 1. Normalize Query
    norm_query = normalize(query)
    
    console.print(Panel(f"[bold cyan]Raw Query:[/bold cyan] {query}\n[bold green]Normalized:[/bold green] {norm_query}", title="Query Normalization", border_style="blue"))
    
    # 2. Load Standard DB
    if not os.path.exists(standard_file):
        console.print(f"[bold red]❌ Standard file not found: {standard_file}[/bold red]")
        console.print("Please run [bold yellow]python scripts/normalize.py --file sheets/standard.xlsx[/bold yellow] first to generate it.")
        sys.exit(1)
        
    with console.status(f"[bold yellow]Loading {standard_file}...[/bold yellow]"):
        df = pd.read_excel(standard_file)
        
    if "normalized_name" not in df.columns or "name" not in df.columns:
        console.print(f"[bold red]❌ File must contain 'name' and 'normalized_name' columns.[/bold red]")
        sys.exit(1)
        
    # 3. Find Exact Matches
    exact_matches = df[df['normalized_name'] == norm_query]
    
    if not exact_matches.empty:
        console.print("\n[bold green]✅ Exact Match Found![/bold green]")
        table = Table(box=box.SIMPLE_HEAVY, header_style="bold green")
        table.add_column("Original Name in Standard", style="cyan")
        table.add_column("Normalized Name", style="green")
        
        for _, row in exact_matches.iterrows():
            table.add_row(str(row['name']), str(row['normalized_name']))
            
        console.print(table)
    else:
        console.print("\n[bold yellow]⚠️ No Exact Match Found. Looking for closest candidates...[/bold yellow]")
        
    # 4. Smart Search (Candidates)
    with console.status("[bold yellow]Computing similarities...[/bold yellow]"):
        # Remove exact matches from candidates if we want, but showing them at the top of candidates is fine
        # We compute scores for all rows to find the top k
        df['score'] = df['normalized_name'].apply(lambda x: get_similarity_score(norm_query, x))
        
        candidates = df.sort_values(by='score', ascending=False).head(top_k)
        
    console.print(f"\n[bold magenta]🔍 Top {top_k} Candidates:[/bold magenta]")
    table = Table(box=box.SIMPLE, header_style="bold magenta")
    table.add_column("Score", justify="right", style="magenta")
    table.add_column("Original Name", style="cyan")
    table.add_column("Normalized Name", style="green")
    
    for _, row in candidates.iterrows():
        # Highlight exact matching tokens in the normalized name
        cand_norm = str(row['normalized_name'])
        cand_words = cand_norm.split()
        query_words = set(norm_query.split())
        
        highlighted_norm = " ".join([f"[bold]{w}[/bold]" if w in query_words else w for w in cand_words])
        
        score_pct = f"{row['score'] * 100:.1f}%"
        table.add_row(score_pct, str(row['name']), highlighted_norm)
        
    console.print(table)
    print()

def main():
    parser = argparse.ArgumentParser(description="Smart search for a product in the standard database.")
    parser.add_argument("query", help="The raw product name to search for.")
    parser.add_argument(
        "--db", 
        default=os.path.join(project_root, "data", "normalized", "standard_normalized.xlsx"),
        help="Path to the normalized standard Excel file."
    )
    parser.add_argument("--top", type=int, default=5, help="Number of candidates to return.")
    
    args = parser.parse_args()
    
    search_product(args.query, args.db, args.top)

if __name__ == "__main__":
    main()
