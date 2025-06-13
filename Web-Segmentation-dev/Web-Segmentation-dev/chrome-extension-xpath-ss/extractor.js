/*
Objective                         -   Automatically scroll through the page, capture DOM snapshots, detect element changes, overlay bounding boxes, and send 
                                     structured element data + screenshots to a backend API.
    constructor                   -   Initialize state, ID maps, and bind handlers
    captureDomSnapshot            -   Take a snapshot of all current DOM elements’ outerHTML
    getChangedElements            -   Compare two snapshots and list changed elements
    handleUserInteraction         -   Throttle and recapture when the user interacts
    recaptureChangedIndices       -   Reprocess scroll indices where changes occurred
    trackScrollIndexOnUserInteraction -   Listen for various user events to recapture at that scroll index
    generateUniqueId              -   Produce a new unique numeric ID
    getXPath                      -   Compute an XPath for a given element
    isVisible                     -   Check if an element is visible in the viewport
    getElementText                -   Extract meaningful text or placeholder from an element
    clearBoundingBoxes            -   Remove all drawn overlays
    drawBoundingBox               -   Create and position a dashed-outline box + label for an element
    markPage                      -   Gather target elements, filter by area/text, assign IDs, compute diffs, and draw boxes
    captureData                   -   Invoke markPage, wait, then post data to background script
    run                           -   Set up initial capture, event hooks, and scroll listeners
    startAutoScrollCapture        -   Perform recursive smooth scrolling + capture, diff timing, summary, then hand off to user-interaction tracker
*/

// ------------------------------ Class Definition ----------------------------------
class ElementExtractor {
  constructor(minArea = 20) {
    this.MIN_AREA = minArea;                      // Minimum element area to consider
    this.labels = new Map();                      // Map from element ID -> overlay DOM node
    this.elementIdMap = new WeakMap();            // WeakMap from DOM element → generated unique ID
    this.usedIds = new Set();                     // Track used numeric IDs
    this.changedScrollIndices = new Set();        // Scroll indices with detected changes
    this.extractedData = [];                      // Array of extracted element data for the current scroll
    this.currentId = 1;                           // Counter for generating unique IDs
    this.handleUserInteraction = this.handleUserInteraction.bind(this);
    this.lastUserCaptureTime = 0;
    this.previousElementCounts = new Map();       // Track previous element counts by scroll index
    this.captureData = this.captureData.bind(this);
    this.markPage = this.markPage.bind(this);
    this.clearBoundingBoxes = this.clearBoundingBoxes.bind(this);
    this.totalChangedElements = 0;
    this.totalComparisonTime = 0
  }

  // ------------- Capture a snapshot mapping each element → its outerHTML ---------------
  captureDomSnapshot = () => {
    const map = new Map();
    document.querySelectorAll("*").forEach((el) => {
      if (!el.closest(".bounding-box")) {
        map.set(el, el.outerHTML);
      }
    });
    return map;
  };

  // ------------ Compare 'before' and 'after' snapshots, return list of changed elements -----------
  getChangedElements = (before, after) => {
    const changed = [];
    for (const [el, html] of after.entries()) {
      if (before.get(el) !== html) {
        changed.push(el);
      }
    }
    return changed;
  };

  // ----------- On user events (click, input, etc.), throttle and recapture at current scroll index ---------
  handleUserInteraction = async (event) => {
    const now = Date.now();
    if (now - this.lastUserCaptureTime < 1000) return;
    this.lastUserCaptureTime = now;
  
    const scrollIndex = Math.floor(window.scrollY / window.innerHeight);
    const y = scrollIndex * window.innerHeight;
  
    console.log(`[UserAction] ${event.type} → Scroll index: ${scrollIndex}`);
    console.log(`Scrolling to scrollIndex ${scrollIndex} (Y = ${y})`);
  
    window.scrollTo(0, y);
    await new Promise(resolve => setTimeout(resolve, 1200));
    await this.captureData();
  
    console.log(`Recaptured scrollIndex ${scrollIndex} after ${event.type}`);
  };

  // ----------- Re-run capture for any scroll indices recorded as changed -----------------------
  async recaptureChangedIndices() {
    console.log("Reprocessing these scroll indices:", Array.from(this.changedScrollIndices));

    for (const scrollIndex of this.changedScrollIndices) {
      const y = scrollIndex * window.innerHeight;
      console.log(`Scrolling to scrollIndex ${scrollIndex} (Y = ${y})`);
      window.scrollTo(0, y);

      await new Promise(resolve => setTimeout(resolve, 1200));
      const before = this.extractedData.length;
      await this.captureData();
      const after = this.extractedData.length;
      console.log(`ScrollIndex ${scrollIndex}: elements before = ${before}, after = ${after}`);
    }

    console.log("Done reprocessing. Clearing changed scroll indices.");
    this.changedScrollIndices.clear();
  }

  // ------------ Attach handlers to capture on various user interactions ------------------------
  trackScrollIndexOnUserInteraction = () => {
    console.log("Waiting for user interaction...");
    const handler = async (event) => {
      const scrollIndex = Math.floor(window.scrollY / window.innerHeight);
      const y = scrollIndex * window.innerHeight;
  
      console.log(`[UserAction] ${event.type} → Scroll index: ${scrollIndex}`);
      console.log(`Scrolling to scrollIndex ${scrollIndex} (Y = ${y})`);
  
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 1200));
      await this.captureData();
  
      console.log(`Recaptured scrollIndex ${scrollIndex} after ${event.type}`);
    };
  
    ["click", "input", "keydown", "change", "focus", "touchstart"].forEach(evt =>
      document.addEventListener(evt, handler, true)
    );
  };
  
  // ------------ Generate a new unique numeric ID ----------------
  generateUniqueId() {
    let id = this.currentId;
    while (this.usedIds.has(id)) id++;
    this.usedIds.add(id);
    this.currentId = id + 1;
    return id;
  }

  // ---------- Get an XPath string for a given element -------------
  getXPath(element) {
    if (!element) return "";
    if (element.id) return `//*[@id="${element.id}"]`;

    let pathSegments = [];
    let currentElement = element;
    while (currentElement && currentElement !== document.documentElement) {
      if (currentElement.id) {
        return `//*[@id="${currentElement.id}"]${pathSegments.reverse().join("")}`;
      }

      const parent = currentElement.parentNode;
      if (!parent) break;

      let index = 1;
      const siblings = parent.childNodes;
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === currentElement) {
          pathSegments.push(`/${currentElement.tagName.toLowerCase()}[${index}]`);
          break;
        }
        if (sibling.nodeType === 1 && sibling.tagName === currentElement.tagName) index++;
      }
      currentElement = parent;
    }
    return pathSegments.reverse().join("");
  }
  
  // --------- Check if an element is visible in the viewport -------------
  isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  // ------------------ Extract meaningful text or placeholder from an element ---------------
  getElementText(element) {
    if (!element) return "";
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      return element.placeholder?.trim() || "";
    }
    if (element.tagName === "BUTTON" || element.tagName === "A") {
      return element.innerText.trim();
    }
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const ignoreTags = ["SCRIPT", "STYLE", "NOSCRIPT"];
    if (ignoreTags.includes(element.tagName)) return "";

    let text = "";
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent.trim() + " ";
      }
    }
    return text.trim() || "";
  }

  // ----------- Remove all drawn bounding-box overlays ------------
  clearBoundingBoxes() {
    this.labels.forEach(label => label.remove());
    this.labels.clear();
  }

  // ------------ Draw a dashed outline and label for a given item ------------
  drawBoundingBox(item) {
    [...item.element.getClientRects()].forEach(() => {
      let borderColor = `hsl(${parseInt(Math.random() * 360)}, 100%, 25%)`;

      let label = document.createElement("div");
      label.classList.add("bounding-box");
      label.style.position = "absolute";
      label.style.outline = `2px dashed ${borderColor}`;
      label.style.pointerEvents = "none";
      label.style.zIndex = "9999";

      function updateBoundingBoxPosition() {
        let rect = item.element.getBoundingClientRect();
        label.style.left = `${rect.left + window.scrollX}px`;
        label.style.top = `${rect.top + window.scrollY}px`;
        label.style.width = `${rect.width}px`;
        label.style.height = `${rect.height}px`;
      }

      updateBoundingBoxPosition();
      requestAnimationFrame(updateBoundingBoxPosition);

      let tag = document.createElement("span");
      tag.textContent = `${item.element.id}`;
      tag.classList.add("element-label");
      tag.style.position = "absolute";
      tag.style.background = borderColor;
      tag.style.color = "white";
      tag.style.padding = "2px";
      tag.style.fontSize = "12px";
      tag.style.borderRadius = "4px";
      tag.style.top = "-12px";
      tag.style.left = "0px";

      label.appendChild(tag);
      document.body.appendChild(label);
      this.labels.set(item.element.id, label);
    });
  }

  // ---------- Scan the page, filter relevant elements, assign IDs, compute diffs, and draw overlays ------------
  markPage() {
    console.log("Running markPage()");
    this.clearBoundingBoxes();
    // ------- Gather all the elements --------
    let elements = Array.from(document.querySelectorAll('*'));
    let items = elements.map(element => {
      // --------- Compute bounding rects fully containing the element ------------
      let rects = [...element.getClientRects()].filter(bb => {
        let centerX = bb.left + bb.width / 2;
        let centerY = bb.top + bb.height / 2;
        let elAtCenter = document.elementFromPoint(centerX, centerY);
        return elAtCenter === element || element.contains(elAtCenter);
      });
  
      let area = rects.reduce((acc, rect) => acc + rect.width * rect.height, 0);
  
      return {
        element,
        include:
          ['BUTTON', 'A', 'IMG', 'PICTURE', 'INPUT', 'TEXTAREA', 'SELECT', 'VIDEO', 'SVG', 'CANVAS',
           'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'DIV', 'MAP', 'AREA'].includes(element.tagName) ||
          element.onclick !== null ||
          element.hasAttribute('tabindex') ||
          window.getComputedStyle(element).cursor === "pointer" ||
          element.textContent.trim().length > 0,
        area,
        text: this.getElementText(element),
        xpath: this.getXPath(element)
      };
    }).filter(item => item.include && item.area >= this.MIN_AREA);
  
    items = items.filter(x =>
      !items.some(y => x.element.contains(y.element) && x !== y && x.element.tagName !== 'P')
    );
  
    const currentScrollIndex = Math.floor(window.scrollY / window.innerHeight);
    // ------ Assign IDs and scrollIndex -----------
    items.forEach(item => {
      if (!this.elementIdMap.has(item.element)) {
        let uniqueId = this.generateUniqueId();
        this.elementIdMap.set(item.element, uniqueId);
        item.element.id = uniqueId;
      } else {
        item.element.id = this.elementIdMap.get(item.element);
      }
      item.element.setAttribute("data-scroll-index", currentScrollIndex);
    });
  
    //Comparison logic
    if (!this.previousElementCounts) {
      this.previousElementCounts = new Map();
    }
  
    const previousCount = this.previousElementCounts.get(currentScrollIndex) || 0;
    const currentCount = items.length;
  
    if (previousCount !== 0) {
      const diff = currentCount - previousCount;  
      const changeText = diff === 0 ? "No change" : (diff > 0 ? `Increased by ${diff}` : `Decreased by ${Math.abs(diff)}`);
      console.log(`Scroll index ${currentScrollIndex} had ${previousCount} elements before.`);
      console.log(`Scroll index ${currentScrollIndex} has ${currentCount} elements now.`);
      console.log(`Change: ${diff > 0 ? '+' : ''}${diff} elements`);

      this.totalChangedElements += Math.abs(diff);
    } else {
      console.log(`First time seeing scroll index ${currentScrollIndex}, count = ${currentCount}`);
    }
  
    this.previousElementCounts.set(currentScrollIndex, currentCount);
  
    console.log("Assigning scrollIndex:", currentScrollIndex);
    // ------------ Prepare extractedData array --------------------
    this.extractedData = items.map(item => ({
      webElementId: item.element.id,
      xpath: item.xpath,
      text: item.text || "",
      scrollIndex: currentScrollIndex
    }));
  
    items.forEach(item => {
      if (item.xpath && item.element.id) this.drawBoundingBox(item);
    });
  
    console.log("Final extractedData length:", this.extractedData.length);
    console.log("Sample extractedData:", this.extractedData.slice(0, 3));
  }
  
  /*markPage() {
    console.log("Running markPage()");
    this.clearBoundingBoxes();
    let elements = Array.from(document.querySelectorAll('*'));

    let items = elements.map(element => {
      let rects = [...element.getClientRects()].filter(bb => {
        let centerX = bb.left + bb.width / 2;
        let centerY = bb.top + bb.height / 2;
        let elAtCenter = document.elementFromPoint(centerX, centerY);
        return elAtCenter === element || element.contains(elAtCenter);
      });

      let area = rects.reduce((acc, rect) => acc + rect.width * rect.height, 0);

      return {
        element,
        include:
          ['BUTTON', 'A', 'IMG', 'PICTURE', 'INPUT', 'TEXTAREA', 'SELECT', 'VIDEO', 'SVG', 'CANVAS',
            'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'DIV', 'MAP', 'AREA'].includes(element.tagName) ||
          element.onclick !== null ||
          element.hasAttribute('tabindex') ||
          window.getComputedStyle(element).cursor === "pointer" ||
          element.textContent.trim().length > 0,
        area,
        text: this.getElementText(element),
        xpath: this.getXPath(element)
      };
    }).filter(item => item.include && item.area >= this.MIN_AREA);

    items = items.filter(x =>
      !items.some(y => x.element.contains(y.element) && x !== y && x.element.tagName !== 'P')
    );

    const currentScrollIndex = Math.floor(window.scrollY / window.innerHeight);
    items.forEach(item => {
      if (!this.elementIdMap.has(item.element)) {
        let uniqueId = this.generateUniqueId();
        this.elementIdMap.set(item.element, uniqueId);
        item.element.id = uniqueId;
      } else {
        item.element.id = this.elementIdMap.get(item.element);
      }
      item.element.setAttribute("data-scroll-index", currentScrollIndex);
    });
    

    console.log("Assigning scrollIndex:", currentScrollIndex);
    this.extractedData = items.map(item => ({
      webElementId: item.element.id,
      xpath: item.xpath,
      text: item.text || "",
      scrollIndex: currentScrollIndex
    }));

    items.forEach(item => {
      if (item.xpath && item.element.id) this.drawBoundingBox(item);
    });

    console.log("Final extractedData length:", this.extractedData.length);
    console.log("Sample extractedData:", this.extractedData.slice(0, 3));
  }*/

  // -------- Call markPage, wait, then post data to background for screenshot+elements ----------
  async captureData() {
    console.log("Running captureData()");
    this.markPage();
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("Sending elements:", this.extractedData);

    const websiteName = window.location.hostname;

    window.postMessage({
      source: "extractor-extension",
      action: "capture_screenshot",
      elements: this.extractedData,
      website: websiteName
    }, "*");
  }

  // ------- capture, POST to backend, and hook up events for dynamic captures -----------
  async run() {
    console.log("[Extractor] run() reached");
    try {
      await this.captureData();
      console.log("captureData() safely called");

      const extractedData = window.__extractor__?.data || [];
      const screenshot = window.__extractor__?.screenshot || null;
      const website = window.location.hostname;

      const response = await fetch("http://127.0.0.1:8000/api/extract/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          elements: extractedData,
          screenshot: screenshot,
          website: website,
        }),
      });

      const result = await response.json();
      console.log("Server responded:", result);

    } catch (err) {
      console.error("Error during run():", err);
    }

    document.addEventListener("DOMContentLoaded", this.captureData);
    window.addEventListener("load", this.captureData);

    let scrollTimeout;
    window.addEventListener("scroll", () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(this.captureData, 500);
    });

    window.captureData = this.captureData;
    window.__extractor__ = {
      labels: this.labels,
      data: window.__extractor__?.data || [],
      screenshot: window.__extractor__?.screenshot || null
    };

    //Hook interaction listener
    ["click", "input", "keydown", "change", "focus", "touchstart"].forEach(evt =>
      document.addEventListener(evt, this.handleUserInteraction, true)
    ); 
  }

// ----------- Recursively auto-scroll + capture, diff detection, timing summary, then wait for user ------------
async startAutoScrollCapture(
  interval = 200,
  preCaptureDelay = 500,
  showSummary = false
) {
  const scrollStep = window.innerHeight;
  let lastScrollTop = -1;

  this.totalChangedElements = 0;
  this.totalComparisonTime = 0;
  const runStartTime = performance.now();

  console.log("Capturing initial viewport");
  let beforeSnapshot = this.captureDomSnapshot();
  await this.captureData();
  await new Promise(res => setTimeout(res, preCaptureDelay));

  const scrollAndCapture = async () => {
    const currentY = window.scrollY;
    if (currentY === lastScrollTop) {
      console.log("Reached bottom of the page, stopping scroll.");
      if (showSummary) {
        const runEndTime = performance.now();
        const totalRunTime = runEndTime - runStartTime;
        console.log(
          `Total changed elements: ${this.totalChangedElements}, ` +
          `total comparison time: ${this.totalComparisonTime.toFixed(1)} ms, ` +
          `Total run time (scroll + compare): ${totalRunTime.toFixed(1)} ms`
        );
      }
      console.log("Waiting for user interaction...");
      this.trackScrollIndexOnUserInteraction();
      return;
    }

    lastScrollTop = currentY;
    window.scrollBy({ top: scrollStep, behavior: "smooth" });
    await new Promise(res => setTimeout(res, interval));

    console.log(`Capturing after scrollY = ${window.scrollY}`);
    const afterSnapshot = this.captureDomSnapshot();
    const t0 = performance.now();
    const changedEls = this.getChangedElements(beforeSnapshot, afterSnapshot);
    const t1 = performance.now();

    const deltaTime = t1 - t0;    
    this.totalComparisonTime += deltaTime;

    await this.captureData();
    await new Promise(res => setTimeout(res, preCaptureDelay));

    beforeSnapshot = afterSnapshot;
    scrollAndCapture();
  };

  console.log("[extractor] Auto scroll + capture started");
  scrollAndCapture();
}
  
}

window.ElementExtractor = ElementExtractor;
