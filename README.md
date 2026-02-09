# Web Segmentation & Extraction for LLM Integration

A specialized toolkit designed to parse, segment, and extract semantic structures from web pages. This project combines **Chrome Extensions** with a **Django Backend** to generate high-quality datasets (Screenshots, XPaths, and Bounding Boxes) essential for training or grounding **Multimodal LLM Agents**.

---

## 🚀 Key Features

* **Intelligent Web Segmentation:** Breaks down complex web pages (e.g., Amazon, YouTube) into semantic blocks or "segments" rather than just raw HTML.
* **Data Extraction Engine:**
    * **Visual:** Captures high-resolution screenshots of individual DOM elements and segments.
    * **Structural:** Extracts precise **XPaths**, CSS selectors, and computed styles.
    * **Metadata:** Generates CSV reports mapping visual elements to their code counterparts.
* **Chrome Extensions:** Includes custom browser extensions to inject extraction scripts, visualize bounding boxes, and communicate with the backend.
* **Dataset Generation:** Automatically organizes outputs into structured folders (e.g., `Outputs/amazon_com/scroll_0/`) containing the raw image, segmented image, and CSV data.

---

## 🛠️ System Architecture

The system operates on a client-server model:

1.  **The "Eye" (Chrome Extension):**
    * Injects content scripts (`content.js`) into the target webpage.
    * Identifies interactive elements and structural blocks.
    * Captures the visible viewport and sends coordinate/DOM data to the server.
    * *Variants included:* `chrome-extension-xpath-ss`, `chrome-extension-bb` (Bounding Box), `sel-extension`.

2.  **The "Brain" (Django Backend):**
    * Receives payload data from the extension.
    * **Image Processing:** Slices the full-page screenshot into smaller segment images based on coordinates.
    * **Data Cleaning:** Processes raw DOM data into clean CSVs (`cleaned_amazon_com.csv`).
    * **Storage:** Saves structured datasets for LLM consumption.

---

## 🧠 System Functionality & Design

### 1. The Extraction Pipeline
The system follows a strict **"Observe-Extract-Process"** pipeline to convert raw web pages into structured datasets for LLMs.

1.  **DOM Traversal (Client-Side):**
    * The Chrome Extension executes a recursive content script that traverses the Document Object Model (DOM).
    * It filters for **semantic elements** (buttons, inputs, text blocks) and ignores hidden or irrelevant nodes (like script tags).
    * **XPath Generation:** For every valid element, the script calculates a unique, robust XPath (e.g., `/html/body/div[2]/button[1]`).

2.  **Visual Mapping & Capture:**
    * **Bounding Box Calculation:** The extension uses `getBoundingClientRect()` to determine the exact `(x, y, width, height)` pixel coordinates of every element relative to the viewport.
    * **Screenshotting:** It captures a high-resolution screenshot of the current viewport or full page (handling scrolling automatically).

3.  **Server-Side Processing (Django):**
    * **Data Ingestion:** The backend receives a JSON payload containing the Base64 image and the list of element metadata.
    * **Intelligent Segmentation:** Using Python's `Pillow` library, the server uses the received coordinates to **crop** specific regions from the master screenshot. This creates individual image files for every interactive element on the page.
    * **Dataset Compilation:** It links the *Visual Representation* (the cropped image) with the *Structural Data* (XPath, Attributes) and saves them as a unified CSV dataset.

### 2. Segmentation Strategy
Unlike standard scrapers that just pull text, this tool creates a **Visual-Structural Map**:
* **Segmented Images:** Stores strictly cropped images of UI elements (e.g., just the "Add to Cart" button).
* **Contextual Images:** Stores "annotated" versions of the full page where bounding boxes are drawn over elements to visualize what the computer "sees."
* **Coordinate Grounding:** The generated CSV includes strict bounding box coordinates, allowing Multimodal LLMs to understand *where* an element is located on the screen.

### 3. Output Data Structure
The system automatically organizes data to prevent overwriting and ensure traceability.
* **Hierarchy:** `Outputs/ <Domain> / <Scroll_Session_ID> /`
* **Artifacts:**
    * `screenshot_raw.png`: The clean original view.
    * `screenshot_annotated.png`: Visualization of the detected segments.
    * `segments/`: A folder containing hundreds of small cropped images.
    * `dataset.csv`: The master file mapping `image_filename` ↔ `xpath` ↔ `text_content`.

---

## 💻 Tech Stack

* **Backend:** Python 3.12, Django (Web Framework)
* **Frontend / Browser:** JavaScript, Chrome Extension API (Manifest V3)
* **Image Processing:** HTML2Canvas, Pillow (Python Imaging Library)
* **Database:** SQLite (Default)
* **Data Formats:** JSON, CSV, PNG

---

## 🚀 Getting Started

### Prerequisites
* Python 3.12+
* Google Chrome (for the extension)

### 1. Backend Setup (Django)

Navigate to the `web_extractor` directory:

```bash
cd web_extractor

# Install dependencies (ensure you have django and pillow installed)
pip install django pillow

# Run migrations
python manage.py migrate

# Start the server
python manage.py runserver

```

*The server will typically run on `http://127.0.0.1:8000/*`

### 2. Chrome Extension Setup

1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked**.
4. Select one of the extension folders (Recommended: `chrome-extension-xpath-ss` or `chrome-extension-bb-all`).

---

## 🏃‍♂️ Usage Workflow

1. **Start the Server:** Ensure the Django backend is running.
2. **Navigate to Target:** Open a website (e.g., Amazon.com) in Chrome.
3. **Activate Extension:** Click the extension icon to trigger the extraction script.
4. **Process:** The extension will scroll, capture, and send data to the backend.
5. **View Results:** Check the `web_extractor/Outputs/` directory. You will see organized folders:

```text
Outputs/
├── amazon_com/
│   ├── scroll_0/
│   │   ├── amazon_com_0.png          # Full screenshot
│   │   ├── amazon_com_modified_0.png # Segmented visualization
│   │   ├── xpath_amazon_com_0.csv    # XPath & DOM data
│   │   └── cleaned_amazon_com_0.csv  # Processed dataset

```

---

## 📂 Project Structure

```bash
├── web_extractor/              # Django Backend
│   ├── extractor/              # Main App Logic (Views, Models)
│   ├── Outputs/                # Generated Datasets
│   ├── manage.py
│   └── web_extractor/          # Settings & Config
├── chrome-extension-xpath-ss/  # Extension for XPath & Screenshot
├── chrome-extension-bb-all/    # Extension for Bounding Boxes
└── finding_intersction...py    # Standalone analysis scripts

```

---

## 🔮 Use Cases

* **LLM Grounding:** Providing "vision" to text-only LLMs by mapping images to XPaths.
* **UI Testing:** Automated regression testing of visual elements.
* **Web Agents:** Helping AI agents understand "what is clickable" on a page.

```

```
