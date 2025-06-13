console.log("Background script is running");

// ✅ Inject `content.js` when clicking the extension icon
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.url.startsWith("http")) {
        console.error("Invalid tab URL.");
        return;
    }

    console.log(`Processing tab: ${tab.url}`);

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"], // Inject content.js
    });
});

// ✅ Handle keyboard shortcuts and load respective CSV file
chrome.commands.onCommand.addListener((command) => {
    console.log(`Command received: ${command}`);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;

        const tabId = tabs[0].id;
        const url = new URL(tabs[0].url);
        const domain = url.hostname.toLowerCase();

        let csvFile = null;

        // Determine which CSV file to load based on the shortcut
        switch (command) {
            case "extract_structure": // Ctrl+Shift+S
                csvFile = domain.includes("macys")
                    ? "csv/Macys-segmented-structural.csv"
                    : "csv/Segmented_Ebay_Data-structural.csv";
                break;

            case "extract_visual": // Ctrl+Shift+V
                csvFile = domain.includes("macys")
                    ? "csv/Macys-segmented-visual.csv"
                    : "csv/Google-segmented-visual.csv";
                break;

            case "extract_spatial": // Ctrl+Shift+P
                csvFile = domain.includes("macys")
                    ? "csv/Macys-segmented-spatial.csv"
                    : "csv/Google-segmented-spatial.csv";
                break;

            case "extract_texts": // Ctrl+Shift+T
                csvFile = domain.includes("macys")
                    ? "csv/Macys-segmented-texts.csv"
                    : "csv/Google-segmented-texts.csv";
                break;

            case "extract_all": // Ctrl+Shift+X
                csvFile = domain.includes("macys")
                    ? "csv/Macys-segmented-all.csv"
                    : "csv/Google-segmented-all.csv";
                break;

            default:
                console.warn("Unknown command:", command);
                return;
        }

        if (!csvFile) {
            console.warn("No CSV file available for this website.");
            return;
        }

        console.log(`Loading CSV for ${command}: ${csvFile}`);

        // Inject `content.js` and execute the function with `csvFile` and `command`
        chrome.scripting.executeScript(
            {
                target: { tabId },
                files: ["content.js"], // Inject content.js first
            },
            () => {
                chrome.scripting.executeScript({
                    target: { tabId },
                    args: [csvFile, command], // Pass both CSV file and command
                    func: (csvFile, command) => {
                        window.loadCSVAndDrawBoundingBoxes(csvFile, command);
                    },
                });
            }
        );
    });
});

