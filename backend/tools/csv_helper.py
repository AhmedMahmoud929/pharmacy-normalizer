import os
import io
import re
import pandas as pd
from typing import Tuple

def detect_csv_separator(file_bytes: bytes) -> str:
    # Try decoding a chunk of the file
    try:
        sample = file_bytes[:50000].decode("utf-8", errors="ignore")
    except Exception:
        sample = file_bytes[:50000].decode("latin-1", errors="ignore")
    
    lines = sample.splitlines()
    if not lines:
        return ","
        
    # Check the first few lines
    candidate_delimiters = [",", "\t", ";", "|"]
    
    # Count occurrence consistency on non-empty lines
    non_empty_lines = [line for line in lines[:5] if line.strip()]
    if not non_empty_lines:
        return ","
        
    delim_scores = {d: 0 for d in candidate_delimiters}
    for d in candidate_delimiters:
        # Check if the number of occurrences of d is the same and > 0 across these lines
        counts = [line.count(d) for line in non_empty_lines]
        if all(c > 0 for c in counts):
            if len(set(counts)) == 1:
                delim_scores[d] += 10 + counts[0]
            else:
                delim_scores[d] += 5 + min(counts)
        else:
            delim_scores[d] += non_empty_lines[0].count(d)
            
    best_delim = max(delim_scores, key=delim_scores.get)
    if delim_scores[best_delim] == 0:
        return ","
    return best_delim

def load_csv_safely(file_bytes: bytes) -> pd.DataFrame:
    sep = detect_csv_separator(file_bytes)
    try:
        # Try loading normally with detected separator
        return pd.read_csv(io.BytesIO(file_bytes), sep=sep)
    except pd.errors.ParserError as pe:
        # Format a user-friendly error message
        error_msg = str(pe)
        line_match = re.search(r"line (\d+)", error_msg)
        if line_match:
            line_num = line_match.group(1)
            fields_match = re.search(r"Expected (\d+) fields.*saw (\d+)", error_msg)
            if fields_match:
                expected, saw = fields_match.groups()
                user_msg = (
                    f"CSV parsing error at line {line_num}: "
                    f"The row has {saw} columns, but the header expects {expected}. "
                    "Please ensure all rows are properly formatted and columns are aligned."
                )
            else:
                user_msg = f"CSV parsing error at line {line_num}: {error_msg}."
        else:
            user_msg = f"CSV parsing error: {error_msg}."
        raise ValueError(user_msg) from pe
    except UnicodeDecodeError as ude:
        raise ValueError(
            "Character encoding error: The file is not saved in a supported encoding (like UTF-8). "
            "Please ensure the file is saved as a standard CSV or Excel file."
        ) from ude
    except Exception as e:
        raise ValueError(f"Failed to read CSV file: {str(e)}") from e

def load_sheet_safely(file_bytes: bytes, file_ext: str) -> pd.DataFrame:
    file_ext = file_ext.lower()
    if file_ext in [".xlsx", ".xls"]:
        try:
            return pd.read_excel(io.BytesIO(file_bytes))
        except Exception as e:
            raise ValueError(f"Failed to read Excel file: {str(e)}") from e
    elif file_ext == ".csv":
        return load_csv_safely(file_bytes)
    else:
        raise ValueError(f"Unsupported file format: {file_ext}")

def load_sheet_from_path_safely(file_path: str) -> pd.DataFrame:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    ext = os.path.splitext(file_path)[1].lower()
    if ext in [".xlsx", ".xls"]:
        try:
            return pd.read_excel(file_path)
        except Exception as e:
            raise ValueError(f"Failed to read Excel file: {str(e)}") from e
    else:
        # Read file bytes for CSV
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        return load_csv_safely(file_bytes)
