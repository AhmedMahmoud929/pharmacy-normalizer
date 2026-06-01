import os
import subprocess
import time
import sys

# Ensure UTF-8 output for Windows console
if sys.platform == "win32":
    import io
    sys.stdout.reconfigure(encoding='utf-8')

def run_large_sheet_matching(input_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    if not os.path.exists(input_path):
        print(f"Error: File not found: {input_path}")
        return

    filename = os.path.basename(input_path)
    output_filename = filename.replace('.xlsx', '_matched.xlsx')
    output_path = os.path.join(output_dir, output_filename)
    
    print(f"🚀 Starting [bold magenta]Turbo v8[/bold magenta] Matching: {filename}")
    print(f"📁 Source: {input_path}")
    print(f"📁 Target: {output_path}")
    
    start_time = time.time()
    
    # Run matcher.py CLI
    # Added --parallel flag for 10x-15x speedup
    # Added --rich flag for beautiful stats
    cmd = [
        "python", "tools/matcher.py",
        "--file", input_path,
        "--output", output_path,
        "--parallel",
        "--rich",
        "--yes"
    ]
    
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error processing {filename}: {e}")
        return
            
    total_time = time.time() - start_time
    print(f"\n✨ Turbo Matching complete!")
    print(f"⏱️ Total time: {total_time/60:.2f} minutes")
    print(f"📊 Results saved to: {output_dir}")

if __name__ == "__main__":
    INPUT_FILE = "data/sheets_input/sheet-3.xlsx"
    OUTPUT_DIR = "data/sheets_output"
    run_large_sheet_matching(INPUT_FILE, OUTPUT_DIR)
