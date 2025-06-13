# Chrome Extension for Web Segmentation 

This Chrome extension enables to automatically scroll any webpage when triggered, capture and analyze DOM element data and screenshots, facilitating web segmentation and changes detection.

## Features

- **Web Element Data Extraction**: Collects detailed information about DOM elements, including their XPaths and associated metadata.
- **Screenshot Capture**: Takes full-page or view port screenshots for visual reference.
- **Change Detection**: Compares current and previous data to identify modifications in the web page structure.
- **Data Storage**: Saves collected data and screenshots in organized directories for easy access and analysis.

## Chrome Extension
```text
chrome-extension-xpath-ss/
├── manifest.json
├── background.js
├── content.js
├── html2canvas.min.js
├── extractor.js
├── extractor-runner.js
├── segment_visualizer.js
└── styles.css
```

- **manifest.json**  
  Declares the extension’s metadata, permissions, background service worker, content scripts, keyboard commands, and web-accessible resources.

- **background.js**  
  Listens for messages from the content script or popup, captures the visible tab screenshot, validates and bundles element data, then POSTs everything to the Django backend.

- **content.js**  
  Dynamically injects the required libraries (`html2canvas`, `extractor.js`, `segment_visualizer.js`, `extractor-runner.js`), then forwards extracted element batches from the page context to `background.js`.

- **html2canvas.min.js**  
  Third-party library that draws the current viewport into a canvas and exports it as a Base64-encoded PNG.

- **extractor.js**  
  Defines the `ElementExtractor` class which auto-scrolls the page, snapshots the DOM, detects changed elements, draws bounding boxes, and posts each batch (elements + screenshot) to the extension’s messaging layer.

- **extractor-runner.js**  
  Entry point that instantiates `ElementExtractor` on page load, starts the auto-scroll capture, and re-triggers capture on the first user click.

- **segment_visualizer.js**  
  Implements `SegmentVisualizer`, loading segmentation or “missing elements” CSVs on Ctrl+Shift shortcuts and recoloring or removing existing DOM overlays accordingly.

## web_extractor

A Django REST Framework package that exposes an endpoint to receive “scroll batch” payloads, save raw/cleaned DOM snapshots, compare against previous snapshots, and store any modifications as CSV files.

```text
web_extractor/
├── outputs/
     ├── website_scroll0
            ├── screenshot_0.png
            ├── xpath_0.csv
├── manage.py
├── extractor/
     ├── __init__.py
     ├── views.py
     ├── urls.py
```
- **views.py**  
   Implements ExtractDataView which handles POST requests containing:
   - A scroll_index and array of element records.
   - Optionally a base64-encoded screenshot.
   - On the first batch, saves “uncleaned”, “cleaned”, and “xpath-only” CSVs.
   - On subsequent batches, compare against the last snapshot, flags modified rows, writes a timestamped “modified_*.csv”, and returns file paths in the JSON response.
- **manage.py**  
  A command‐line utility that serves as the entry point for Django. It sets the `DJANGO_SETTINGS_MODULE`, exposes administrative tasks (e.g. `runserver`, `migrate`, `createsuperuser`, `startapp`), and bootstraps the Django environment to manage the project from the terminal.

## Execution

1. **Load the Extension in Chrome**:

- Open Chrome and navigate to `chrome://extensions/`.
- Enable **Developer mode** (toggle in the top right).
- Click on **Load unpacked**.
- Select the `chrome-extension-xpath-ss` directory.

2. **Capture Element Data**:
   Run "python manage.py runserver" in the terminal.
   Navigate to the desired web page. Use the extension to select elements and capture their data and screenshots.

3. **Analyze Changes**:
   The extension compares the current data with previously stored data to detect any changes in the web page structure.

4. **Access Stored Data**:
   Captured data and screenshots are stored in the `Outputs/` directory, organized by website name and scroll index for easy reference.


## Few-Shot examples Drive Link: https://drive.google.com/drive/u/1/folders/1AJoQ_BjFXpfTjUPjnW1iETcIW9vKM-yb
