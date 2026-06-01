import os
import math

def split_file(input_file, output_dir, num_parts):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    total_lines = len(lines)
    chunk_size = math.ceil(total_lines / num_parts)

    for i in range(num_parts):
        start = i * chunk_size
        end = min((i + 1) * chunk_size, total_lines)
        
        # If we are at the last part, make sure we take everything remaining
        # (though min(..., total_lines) already handles it, but let's be explicit if needed)
        if i == num_parts - 1:
            end = total_lines
            
        chunk = lines[start:end]
        
        output_file = os.path.join(output_dir, f"all-products-names-part-{i+1:02d}.txt")
        with open(output_file, 'w', encoding='utf-8') as f_out:
            f_out.writelines(chunk)
            
        print(f"Created {output_file} with {len(chunk)} lines.")

    print(f"Total lines processed: {total_lines}")

if __name__ == "__main__":
    split_file("data/all-products-names.txt", "data/chunks", 24)
