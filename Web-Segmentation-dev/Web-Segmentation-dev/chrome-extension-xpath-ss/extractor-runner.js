/*
Objective                           -   Entry point to automatic scrolling and element capture
    ElementExtractor Availablility  -   Check if extractor.js was injected successfully 
*/

// -------------------- Entry point to automatic scrolling and element capture --------------------------
(function () {
    if (typeof window.ElementExtractor === "function") { //checks if extractor.js is injected successfully
      const extractor = new window.ElementExtractor();  // Instantiate the extractor class
      window.extractor = extractor;
      extractor.startAutoScrollCapture(200, 500, false);        // Begin auto-scroll + DOM snapshot capture
      //extractor.run();
      console.log("[extractor-runner.js] Auto scroll + capture started");
      document.addEventListener("click", () => {
        console.log("[extractor-runner] Click detected → re-running scroll + capture"); // On user interaction like click, restart capture with reset=true
        extractor.startAutoScrollCapture(200, 500, true); 
      }, { once: true });
      
    } else {
      console.warn("[extractor-runner.js] ElementExtractor not found");
    }
  })();
  
