console.log("Background script is running");

// ✅ Extract elements when clicking the extension icon
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.url.startsWith("http")) {
        console.error("Invalid tab URL.");
        return;
    }

    console.log(`Processing tab: ${tab.url}`);

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"], // Inject content.js first
    });
});

// ✅ Draw bounding boxes when pressing `Ctrl+Shift+X`
chrome.commands.onCommand.addListener((command) => {
    if (command === "draw_bounding_boxes") {
        console.log("Inside draw bounding boxes");

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;
            console.log("Bounding boxes triggered");

            const url = new URL(tabs[0].url);
            const domain = url.hostname.toLowerCase();

            let csvFile = null;
            if (domain.includes("macys")) {
                csvFile = "csv/Macys-segmented-structural.csv";
            } else if (domain.includes("google")) {
                csvFile = "csv/Google-segmented-structural.csv";
            } else {
                console.warn("No CSV file available for this website.");
                return;
            }

            console.log(`Loading CSV: ${csvFile}`);

            // ✅ Inject `content.js` before executing function
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["content.js"]
            }, () => {
                // ✅ Execute `loadCSVAndDrawBoundingBoxes` from `content.js`
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    args: [csvFile],
                    func: (csvFile) => {
                        window.loadCSVAndDrawBoundingBoxes(csvFile);
                    }
                });
            });
        });
    }
});

