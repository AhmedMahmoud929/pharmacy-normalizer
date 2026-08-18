# Real-time Drug Matcher — Frontend Specification

> **File:** `frontend/components/DrugMatcher.tsx`
> **Status:** Specification / Pre-implementation
> **Target Path:** `/dashboard/matcher`

---

## 1. Overview

The **Real-time Drug Matcher** is a high-performance dashboard component that allows users to upload Excel or CSV pharmacy sheets and match their product names against the canonical reference database in real-time. 

Unlike traditional file processors, this component uses **Streaming POST** to display matching results row-by-row as they arrive from the backend, providing instant feedback for "huge" datasets.

---

## 2. User Workflow

### 2.1 File Selection
- **UI**: A premium drag-and-drop upload zone with glassmorphism effects.
- **Action**: User selects or drops an `.xlsx`, `.xls`, or `.csv` file.
- **Validation**: Check file type and size.

### 2.2 Column Mapping (The "Discovery" Phase)
- **Automatic Detection**: The component sends the file metadata to a lightweight probe endpoint or parses the first few rows locally (using `sheetjs`) to detect potential name columns.
- **Manual Selection**: If multiple candidates are found or auto-detection fails, a clean dropdown allows the user to select the correct `Product Name` column.
- **Threshold Config**: Subtle sliders to adjust `Match Threshold` (default 85%) and `Review Threshold` (default 50%).

### 2.3 The Matching Process (Streaming)
- **Action**: User clicks "Start Matching".
- **Communication**: The frontend initiates a `fetch` request to `POST /match/sheet`.
- **Real-time Stream**: 
    - The response body is read as a `ReadableStream`.
    - `TextDecoder` and a line-based parser handle incoming `data:` chunks.
- **UI Feedback**: 
    - A smooth, animated progress bar (e.g., using Framer Motion).
    - A "Live Feed" area showing the last 5 matched items in a scrolling ticker.

### 2.4 Results Visualization
- **Data Table**: A high-density table that populates in real-time.
- **Status Pills**:
    - `Matched` (Green): High confidence match.
    - `Review` (Yellow): Needs human verification.
    - `No Match` (Red): No suitable candidate found.
- **Interactive Rows**: Clicking a row opens a "Comparison Panel" showing the original name vs. the top-3 candidates with their scores and attributes.

---

## 3. Technical Implementation

### 3.1 Streaming Parser
The core logic for handling the SSE stream from a POST request:

```typescript
const response = await fetch(`${API_URL}/match/sheet`, { method: 'POST', body: formData });
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });
  const lines = chunk.split('\n');
  
  lines.forEach(line => {
    if (line.startsWith('data: ')) {
      const payload = JSON.parse(line.slice(6));
      processPayload(payload); // Update state
    }
  });
}
```

### 3.2 State Management
- `isProcessing`: Boolean for UI locking.
- `progress`: `{ current: number, total: number }`.
- `results`: `Array<MatchResult>` — The primary data store for the table.
- `selectedColumn`: String identifier for the target column.

---

## 4. Design Aesthetics (Premium UI)

- **Colors**: Deep slate backgrounds with vibrant emerald (`#10b981`) for matches and amber (`#f59e0b`) for reviews.
- **Typography**: Inter or Outfit for clean readability.
- **Animations**:
    - Staggered entry for new table rows.
    - Pulsing glow effect on the progress bar during active streaming.
- **Micro-interactions**: Hovering over a `match_score` shows a tooltip with the Jaccard/SequenceMatcher breakdown.

---

## 5. Performance Considerations

- **Virtual Scrolling**: For sheets > 1000 rows, use `react-window` or `tanstack-virtual` to keep the DOM performant while streaming.
- **Batch State Updates**: Throttle UI updates to once every 100ms during high-speed streaming to avoid React rendering bottlenecks.
- **Memory Management**: Provide a "Clear Results" button to purge the local state after large operations.

---

## 6. Success Metrics
- **Instant Start**: Results should start appearing within < 500ms of the request start.
- **Reliability**: Handle network interruptions gracefully (show "Resume" or "Partial Success" state).
- **Accuracy**: User should be able to verify and export the final matched sheet (either via the backend generated file or a local CSV export).
