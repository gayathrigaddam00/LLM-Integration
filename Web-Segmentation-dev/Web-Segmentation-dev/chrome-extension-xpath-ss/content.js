/*
Objective             -   Dynamically inject extension scripts into page context and relay messages
    injectScript      -   This function dynamically inject a JavaScript file from the extension into the webpage's main JavaScript execution context
    bootstrapping     -   Sequentially inject html2canvas, extractor, and visualizer libraries
    extractorRunner   -   Inject and run the main extractor logic once page has fully loaded
    messageBridge     -   Listen for data from injected scripts and forward to background.js
*/

// --------------------------------- Helper: Inject a JS file ---------------------------------
function injectScript(fileName) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL(fileName);  // Resolve extension-local URL
      script.type = "text/javascript";
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = reject;
      (document.head || document.documentElement).appendChild(script);
    });
  }

// ----------------------------- Load Required Scripts -----------------------------
  (async () => {
    try {
      await injectScript("html2canvas.min.js");        // Canvas library for screenshot generation
      await injectScript("extractor.js");              // Core DOM-extraction logic
      await injectScript("segment_visualizer.js");     // UI overlay for showing segments
  
      // ------------- Runs extractor after everything is injected -----------------
      // --------- Once all dependencies are in place, wait for full page load before running extractor ------------
      window.addEventListener("load", async () => {
        console.log("Page loaded, injecting extractor-runner.js");
        await injectScript("extractor-runner.js");
      });
  
    } catch (err) {
      console.error("content.js failed:", err);
    }
  })();
  
  // -------------------------- Forward Messages to Background script--------------------------
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "extractor-extension") return;
  
    console.log("[content.js] Received from extractor:", event.data);

    // ------------- Relay the action, element list, and website info to background.js ---------
    chrome.runtime.sendMessage({
      action: event.data.action,
      elements: event.data.elements,
      website: event.data.website
    }, response => {
      console.log("[content.js] Response from background:", response);
    });
  });
  
  
