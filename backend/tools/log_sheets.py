import pandas as pd
import os
import sys
import warnings
from rich.console import Console
from rich.table import Table
from rich import box

# Suppress openpyxl warnings
warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

# Initialize Rich console with UTF-8 force
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    console = Console(file=sys.stdout, force_terminal=True)
else:
    console = Console()

def get_name_column(columns):
    """Detects the name column based on common variations."""
    matches = ['name', 'Name', 'الاسم الانجليزى']
    for m in matches:
        if m in columns:
            return m
    
    # Fallback search
    for col in columns:
        col_str = str(col).lower()
        if 'name' in col_str or 'الاسم' in col_str:
            return col
            
    return columns[0]

def log_proper_table():
    # Look for files in the 'sheets' directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sheets_dir = os.path.join(base_dir, "sheets")
    
    files = ['standard.xlsx', 'sheet-1.xlsx', 'sheet-2.xlsx', 'sheet-3.xlsx']
    data = {}
    headers = []

    # Read the first 10 rows from each file
    for f_name in files:
        f = os.path.join(sheets_dir, f_name)
        if os.path.exists(f):
            try:
                # Read headers
                cols_df = pd.read_excel(f, nrows=0)
                col_name = get_name_column(cols_df.columns.tolist())
                
                # Read 10 rows
                df = pd.read_excel(f, usecols=[col_name], nrows=10)
                sheet_label = f.replace('.xlsx', '')
                data[sheet_label] = df[col_name].fillna("").tolist()
                headers.append(sheet_label)
            except Exception:
                pass

    if not data:
        console.print("[bold red]No data found or files missing.[/bold red]")
        return

    # Create a proper Rich table
    table = Table(
        title=f"TABLE : {' | '.join(headers)}",
        show_header=True,
        header_style="bold magenta",
        border_style="cyan",
        box=box.SQUARE
    )

    # Add columns
    for h in headers:
        table.add_column(h, style="green", no_wrap=False)

    # Add rows
    for i in range(10):
        row_values = []
        for h in headers:
            val = data[h][i] if i < len(data[h]) else ""
            row_values.append(str(val))
        
        # Only add row if at least one column has content
        if any(v.strip() for v in row_values):
            table.add_row(*row_values)

    console.print(table)

if __name__ == "__main__":
    log_proper_table()
