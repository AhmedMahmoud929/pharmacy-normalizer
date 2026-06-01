import pandas as pd
import math
import os

def split_excel(file_path, output_dir, num_chunks=10):
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Reading {file_path}...")
    df = pd.read_excel(file_path)
    
    total_rows = len(df)
    chunk_size = math.ceil(total_rows / num_chunks)
    
    print(f"Total rows: {total_rows}")
    print(f"Creating {num_chunks} chunks of size ~{chunk_size}...")
    
    for i in range(num_chunks):
        start = i * chunk_size
        end = min((i + 1) * chunk_size, total_rows)
        
        if start >= total_rows:
            break
            
        chunk = df.iloc[start:end]
        chunk_file = os.path.join(output_dir, f'sheet-3_chunk_{i+1}.xlsx')
        chunk.to_excel(chunk_file, index=False)
        print(f"Saved {chunk_file} ({len(chunk)} rows)")

if __name__ == "__main__":
    split_excel('data/sheets_input/sheet-3.xlsx', 'data/sheets_input/sheet-3_chunks')
