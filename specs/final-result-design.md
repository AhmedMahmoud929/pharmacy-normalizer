# Final Result Design Specification

## 1. Overview
This specification defines the "Finished" state of the Drug Matcher, which occurs after a streaming session completes. The goal is to provide a clean, data-centric view for reviewing and exporting results.

## 2. UI/UX Changes

### 2.1 Post-Matching Layout
- **Full Screen Mode**: Once matching is finished, the left configuration panel and the live ticker are hidden.
- **Centerpiece**: The **Matching Results Table** expands to take up the full width of the container (`lg:col-span-3` or equivalent).

### 2.2 Stats Summary (New)
- **Visual Overview**: Add a row of cards above the table showing:
    - **Total Items**: Total rows processed.
    - **Matched**: Count of high-confidence matches (Green).
    - **Needs Review**: Count of partial matches (Amber).
    - **No Match**: Count of failed matches (Red).
- **Match Accuracy**: A percentage showing the overall success rate.

### 2.3 Action Controls
- **New Match Button**: A button to reset the state and return to the "Upload" view.
- **Export Results**: (Future) Button to download the matched file.

## 3. Technical Implementation
- **State**: Add a `isComplete` boolean state.
- **Transition**: When the SSE stream sends the `complete` event, set `isComplete` to true.
- **Conditional Rendering**: Use `isComplete` to toggle visibility of the config panel, ticker, and to adjust grid column spans.
