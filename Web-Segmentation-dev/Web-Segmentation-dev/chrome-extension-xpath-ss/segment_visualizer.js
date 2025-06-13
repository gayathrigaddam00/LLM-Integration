/*
Objective                    -   Visualize segmentation and missing elements by coloring DOM overlays
    getWebsiteName           -   Extract the base domain name for CSV lookup
    getRandomColor           -   Generate a random hex color string
    loadCSV                  -   Fetch the appropriate CSV (structure/visual/missing) and parse IDs
    updateBoundingBoxColors  -   Apply or remove colored outlines based on parsed IDs and mode
    handleKeyShortcuts       -   Listen for Ctrl+Shift+<key> to switch visualization modes
*/

// --------------------------------- SegmentVisualizer Class ---------------------------------
class SegmentVisualizer {
    constructor() {
      this.CSV_FOLDER = "csv/";
      this.segmentColors = new Map();
      this.currentMode = "structure";
      // ---------- Register keyboard shortcuts for mode switching ---------------------------
      document.addEventListener("keydown", this.handleKeyShortcuts.bind(this));
    }

    // ------------------------- Extract base domain for CSV filename -------------------------
    getWebsiteName() {
      const hostname = window.location.hostname;
      return hostname.replace("www.", "").split(".")[0].toLowerCase();  // Remove 'www.' prefix and take the first part of the domain name
    }

    // ------------------------- Generate a random hexadecimal color -------------------------
    getRandomColor() {
      return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;  // Random integer -> hex string, padded to 6 digits
    }

    // ------------------------- Load and parse the CSV for the given mode -------------------------
    async loadCSV(mode) {
      this.currentMode = mode;
      const filePath = chrome.runtime.getURL(`${this.CSV_FOLDER}${this.getWebsiteName()}_${mode}.csv`);
  
      try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`CSV file not found: ${filePath}`);
  
        const text = await response.text();
        const rows = text.split("\n").map(row => row.trim()).filter(Boolean);
        const newIds = new Set();
        const elementColors = new Map();
  
        if (mode === "missing") {
          for (const row of rows) {
            const id = row.split(",")[0].trim();
            if (id) {
              newIds.add(id);
              elementColors.set(id, this.getRandomColor());
            }
          }
          this.updateBoundingBoxColors(newIds, true, elementColors); //to apply outlines to matched DOM elements
        } else {
          for (const row of rows) {
            const [id, segment] = row.split(",").map(x => x.trim());
            if (id && segment) {
              this.segmentColors.set(id, segment);
              newIds.add(id);
            }
          }
          this.updateBoundingBoxColors(newIds, false);
        }
      } catch (err) {
        console.error("CSV loading failed:", err);
      }
    }
    
    // ------------------------- Apply or remove colored outlines on DOM labels -------------------------
    updateBoundingBoxColors(validIds, isMissingMode, elementColors = null) {
      const labels = window.__extractor__?.labels;     // Map<id, DOMElement> from extractor
      if (!labels) return;
  
      const segmentToColor = new Map();                // Map<segment, color>
      const elementSegments = new Map();               // Map<id, segment>
  
      if (!isMissingMode) {
        validIds.forEach(id => {
           // -------------- Build mappings for colored segments ------------------------
          const segment = this.segmentColors.get(id);
          if (segment) elementSegments.set(id, segment);
        });
        // --------------- Assign a random color per segment ----------------------------
        new Set(elementSegments.values()).forEach(segment => {
          if (!segmentToColor.has(segment)) {
            segmentToColor.set(segment, this.getRandomColor());
          }
        });
      }

      // ------------------ Iterate all existing bounding-box labels --------------------------------
      labels.forEach((label, id) => {
        if (validIds.has(id)) {
          const newColor = isMissingMode
            ? elementColors.get(id)
            : segmentToColor.get(elementSegments.get(id)) || "black";
  
          label.style.outline = `2px dashed ${newColor}`;
          const tag = label.querySelector(".element-label");
          if (tag) tag.style.background = newColor;
        } else {
          label.remove();
          labels.delete(id);
        }
      });
    }

    // ------------------------- Keyboard shortcuts handler -------------------------
    async handleKeyShortcuts(event) {
      if (!event.ctrlKey || !event.shiftKey) return;
  
      const modeMap = {
        KeyS: "structure",
        KeyV: "visual",
        KeyP: "both",
        KeyM: "missing"
      };
  
      const mode = modeMap[event.code];
      if (mode) {
        console.log(`[Shortcut] Ctrl+Shift+${event.code.slice(3)} → ${mode}`);
        await this.loadCSV(mode);
      }
    }
  }
  
  window.SegmentVisualizer = SegmentVisualizer;
  new SegmentVisualizer();
  
