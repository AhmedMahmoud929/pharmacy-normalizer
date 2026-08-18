# Image Watermark Removal Tool

> **One-liner**: A Python CLI script that automatically detects and removes semi-transparent or opaque watermarks from product images using OpenCV inpainting and optional AI-based restoration.

---

## 1. Overview

Product images sourced from pharmacies, e-commerce stores, or suppliers frequently carry branding watermarks — circular logos, repeating text overlays, or semi-transparent stamps. This tool provides a Python script that accepts a product image as input, detects the watermark region through pixel-level analysis, builds a mask covering it, and then reconstructs the underlying image content using OpenCV's inpainting algorithms or an AI model (LaMa) for higher-quality results.

The tool targets two main watermark types found in real-world product photography: (1) semi-transparent circular/elliptical text logos stamped over the image, and (2) tiled repeating text patterns across the full image. For each type a different detection and masking strategy is applied before the shared inpainting stage runs.

The script is designed to be run from the command line as a single-file utility with no web server or database required. It accepts one or more input images, processes them, and writes cleaned output images to a configurable output directory. An optional `--preview` flag opens a side-by-side comparison window using OpenCV's `imshow`.

The tool is useful for anyone who has the rights to the images they are editing — e.g. a pharmacy or retailer who received watermarked supplier photos and needs clean versions for their own catalogue.

---

## 2. Goals & Success Criteria

| #   | Goal                                             | How We Measure It                                                                        |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 1   | Detect semi-transparent watermarks automatically | Watermark mask covers ≥ 90% of the actual watermark area on the test image set           |
| 2   | Remove watermark without visible artefacts       | Human reviewer rates cleaned image ≥ 4/5 on a naturalness scale for ≥ 80% of test images |
| 3   | Support batch processing of multiple images      | 20 images processed in under 60 seconds on a standard laptop CPU                         |
| 4   | Provide a clear CLI interface                    | Running `python remove_watermark.py --help` fully documents all flags                    |
| 5   | Degrade gracefully when watermark is not found   | Script exits with a warning and writes the original image unmodified                     |

---

## 3. Non-Goals (Out of Scope)

- No GUI or web interface — CLI only in this version.
- No training or fine-tuning of AI models — only inference using pre-trained weights.
- No support for video files or animated GIFs.
- No cloud upload or API endpoint — all processing is local.
- No automatic copyright or ownership verification — the caller is responsible for usage rights.
- No reconstruction of text or logos that were hidden under the watermark.

---

## 4. User Stories / Use Cases

```
As a pharmacy catalogue manager, I want to remove our supplier's watermark from
product images so that I can publish clean photos on our own website.
```

```
As a developer, I want to pass a folder of images to the script and get cleaned
versions saved automatically so that I don't have to process each file manually.
```

```
As a QA reviewer, I want to see a before/after preview of each cleaned image
so that I can verify the result looks natural before saving it.
```

```
As a power user, I want to choose between fast OpenCV inpainting and high-quality
AI inpainting (LaMa) so that I can trade off speed vs. quality per batch.
```

```
As a developer integrating this into a pipeline, I want the script to return a
non-zero exit code when processing fails so that my CI/CD can detect errors.
```

---

## 5. Technical Approach

### Stack / Environment
- Language: Python 3.9+
- Key libraries: `opencv-python`, `numpy`, `Pillow`, `argparse`, `pathlib`
- Optional AI backend: `lama-cleaner` (PyTorch-based, CPU or CUDA)
- Storage: local filesystem only
- Auth: none

### Architecture Notes

The script is structured as a single module `remove_watermark.py` with the following internal pipeline:

```
Input image
    │
    ▼
[load_image()]           — reads file via OpenCV, validates format
    │
    ▼
[detect_watermark()]     — returns a binary mask (uint8, 0/255)
    │  ├── strategy: THRESHOLD  (semi-transparent grey text)
    │  └── strategy: FFT        (repeating tiled patterns)
    ▼
[refine_mask()]          — morphological dilation + closing to fill gaps
    │
    ▼
[inpaint_image()]        — fills masked region
    │  ├── engine: TELEA  (cv2.inpaint, fast)
    │  ├── engine: NS     (Navier-Stokes, cv2.inpaint, smoother)
    │  └── engine: LAMA   (AI, highest quality, optional)
    ▼
[save_result()]          — writes to output path, optionally shows preview
```

Detection parameters (threshold range, dilation kernel size, inpaint radius) are exposed as CLI flags so the user can tune them per image batch without editing code.

### Data Model

No persistent data model. All state is in-memory per invocation:

```
ProcessingResult
  - input_path:    Path       // original file
  - output_path:   Path       // where cleaned image is saved
  - mask:          np.ndarray // uint8 binary mask
  - engine_used:   str        // "telea" | "ns" | "lama"
  - success:       bool
  - error_msg:     str | None
```

### API Contract

CLI interface (not HTTP):

```
python remove_watermark.py [OPTIONS] INPUT [INPUT ...]

Positional:
  INPUT               One or more image file paths or a directory path

Options:
  -o, --output DIR    Output directory (default: ./cleaned)
  --engine ENGINE     Inpainting engine: telea | ns | lama (default: telea)
  --lower INT         Lower grayscale threshold for watermark detection (default: 180)
  --upper INT         Upper grayscale threshold for watermark detection (default: 230)
  --dilate INT        Dilation kernel size in pixels (default: 5)
  --radius INT        Inpaint neighbourhood radius (default: 5, ignored for lama)
  --preview           Show before/after comparison window for each image
  --dry-run           Detect and show mask only, do not write output
  --verbose           Print per-image processing details

Exit codes:
  0   All images processed successfully
  1   One or more images failed
  2   Bad arguments / missing input files
```

---

## 6. UI Layout

Not applicable — this is a CLI tool. The only visual output is the optional `--preview` window rendered by OpenCV's `imshow`, which shows:

```
┌───────────────────────────────────────────────────────┐
│  remove_watermark — preview: product.png              │
├────────────────────────┬──────────────────────────────┤
│                        │                              │
│   ORIGINAL             │   CLEANED                    │
│   (with watermark)     │   (inpainted)                │
│                        │                              │
│   [product image]      │   [product image]            │
│                        │                              │
└────────────────────────┴──────────────────────────────┘
   Press any key to continue to next image
```

### States
| State        | Description                                                          |
| ------------ | -------------------------------------------------------------------- |
| Default      | Script processes silently, writes files to output dir                |
| Preview mode | OpenCV window opens per image; user presses any key to continue      |
| Dry-run      | Mask is visualised (red overlay on original) but no file is written  |
| Error        | Warning printed to stderr; original image copied to output unchanged |

### Interaction Notes
- No interactive prompts during batch processing — fully non-interactive by default.
- Preview window is keyboard-dismissable (any key) to support scripted use with `xdotool` if needed.
- Verbose mode prints a progress line per image: `[1/20] product.png → cleaned/product.png (engine=telea, 0.34s)`.

---

## 7. Tasks

### Phase 1 — Foundation

- [ ] **T-01** Set up project structure and dependencies  
  _What_: Create `remove_watermark.py`, `requirements.txt` (opencv-python, numpy, Pillow), and `requirements-lama.txt` (lama-cleaner). Add a `README.md` with install and usage instructions.  
  _Outcome_: `pip install -r requirements.txt` completes without errors on Python 3.9+; `python remove_watermark.py --help` prints the full usage string.  
  _Dependencies_: None

- [ ] **T-02** Implement `load_image()` with format validation  
  _What_: Use `cv2.imread()` to load the image. Validate the file exists, is a supported format (JPEG, PNG, WEBP, BMP), and is not corrupted (non-None return). Raise a descriptive `ValueError` on failure.  
  _Outcome_: Function returns a valid BGR `np.ndarray` for good inputs; raises `ValueError` with a clear message for bad inputs. Unit-tested with a valid PNG, a missing file, and a non-image file.  
  _Dependencies_: T-01

- [ ] **T-03** Implement `detect_watermark()` with THRESHOLD strategy  
  _What_: Convert the image to grayscale. Apply `cv2.inRange(gray, lower, upper)` to isolate the semi-transparent watermark pixels. Return a `uint8` binary mask (255 = watermark, 0 = background).  
  _Outcome_: When run on the reference pharmacy product image, the returned mask visually covers the circular watermark text with no large gaps. Verified by saving the mask as a PNG and inspecting it.  
  _Dependencies_: T-02

- [ ] **T-04** Implement `refine_mask()` with morphological operations  
  _What_: Apply `cv2.dilate()` with an elliptical kernel of configurable size, then `cv2.morphologyEx(MORPH_CLOSE)` to fill holes within the detected region. Return the refined mask.  
  _Outcome_: Refined mask has no isolated single-pixel noise and watermark region boundaries are solid. Compare raw vs refined mask visually on the test image.  
  _Dependencies_: T-03

### Phase 2 — Core Feature

- [ ] **T-05** Implement `inpaint_image()` with TELEA and NS engines  
  _What_: Call `cv2.inpaint(img, mask, inpaintRadius, flags)` using `cv2.INPAINT_TELEA` or `cv2.INPAINT_NS` based on the `engine` parameter. Return the cleaned BGR image.  
  _Outcome_: Output image has no visible circular watermark on the pharmacy test image. Saved to disk and visually verified. Processing time under 2 seconds for a 1000×1000px image on CPU.  
  _Dependencies_: T-04

- [ ] **T-06** Implement `save_result()` and `--output` directory handling  
  _What_: Create the output directory if it does not exist (`pathlib.Path.mkdir(parents=True, exist_ok=True)`). Save the cleaned image using `cv2.imwrite()` preserving the original filename. Return the output path.  
  _Outcome_: Running the script on a single image writes the cleaned file to `./cleaned/<original_name>`. Verified by checking the file exists and is a valid image.  
  _Dependencies_: T-05

- [ ] **T-07** Implement the CLI argument parser with all documented flags  
  _What_: Use `argparse` to expose all flags listed in the API contract section. Wire flags to the processing pipeline. Handle both single-file and directory inputs (glob all image files from the directory).  
  _Outcome_: All flags work as documented. `--dry-run` saves a mask-overlay PNG instead of the cleaned image. `--preview` opens an `imshow` window. Exit codes are correct.  
  _Dependencies_: T-06

- [ ] **T-08** Implement batch processing loop with error isolation  
  _What_: Wrap per-image processing in a `try/except` block. On failure, log to stderr, copy the original to the output dir, set `success=False` on the result, and continue processing the next image. Exit with code 1 if any image failed.  
  _Outcome_: Running the script on a batch of 5 images where one is corrupt completes all 5 (4 cleaned, 1 copied original), prints a warning for the corrupt file, and exits with code 1.  
  _Dependencies_: T-07

### Phase 3 — Polish & Edge Cases

- [ ] **T-09** Add optional LaMa AI inpainting engine  
  _What_: Add a conditional import of `lama_cleaner`. When `--engine lama` is used, convert the image and mask to the format expected by LaMa, run inference, and convert the result back to BGR. Print a helpful error if `lama-cleaner` is not installed.  
  _Outcome_: Running with `--engine lama` on the test image produces a visually smoother result than TELEA. Script prints `"lama-cleaner not installed. Run: pip install lama-cleaner"` and exits with code 2 if the package is missing.  
  _Dependencies_: T-05

- [ ] **T-10** Add FFT-based detection strategy for tiled repeating watermarks  
  _What_: Implement an alternative detection path using `numpy.fft.fft2` to identify periodic patterns in the frequency domain. Expose via a `--strategy fft` flag. Convert detected frequency peaks back to a spatial mask.  
  _Outcome_: When tested on a synthetic image with a repeating text watermark, the FFT strategy produces a more complete mask than the threshold strategy. Document when to use each strategy in the README.  
  _Dependencies_: T-03

- [ ] **T-11** Write unit tests for core functions  
  _What_: Use `pytest` with synthetic test images (generated by numpy — solid colour with a grey rectangle simulating a watermark). Test `load_image`, `detect_watermark`, `refine_mask`, and `inpaint_image` independently.  
  _Outcome_: `pytest` passes all tests with no failures. Coverage report shows ≥ 80% line coverage on `remove_watermark.py`.  
  _Dependencies_: T-08

- [ ] **T-12** Add `--verbose` progress output and final summary  
  _What_: In verbose mode, print a per-image line with index, filename, engine used, and elapsed seconds. After the batch, print a summary: `"Processed 20 images: 19 cleaned, 1 failed."`.  
  _Outcome_: Running with `--verbose` on a 5-image batch produces exactly 5 progress lines and a summary line. Running without the flag produces no stdout output.  
  _Dependencies_: T-08

---

## 8. Edge Cases & Error Handling

| Scenario                                                     | Expected Behaviour                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Input file does not exist                                    | Exit code 2, print `"Error: file not found: <path>"` to stderr                     |
| Input file is not a valid image (e.g. a PDF renamed to .png) | Skip file with warning, copy original to output, continue batch                    |
| No watermark detected (mask is entirely black)               | Log a warning `"No watermark detected in <file>, skipping inpaint"`, save original |
| Output directory is not writable                             | Exit code 1 immediately with a permissions error message                           |
| Image is very small (< 50×50 px)                             | Proceed normally; inpaint radius auto-clamped to image shortest dimension / 10     |
| `--engine lama` requested but package not installed          | Exit code 2 with install instructions before processing any files                  |
| Watermark covers > 60% of the image                          | Log a warning that quality may be poor; proceed with inpainting                    |
| Greyscale image input (single channel)                       | Convert to BGR before processing, convert back to greyscale before saving          |

---

## 9. Testing Plan

| Test Type   | What to Cover                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `load_image` with valid/invalid inputs; `detect_watermark` threshold logic; `refine_mask` kernel sizes; mask pixel count on synthetic images   |
| Integration | Full pipeline on the reference pharmacy PNG: verify output file exists, is valid, and mask covered the watermark region                        |
| CLI         | Argument parsing: `--help`, missing input, bad `--engine` value, `--dry-run` writes mask overlay not cleaned image                             |
| Batch       | 5-image directory input: all files processed, failed file exits code 1, output dir has correct number of files                                 |
| Manual QA   | Visual inspection of cleaned reference image by a human; check for halo artefacts, blurring, or colour mismatches around the removed watermark |

---

## 10. Open Questions

- [ ] Should the tool support reading from stdin (piped image data) for use in shell pipelines?
- [ ] Is there a need to preserve EXIF metadata in the output images, or is pixel data sufficient?
- [ ] Should the `--preview` window support saving the result interactively (e.g. press `s` to save, `r` to reject)?
- [ ] Is LaMa the best AI backend, or should `IOPaint` (the maintained successor to lama-cleaner) be used instead?

---

## 11. Assumptions

- The user has Python 3.9+ and pip available in their environment.
- Input images are in JPEG or PNG format; other formats (WEBP, BMP) are supported but not the primary target.
- The watermark is a semi-transparent grey/white overlay — not a fully opaque solid-colour block.
- The user owns or has the rights to edit the images being processed.
- LaMa is an optional dependency; the core script must work without it using OpenCV only.
- Processing is done on CPU by default; CUDA acceleration for LaMa is a bonus, not a requirement.

---

## 12. References

- OpenCV inpainting docs: https://docs.opencv.org/4.x/df/d3d/tutorial_py_inpainting.html
- LaMa / IOPaint GitHub: https://github.com/Sanster/IOPaint
- `cv2.inRange` docs: https://docs.opencv.org/4.x/da/d97/tutorial_threshold_inRange.html
- Reference input image: pharmacy product image with circular `AL-ABD ELLATIF PHARMACY` watermark