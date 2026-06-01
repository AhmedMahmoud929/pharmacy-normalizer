import cv2
import numpy as np
import argparse
import os
from pathlib import Path
import sys

def load_image(path):
    """Loads and validates an image from the given path."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")
    
    img = cv2.imread(path)
    if img is None:
        raise ValueError(f"Could not load image: {path}. It might be corrupted or in an unsupported format.")
    
    return img

def detect_watermark(img, lower_thresh=180, upper_thresh=230, strategy='threshold', saturation_limit=30, template_path=None):
    """Detects watermark pixels based on the chosen strategy or a provided template."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Strategy 1: Multi-Scale Template Matching (Highly Accurate & Robust)
    if template_path and os.path.exists(template_path):
        template = cv2.imread(template_path)
        if template is not None:
            t_gray_orig = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)
            mask = np.zeros(gray.shape, dtype=np.uint8)
            found_any = False
            
            # Scale the template to handle different logo sizes
            for scale in np.linspace(0.5, 1.5, 10):
                resized_t = cv2.resize(template, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
                t_h, t_w = resized_t.shape[:2]
                
                # Ensure resized template isn't larger than the image
                if t_h > img.shape[0] or t_w > img.shape[1]:
                    continue
                
                res = cv2.matchTemplate(img, resized_t, cv2.TM_CCOEFF_NORMED)
                threshold = 0.6  # Slightly lower to be more inclusive
                loc = np.where(res >= threshold)
                
                for pt in zip(*loc[::-1]):
                    found_any = True
                    # Create a shape-specific mask from the resized template
                    t_gray = cv2.cvtColor(resized_t, cv2.COLOR_BGR2GRAY)
                    _, t_mask = cv2.threshold(t_gray, 240, 255, cv2.THRESH_BINARY_INV)
                    
                    # Apply to global mask
                    mask[pt[1]:pt[1]+t_h, pt[0]:pt[0]+t_w] = cv2.bitwise_or(
                        mask[pt[1]:pt[1]+t_h, pt[0]:pt[0]+t_w], t_mask
                    )
            
            if found_any:
                return mask


    # Fallback to standard strategies if no template or no match found
    if strategy == 'threshold':
        mask = cv2.inRange(gray, lower_thresh, upper_thresh)
        saturation = hsv[:, :, 1]
        sat_mask = cv2.threshold(saturation, saturation_limit, 255, cv2.THRESH_BINARY_INV)[1]
        mask = cv2.bitwise_and(mask, sat_mask)
    elif strategy == 'adaptive':
        mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                     cv2.THRESH_BINARY_INV, 21, 10)
        intensity_mask = cv2.inRange(gray, lower_thresh, upper_thresh)
        mask = cv2.bitwise_and(mask, intensity_mask)
        edges = cv2.Canny(gray, 50, 150)
        mask = cv2.bitwise_or(mask, edges)
    else:
        mask = cv2.inRange(gray, lower_thresh, upper_thresh)


    # NEW: Detect specific red colors (common in pharmacy logos)
    # Define range for red (handles the wrap-around in HSV)
    lower_red1 = np.array([0, 70, 50])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 70, 50])
    upper_red2 = np.array([180, 255, 255])
    
    mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask_red = cv2.bitwise_or(mask_red1, mask_red2)
    
    # Combine standard detection with red detection
    mask = cv2.bitwise_or(mask, mask_red)
        
    return mask

def post_process_mask(mask, max_area_pct=0.1):
    """Removes very large or very small components and isolates thin lines."""
    h, w = mask.shape
    
    # Step 1: Remove small noise
    kernel_small = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_small)
    
    # Step 2: Identify solid areas (product details)
    kernel_large = cv2.getStructuringElement(cv2.MORPH_RECT, (10, 10))
    solid_areas = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_large)
    
    # Step 3: Conditional Subtraction
    # We only want to "protect" solid areas in the CENTER of the image (likely the product)
    # If a solid area is in the corners, it's likely a logo we WANT to remove.
    center_mask = np.zeros_like(mask)
    margin_h, margin_w = int(h * 0.2), int(w * 0.2)
    center_mask[margin_h:h-margin_h, margin_w:w-margin_w] = 255
    
    # Only subtract if it's a solid area in the center
    protected_solid = cv2.bitwise_and(solid_areas, center_mask)
    mask = cv2.subtract(mask, protected_solid)
    
    # Step 4: Standard component filtering
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask)
    total_area = h * w
    max_area = total_area * max_area_pct
    
    new_mask = np.zeros_like(mask)
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if 2 < area < max_area:
            new_mask[labels == i] = 255
            
    return new_mask

def refine_mask(mask, dilate_size=5):
    """Cleans up the mask using morphological operations."""
    if dilate_size <= 0:
        return mask
    
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_size, dilate_size))
    
    # Dilate to cover boundaries
    mask = cv2.dilate(mask, kernel, iterations=1)
    
    # Close holes
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    
    return mask

def inpaint_image(img, mask, radius=5, engine='telea', lower_thresh=180):
    """Removes the masked region using the chosen engine."""
    engine = engine.lower()
    
    if engine == 'telea':
        return cv2.inpaint(img, mask, radius, cv2.INPAINT_TELEA)
    elif engine == 'ns':
        return cv2.inpaint(img, mask, radius, cv2.INPAINT_NS)
    elif engine == 'levels':
        # Treat watermark as a "shadow" and reverse the lighting shift (Gain Correction)
        result = img.copy()
        res_float = result.astype(np.float32)
        
        # Calculate the gain needed to push the watermark gray back to white
        # If background is 255 and watermark is ~230, gain is 255/230
        gain = 255.0 / float(lower_thresh) if lower_thresh > 0 else 1.1
        
        # Apply gain only to the masked area
        mask_indices = (mask == 255)
        for c in range(3):
            # Apply exposure compensation (Gain)
            res_float[mask_indices, c] = np.clip(res_float[mask_indices, c] * gain, 0, 255)
            
            # Final "bleach" pass for near-white pixels to ensure pure white BG
            bg_indices = (mask_indices) & (res_float[:, :, c] > 230)
            res_float[bg_indices, c] = 255
            
        return res_float.astype(np.uint8)
    
    elif engine == 'lama' or engine == 'iopaint':
        try:
            # Use simple-lama-inpainting for high-quality AI inpainting
            from simple_lama_inpainting import SimpleLama
            from PIL import Image
            
            # Convert BGR (OpenCV) to RGB (PIL)
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(img_rgb)
            pil_mask = Image.fromarray(mask).convert('L')
            
            print(f"  Running AI inpainting (LaMa)...")
            lama = SimpleLama()
            result_pil = lama(pil_img, pil_mask)
            
            # Convert back to BGR for OpenCV
            result = cv2.cvtColor(np.array(result_pil), cv2.COLOR_RGB2BGR)
            return result
            
        except Exception as e:
            print(f"  Error: AI inpainting failed: {e}", file=sys.stderr)
            print("  Falling back to TELEA...", file=sys.stderr)
            return cv2.inpaint(img, mask, radius, cv2.INPAINT_TELEA)


    
    return cv2.inpaint(img, mask, radius, cv2.INPAINT_TELEA)

def main():
    parser = argparse.ArgumentParser(description="Image Watermark Removal Tool")
    parser.add_argument("input", nargs="+", help="Input image path(s) or directory")
    parser.add_argument("-o", "--output", default="cleaned", help="Output directory")
    parser.add_argument("--engine", choices=["telea", "ns", "lama", "levels"], default="telea", help="Inpainting engine")
    parser.add_argument("--strategy", choices=["threshold", "adaptive", "fft"], default="adaptive", help="Detection strategy")
    parser.add_argument("--template", help="Path to watermark template image for matching")
    parser.add_argument("--lower", type=int, default=180, help="Lower grayscale threshold")
    parser.add_argument("--upper", type=int, default=245, help="Upper grayscale threshold")
    parser.add_argument("--dilate", type=int, default=5, help="Dilation kernel size")
    parser.add_argument("--radius", type=int, default=5, help="Inpaint radius")
    parser.add_argument("--max-area", type=float, default=0.2, help="Max area percentage for a single watermark component")
    parser.add_argument("--sat-limit", type=int, default=40, help="Saturation limit for watermark pixels")
    parser.add_argument("--preview", action="store_true", help="Show before/after preview")
    parser.add_argument("--debug", action="store_true", help="Save intermediate mask for debugging")
    parser.add_argument("--verbose", action="store_true", help="Detailed logging")

    args = parser.parse_args()

    # Create output dir
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Collect images
    input_paths = []
    for p in args.input:
        path = Path(p)
        if path.is_dir():
            input_paths.extend(list(path.glob("*.png")) + list(path.glob("*.jpg")) + list(path.glob("*.jpeg")))
        else:
            input_paths.append(path)

    if not input_paths:
        print("No images found to process.")
        sys.exit(2)

    success_count = 0
    fail_count = 0

    for i, path in enumerate(input_paths):
        try:
            if args.verbose:
                print(f"[{i+1}/{len(input_paths)}] Processing {path.name}...")
            
            img = load_image(str(path))
            mask = detect_watermark(img, args.lower, args.upper, args.strategy, args.sat_limit, args.template)
            mask = refine_mask(mask, args.dilate)
            mask = post_process_mask(mask, args.max_area)
            
            if args.debug:
                # Save raw mask
                debug_mask_path = output_dir / f"debug_mask_{path.name}"
                cv2.imwrite(str(debug_mask_path), mask)
                
                # Save red overlay on original image
                overlay = img.copy()
                overlay[mask == 255] = [0, 0, 255] # Red BGR
                debug_overlay_path = output_dir / f"debug_overlay_{path.name}"
                cv2.imwrite(str(debug_overlay_path), overlay)
                
                if args.verbose:
                    print(f"  Debug mask saved to {debug_mask_path}")
                    print(f"  Debug overlay saved to {debug_overlay_path}")

            
            # Check if mask is empty
            if cv2.countNonZero(mask) == 0:
                if args.verbose:
                    print(f"  Warning: No watermark detected in {path.name}. Saving original.")
                result = img
            else:
                result = inpaint_image(img, mask, args.radius, args.engine, args.lower)

            output_path = output_dir / path.name
            cv2.imwrite(str(output_path), result)
            
            if args.preview:
                # Resize for preview if too large
                h, w = img.shape[:2]
                max_dim = 800
                if max(h, w) > max_dim:
                    scale = max_dim / max(h, w)
                    img_p = cv2.resize(img, (int(w*scale), int(h*scale)))
                    result_p = cv2.resize(result, (int(w*scale), int(h*scale)))
                else:
                    img_p, result_p = img, result
                
                comparison = np.hstack((img_p, result_p))
                cv2.imshow(f"Preview: {path.name} (Original | Cleaned)", comparison)
                print("Press any key to continue...")
                cv2.waitKey(0)
                cv2.destroyAllWindows()

            success_count += 1
        except Exception as e:
            print(f"Error processing {path.name}: {e}", file=sys.stderr)
            fail_count += 1
            # Copy original to output as fallback? Spec says so.
            try:
                import shutil
                shutil.copy2(path, output_dir / path.name)
            except:
                pass

    if args.verbose or success_count > 0 or fail_count > 0:
        print(f"\nProcessed {len(input_paths)} images: {success_count} cleaned, {fail_count} failed.")

    if fail_count > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
