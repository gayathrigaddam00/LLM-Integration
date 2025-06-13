/*
Objective                        -   Listen for extension events, capture screenshots of current tab, and send the screenshot along with web element data to a Django backend API
    onInstalledListener          -   Log when the extension is installed
    onMessageListener            -   Listen for messages from content/popup scripts
    captureVisibleTabScreenshot  -   Capture a PNG screenshot of the visible viewport
    validateElementsArray        -   Ensure `message.elements` is present and is an array
    sendDataToBackend            -   POST the screenshot and element data to the Django API
*/

console.log("Background.js is loaded!");
// -------------------------------- Global variable Declarations --------------------------------
const BACKEND_URL = "http://127.0.0.1:8000/api/extract/";   // Django API endpoint for uploading data

// ---------------------------------- Chrome Extension Installation -----------------------------------
chrome.runtime.onInstalled.addListener(() => {
    console.log("Silent Web Automation Extension Installed.");
});

// ------------------------------- Message Listener & Handler -> Listens to messages from other parts of the extension  ---------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received message in background.js:", message);

    if (message.action === "capture_screenshot") {
        console.log("Capturing viewport screenshot...");
        // ---------------------- captures the view port as a png ------------------------------
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (screenshotUrl) => {
            if (chrome.runtime.lastError) {
                console.error("Error capturing screenshot:", chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }

            console.log("Screenshot Captured");
            // ---------------- Validates that message.elements is a valid array ----------------------
            if (!message.elements || !Array.isArray(message.elements)) {
                console.error("elements is missing or not an array:", message.elements);
                sendResponse({ success: false, error: "Invalid elements data" });
                return;
            }

            // --------------- Prepare payload for the backend -----------------------------------------
            let requestData = {
                website: message.website,
                screenshot: screenshotUrl,
                elements: message.elements
            };

            console.log("Sending Data to Backend:", requestData);
            console.log("[background.js] Final requestData", requestData);
            console.log("Final payload to backend:", JSON.stringify(requestData, null, 2));

            // ----------------- POST request to Django API ---------------------------------------
            fetch(BACKEND_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(JSON.stringify(err)) });
                }
                return response.json();
            })
            .then(data => {
                console.log("Screenshot & XPaths uploaded successfully:", data);
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.error("Error uploading data:", error);
                sendResponse({ success: false, error: error.message });
            });
        });

        return true;
    } else {
        console.warn("Unknown message received:", message);
        sendResponse({ success: false, error: "Unknown action" });
    }
});

