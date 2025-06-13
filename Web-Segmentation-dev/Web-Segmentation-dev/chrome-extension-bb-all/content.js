console.log("Content script is running - ensuring unique IDs for all elements inside chrome-extension-bb.");

var elementGroups = new Map(); // Track processed elements
var uniqueIdCounter = 1; // Counter for unique Web Element IDs
var extractedData = []; // Store extracted data
var lastUpdateTime = Date.now(); // Track last time new elements were found
var isProcessing = false; // Flag to prevent redundant execution

// Function to check if an element is visible
function isVisible(element) {
    const computedStyles = window.getComputedStyle(element);
    return (
        element.offsetWidth > 0 &&
        element.offsetHeight > 0 &&
        computedStyles.visibility !== "hidden" &&
        computedStyles.display !== "none" &&
        computedStyles.opacity !== "0"
    );
}

// Function to check if an element is a leaf node (has no visible children)
function isLeafNode(element) {
    return !Array.from(element.children).some(child => isVisible(child));
}

// Function to generate a unique XPath for an element
function getXPath(element) {
    if (!element) return "";
    if (element.id) {
        return `//*[@id="${element.id}"]`; // Use ID if available
    }

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
            if (sibling.nodeType === 1 && sibling.tagName === currentElement.tagName) {
                index++;
            }
        }
        currentElement = parent;
    }

    return pathSegments.reverse().join("");
}

// Get computed styles for an element
function getStyles(element) {
    const computedStyles = window.getComputedStyle(element);
    return {
        backgroundColor: computedStyles.backgroundColor || "transparent",
        fontColor: computedStyles.color || "inherit",
        fontSize: computedStyles.fontSize || "inherit",
        fontStyle: computedStyles.fontStyle || "normal",
    };
}

// ✅ Function: Get correct x, y, width, and height of an element
function getDimensionsAndPosition(element) {
    if (!element) {
        console.warn("⚠️ Element is null or undefined.");
        return { width: 0, height: 0, x: 0, y: 0 };
    }

    const rect = element.getBoundingClientRect();
    return {
        width: rect.width || 0,
        height: rect.height || 0,
        x: rect.left + window.scrollX || 0,  // Adjust for horizontal scrolling
        y: rect.top + window.scrollY || 0    // Adjust for vertical scrolling
    };
}


// Extract meaningful text from an element
function getElementText(element) {
    if (!element) return "";
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        return element.placeholder?.trim() || "";
    }
    if (element.tagName === "BUTTON" || element.tagName === "A") {
        return element.innerText.trim();
    }
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
        return ariaLabel.trim();
    }
    const ignoreTags = ["SCRIPT", "STYLE", "NOSCRIPT"];
    if (ignoreTags.includes(element.tagName)) {
        return "";
    }
    let text = "";
    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            text += child.textContent.trim() + " ";
        }
    }
    return text.trim();
}

// Assign a unique Web Element ID to every element
function getUniqueWebElementId(element) {
    const xpath = getXPath(element);
    if (elementGroups.has(xpath)) {
        return elementGroups.get(xpath); // Return existing ID
    }
    const newId = `we-${uniqueIdCounter++}`;
    elementGroups.set(xpath, newId);
    return newId;
}

// Process and store only new data
function processBatch(elements) {
    let newElements = elements
        .filter(isLeafNode)
        .map((el) => {
            if (!isVisible(el)) return null;
            const xpath = getXPath(el);
            if (elementGroups.has(xpath)) return null; // Skip already processed elements

            const styles = getStyles(el);
            const dimensions = getDimensionsAndPosition(el);
            const text = getElementText(el);

            return {
                webElementId: getUniqueWebElementId(el),
                xpath,
                width: dimensions.width,
                height: dimensions.height,
                x: dimensions.x,
                y: dimensions.y,
                backgroundColor: styles.backgroundColor,
                fontColor: styles.fontColor,
                fontSize: styles.fontSize,
                fontStyle: styles.fontStyle,
                text,
            };
        })
        .filter(Boolean);

    if (newElements.length > 0) {
        extractedData.push(...newElements);
        lastUpdateTime = Date.now(); // Reset timer if new elements are found
        console.log(`Added ${newElements.length} new elements.`);
    }
}

// **Send Data to Backend If No New Elements Are Found for 60 Seconds**
setInterval(() => {
    let timeSinceLastUpdate = (Date.now() - lastUpdateTime) / 1000;
    if (timeSinceLastUpdate >= 60 && extractedData.length > 0) {
        sendDataToBackend(extractedData);
        extractedData = []; // Clear after sending
        console.log("Data sent after 60 seconds of inactivity.");
    }
}, 5000); // Check every 5 seconds

// Send data to the backend
function sendDataToBackend(data) {
    fetch("http://127.0.0.1:8000/api/extract/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ elements: data }),
    })
    .then((response) => response.json())
    .then((data) => console.log("Data sent successfully:", data))
    .catch((error) => console.error("Error sending data:", error));
}

// **Observe dynamic content changes**
function observeDynamicContent() {
    const observer = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === "childList") {
                const newElements = Array.from(mutation.addedNodes)
                    .filter(node => node.nodeType === 1) // Process only elements
                    .filter(isVisible)
                    .filter(isLeafNode);

                if (newElements.length > 0) {
                    console.log("Processing dynamically loaded elements...");
                    processBatch(newElements);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    console.log("MutationObserver is now tracking dynamic content.");
}

// **Initial execution with a delay**
setTimeout(() => {
    console.log("Waiting for dynamic content to load...");
    const allElements = Array.from(document.querySelectorAll("*"))
        .filter(isVisible)
        .filter(isLeafNode);
    processBatch(allElements);
    observeDynamicContent();
}, 3000);

// ✅ Ensure `boundingBoxesVisible` is declared only once
if (typeof boundingBoxesVisible === "undefined") {
    var boundingBoxesVisible = false;
}

function loadCSVAndDrawBoundingBoxes(csvFile, command) {
    console.log(`Loading CSV: ${csvFile}, triggered by command: ${command}`);

    fetch(chrome.runtime.getURL(csvFile))
        .then(response => {
            if (!response.ok) throw new Error("CSV file not found.");
            return response.text();
        })
        .then(text => {
            console.log("CSV File Content:\n", text);

            // ✅ Ensure CSV is properly formatted before splitting
            if (!text.trim()) {
                console.error("CSV file is empty!");
                return;
            }

            const rows = text.trim().split(/\r?\n/).map(row => row.split(","));
            const headers = rows[0].map(header => header.trim().toLowerCase()); // ✅ Make headers case-insensitive

            console.log("Parsed Headers:", headers);
            console.log("First Data Row:", rows[1]); // ✅ Log first data row for debugging

            // ✅ Ensure all required headers exist
            const requiredHeaders = ["xpath", "x", "y", "width", "height", "segment"];
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

            if (missingHeaders.length > 0) {
                console.error(`CSV is missing required headers: ${missingHeaders.join(", ")}`);
                return;
            }

            function cleanCSVValue(value) {
                return value.replace(/^"|"$/g, "").replace(/""/g, '"'); // ✅ Removes extra quotes
            }
            
            // ✅ Fix the CSV parsing function
            const data = rows.slice(1).map(row => {
                return {
                    webElementId: row[headers.indexOf("webElementId")],
                    webElementXPath: cleanCSVValue(row[headers.indexOf("xpath")] || ""), // ✅ Cleans up XPath
                    x: parseFloat(row[headers.indexOf("x")]) || 0,
                    y: parseFloat(row[headers.indexOf("y")]) || 0,
                    width: parseFloat(row[headers.indexOf("width")]) || 1,
                    height: parseFloat(row[headers.indexOf("height")]) || 1,
                    segmentId: row[row.length - 1] 
                };
            });
            

            console.log("Processed Data:", data);

            // ✅ Ensure `data` is an array before proceeding
            if (!Array.isArray(data) || data.length === 0) {
                console.warn("No valid data found in CSV.");
                return;
            }

            // Assign segment colors
            const uniqueSegments = [...new Set(data.map(d => d.segmentId))];
            console.log(uniqueSegments);
            const segmentColors = {};
            uniqueSegments.forEach((segment, index) => {
                segmentColors[segment] = `hsl(${(index * 137) % 360}, 70%, 60%)`;
            });

            console.log("Segment Colors:", segmentColors);

            // Store global variables
            window.currentBoundingBoxData = data;
            window.currentSegmentColors = segmentColors;
            window.currentCommand = command;

            // ✅ Ensure only visible elements are processed
            drawBoundingBoxes(data, segmentColors, command);
        })
        .catch(error => console.warn(`No CSV found for this website: ${csvFile}`, error));
}

function drawBoundingBoxes(data, segmentColors, command) {
    console.log("Drawing bounding boxes...");
    console.log("Bounding Box Data:", data);
    console.log("Command Triggered:", command);

    // ✅ Remove old bounding boxes before drawing new ones
    document.querySelectorAll(".bounding-box").forEach(box => box.remove());

    data.forEach(element => {
        let domElement = getElementByXPath(element.webElementXPath);
        if (domElement) {  // ✅ Draw regardless of visibility
            let bbox = document.createElement("div");
            bbox.classList.add("bounding-box");

            // ✅ Assign type-specific border style
            switch (command) {
                case "extract_structure":
                    bbox.classList.add("bounding-box-structure");
                    break;
                case "extract_spatial":
                    bbox.classList.add("bounding-box-spatial");
                    break;
                case "extract_visual":
                    bbox.classList.add("bounding-box-visual");
                    break;
                case "extract_texts":
                    bbox.classList.add("bounding-box-semantic");
                    break;
                default:
                    console.warn(`Unknown type: ${element.type}`);
            }

            // ✅ Adjust position based on the actual element's bounding box
            function updateBoundingBoxPosition() {
                let rect = domElement.getBoundingClientRect();
                bbox.style.position = "absolute";
                bbox.style.left = `${rect.left + window.scrollX}px`;
                bbox.style.top = `${rect.top + window.scrollY}px`;
                bbox.style.width = `${rect.width}px`;
                bbox.style.height = `${rect.height}px`;
            }

            updateBoundingBoxPosition(); // ✅ Set initial position

            // ✅ Assign color based on segment
            const color = segmentColors[element.segmentId] || "red"; // Default to red if no segment found
            bbox.style.borderColor = color;
            bbox.style.backgroundColor = `${color}33`; // Add transparency to background

            bbox.style.zIndex = "9999";
            bbox.style.pointerEvents = "none";

            // Create a label for Web Element ID and Segment ID
            // let label = document.createElement("span");
            // label.classList.add("bounding-box-label");
            // label.innerText = `${element.webElementId || "No ID"} (${element.segmentId})`;
            // bbox.appendChild(label);

            document.body.appendChild(bbox);

            // ✅ Update bounding box position dynamically on scroll
            window.addEventListener("scroll", updateBoundingBoxPosition);
        }
    });

    console.log("Bounding boxes should now adjust with scrolling.");
}

// ✅ Utility function: Find an element using XPath
function getElementByXPath(xpath) {
    try {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (e) {
        console.warn("Invalid XPath:", xpath);
        return null;
    }
}

// ✅ Utility function: Check if an element is visible
function isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
    }

    const rect = element.getBoundingClientRect();
    return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
    );
}

// ✅ Update bounding boxes dynamically on scroll
window.addEventListener("scroll", () => {
    console.log("Scroll detected. Updating bounding boxes.");
    drawBoundingBoxes(window.currentBoundingBoxData, window.currentSegmentColors, window.currentCommand);
});

// ✅ Clear bounding boxes only when the page is refreshed
window.addEventListener("beforeunload", () => {
    console.log("Page refreshed. Removing all bounding boxes.");
    document.querySelectorAll(".bounding-box").forEach(box => box.remove());
});

// ✅ Store global variables for reference
window.currentBoundingBoxData = [];
window.currentSegmentColors = {};
window.currentCommand = "";

console.log("Content script loaded");

// Prevent duplicate CSS injection
if (!document.querySelector("#bounding-box-style")) {
    const style = document.createElement("style");
    style.id = "bounding-box-style";
    style.innerHTML = `
        .bounding-box {
            position: absolute !important;
            z-index: 9999 !important;
            pointer-events: none !important;
        }
        .bounding-box-structure {
            border-style: dotted !important;
            border-width: 4px !important;
        }
        .bounding-box-spatial {
            border-style: dashed !important;
        }
        .bounding-box-visual {
            border-style: solid !important;
        }
        .bounding-box-semantic {
            border-style: double !important;
        }
        .bounding-box-label {
            position: absolute !important;
            top: 0px;
            left: 0px;
            font-size: 12px;
            font-weight: bold;
            color: white;
            background-color: rgba(0, 0, 0, 0.7);
            padding: 2px 5px;
            border-radius: 3px;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}

window.loadCSVAndDrawBoundingBoxes = loadCSVAndDrawBoundingBoxes;

// // ✅ Ensure `boundingBoxesVisible` is declared only once
// if (typeof boundingBoxesVisible === "undefined") {
//     var boundingBoxesVisible = false;
// }

// function loadCSVAndDrawBoundingBoxes(csvFile, command) {
//     console.log(`Loading CSV: ${csvFile}, triggered by command: ${command}`);

//     fetch(chrome.runtime.getURL(csvFile))
//         .then(response => {
//             if (!response.ok) throw new Error("CSV file not found.");
//             return response.text();
//         })
//         .then(text => {
//             console.log("CSV File Content:\n", text);

//             const rows = text.trim().split(/\r?\n/).map(row => row.split(","));
//             const headers = rows[0].map(header => header.trim());

//             console.log("Parsed Headers:", headers);

//             const data = rows.slice(1).map(row => {
//                 return {
//                     webElementId: row[headers.indexOf("webElementId")].trim(),
//                     x: parseFloat(row[headers.indexOf("x")]) || 0,
//                     y: parseFloat(row[headers.indexOf("y")]) || 0,
//                     width: parseFloat(row[headers.indexOf("width")]) || 1,
//                     height: parseFloat(row[headers.indexOf("height")]) || 1,
//                     segmentId: row[headers.indexOf("Segment")].trim()
//                 };
//             });

//             console.log("Processed Data:", data);

//             // Get unique segment IDs and assign colors
//             const uniqueSegments = [...new Set(data.map(d => d.segmentId))];
//             const segmentColors = {};
//             uniqueSegments.forEach((segment, index) => {
//                 segmentColors[segment] = `hsl(${(index * 137) % 360}, 70%, 60%)`; // Unique HSL color
//             });

//             console.log("Segment Colors:", segmentColors);
//             // Store global variables to persist the command
//             window.currentBoundingBoxData = data;
//             window.currentSegmentColors = segmentColors;
//             window.currentCommand = command; // ✅ Ensure command is stored

//             // Pass the `command` argument to the drawBoundingBoxes function
//             drawBoundingBoxes(data, segmentColors, command);
//         })
//         .catch(error => console.warn(`No CSV found for this website: ${csvFile}`, error));
// }


// // Function: Draw bounding boxes dynamically based on viewport visibility
// function drawBoundingBoxes(data, segmentColors, command) {
//     console.log("Drawing bounding boxes...");
//     console.log("Bounding Box Data:", data);
//     console.log("Command Triggered:", command);

//     // Remove old bounding boxes
//     document.querySelectorAll(".bounding-box").forEach(box => box.remove());

//     data.forEach(element => {
//         if (isElementInViewport(element)) {  // Only draw if the element is visible
//             let bbox = document.createElement("div");
//             bbox.classList.add("bounding-box");

//             // Assign type-specific border style
//             switch (command) {
//                 case "extract_structure":
//                     bbox.classList.add("bounding-box-structure");
//                     break;
//                 case "extract_spatial":
//                     bbox.classList.add("bounding-box-spatial");
//                     break;
//                 case "extract_visual":
//                     bbox.classList.add("bounding-box-visual");
//                     break;
//                 case "extract_texts":
//                     bbox.classList.add("bounding-box-semantic");
//                     break;
//                 default:
//                     console.warn(`Unknown type: ${element.type}`);
//             }

//             // Adjust position based on scroll
//             bbox.style.position = "absolute";
//             bbox.style.left = `${element.x - window.scrollX}px`;
//             bbox.style.top = `${element.y - window.scrollY}px`;
//             bbox.style.width = `${element.width}px`;
//             bbox.style.height = `${element.height}px`;

//             // Assign color based on segment
//             const color = segmentColors[element.segmentId];
//             bbox.style.borderColor = color;
//             bbox.style.backgroundColor = `${color}33`; // Add transparency to background

//             bbox.style.zIndex = "9999";
//             bbox.style.pointerEvents = "none";

//             document.body.appendChild(bbox);
//         }
//     });

//     console.log("Bounding boxes should now adjust with scrolling.");
// }

// // Utility function to check if an element is in the viewport
// function isElementInViewport(element) {
//     const viewportHeight = window.innerHeight;
//     const viewportWidth = window.innerWidth;

//     return (
//         element.y >= window.scrollY &&
//         element.y + element.height <= window.scrollY + viewportHeight &&
//         element.x >= window.scrollX &&
//         element.x + element.width <= window.scrollX + viewportWidth
//     );
// }

// // Update bounding boxes dynamically on scroll
// window.addEventListener("scroll", () => {
//     console.log("Scroll detected. Updating bounding boxes.");
//     drawBoundingBoxes(window.currentBoundingBoxData, window.currentSegmentColors, window.currentCommand);
// });

// // ✅ Clear bounding boxes only when the page is refreshed
// window.addEventListener("beforeunload", () => {
//     console.log("Page refreshed. Removing all bounding boxes.");
//     document.querySelectorAll(".bounding-box").forEach(box => box.remove());
// });

// // Store global variables for reference
// window.currentBoundingBoxData = [];
// window.currentSegmentColors = {};
// window.currentCommand = "";

// window.loadCSVAndDrawBoundingBoxes = loadCSVAndDrawBoundingBoxes;
// Function to load bounding box data and trigger drawing
// window.loadCSVAndDrawBoundingBoxes = function (data, segmentColors, command) {
//     window.currentBoundingBoxData = data;
//     window.currentSegmentColors = segmentColors;
//     window.currentCommand = command;
//     drawBoundingBoxes(data, segmentColors, command);
// };

// // Function: Draw bounding boxes with styles, segment colors, and command-specific logic
// function drawBoundingBoxes(data, segmentColors, command) {
//     console.log("Drawing bounding boxes...");
//     console.log("Bounding Box Data:", data);
//     console.log("Command Triggered:", command);

//     // Remove old bounding boxes
//     //document.querySelectorAll(".bounding-box").forEach(box => box.remove());

//     data.forEach(element => {
//         let bbox = document.createElement("div");
//         bbox.classList.add("bounding-box");

//         // Assign type-specific border style
//         switch (command) {
//             case "extract_structure":
//                 bbox.classList.add("bounding-box-structure");
//                 break;
//             case "extract_spatial":
//                 bbox.classList.add("bounding-box-spatial");
//                 break;
//             case "extract_visual":
//                 bbox.classList.add("bounding-box-visual");
//                 break;
//             case "extract_texts":
//                 bbox.classList.add("bounding-box-semantic");
//                 break;
//             default:
//                 console.warn(`Unknown type: ${element.type}`);
//         }

//         // Assign position and dimensions
//         bbox.style.position = "absolute";
//         bbox.style.left = `${element.x}px`;
//         bbox.style.top = `${element.y}px`;
//         bbox.style.width = `${element.width}px`;
//         bbox.style.height = `${element.height}px`;

//         // Assign color based on segment
//         const color = segmentColors[element.segmentId];
//         bbox.style.borderColor = color;
//         bbox.style.backgroundColor = `${color}33`; // Add transparency to background

//         bbox.style.zIndex = "9999";
//         bbox.style.pointerEvents = "none";

//         // // Create a label for Web Element ID and Segment ID
//         // let label = document.createElement("span");
//         // label.classList.add("bounding-box-label");
//         // label.innerText = `${element.webElementId || "No ID"} (${element.segmentId})`;
//         // bbox.appendChild(label);

//         document.body.appendChild(bbox);
//     });

//     console.log("Bounding boxes with styles and colors should be visible now.");
// }

// // ✅ Clear bounding boxes only when the page is refreshed
// window.addEventListener("beforeunload", () => {
//     console.log("Page refreshed. Removing all bounding boxes.");
//     document.querySelectorAll(".bounding-box").forEach(box => box.remove());
// });

// // Expose the function globally so `background.js` can call it
// window.loadCSVAndDrawBoundingBoxes = loadCSVAndDrawBoundingBoxes;

// // ----  working start----
// // ✅ Function: Load CSV, extract data, and draw bounding boxes
// function loadCSVAndDrawBoundingBoxes(csvFile) {
//     console.log(`Loading CSV: ${csvFile}`);

//     fetch(chrome.runtime.getURL(csvFile))
//         .then(response => {
//             if (!response.ok) throw new Error("CSV file not found.");
//             return response.text();
//         })
//         .then(text => {
//             console.log("CSV File Content:\n", text); // Debugging step

//             const rows = text.trim().split(/\r?\n/).map(row => row.split(","));
//             let headers = rows[0].map(header => header.trim()); // Trim spaces in column names

//             console.log("Parsed Headers:", headers); // Debugging step

//             const data = rows.slice(1).map(row => {
//                 return {
//                     webElementId: row[headers.indexOf("webElementId")].trim(), // Read Web Element ID
//                     x: parseFloat(row[headers.indexOf("x")]) || 0,
//                     y: parseFloat(row[headers.indexOf("y")]) || 0,
//                     width: parseFloat(row[headers.indexOf("width")]) || 1, // Ensure width is nonzero
//                     height: parseFloat(row[headers.indexOf("height")]) || 1, // Ensure height is nonzero
//                     SegmentID: row[headers.indexOf("Segment")].trim() 
//                 };
//             });

//             console.log("Processed Data:", data); // Debugging step

//             drawBoundingBoxes(data);
//         })
//         .catch(error => console.warn(`No CSV found for this website: ${csvFile}`, error));
// }

// console.log("Content script loaded");

// // ✅ Ensure `boundingBoxesVisible` is declared only once
// if (typeof boundingBoxesVisible === "undefined") {
//     var boundingBoxesVisible = false;
// }

// // ✅ Prevent duplicate CSS injection
// if (!document.querySelector("#bounding-box-style")) {
//     const style = document.createElement("style");
//     style.id = "bounding-box-style"; // Unique ID to avoid duplicates
//     style.innerHTML = `
//         .bounding-box {
//             position: absolute !important;
//             border: 2px solid red !important;
//             background-color: rgba(255, 0, 0, 0.2) !important;
//             z-index: 9999 !important;
//             pointer-events: none !important;
//         }
//         .bounding-box-label {
//             position: absolute !important;
//             top: 0px;
//             left: 0px;
//             font-size: 12px;
//             font-weight: bold;
//             color: white;
//             background-color: rgba(0, 0, 0, 0.7);
//             padding: 2px 5px;
//             border-radius: 3px;
//             pointer-events: none;
//         }
//     `;
//     document.head.appendChild(style);
// }

// // ✅ Function: Draw bounding boxes with Web Element IDs
// function drawBoundingBoxes(data) {
//     console.log("Drawing bounding boxes...");
//     console.log("Bounding Box Data:", data);

//     // Remove old bounding boxes
//     document.querySelectorAll(".bounding-box").forEach(box => box.remove());

//     data.forEach(element => {
//         let bbox = document.createElement("div");
//         bbox.classList.add("bounding-box");
//         bbox.style.position = "absolute";
//         bbox.style.left = `${element.x}px`;
//         bbox.style.top = `${element.y}px`;
//         bbox.style.width = `${element.width}px`;
//         bbox.style.height = `${element.height}px`;
//         bbox.style.border = "2px solid red";
//         bbox.style.backgroundColor = "rgba(255, 0, 0, 0.2)";
//         bbox.style.zIndex = "9999";
//         bbox.style.pointerEvents = "none";

//         // ✅ Create a label for the Web Element ID
//         let label = document.createElement("span");
//         label.classList.add("bounding-box-label");
//         label.innerText = element.webElementId || "No ID"; // Show ID or fallback text

//         bbox.appendChild(label);
//         document.body.appendChild(bbox);
//     });

//     console.log("Bounding boxes with Web Element IDs should be visible now.");
//     boundingBoxesVisible = true;
// }

// // ✅ Expose function globally so `background.js` can call it
// window.loadCSVAndDrawBoundingBoxes = loadCSVAndDrawBoundingBoxes;

// working end
// // ✅ Function: Load CSV and draw bounding boxes - correct
// function loadCSVAndDrawBoundingBoxes(csvFile) {
//     console.log(`Loading CSV: ${csvFile}`);

//     fetch(chrome.runtime.getURL(csvFile))
//         .then(response => {
//             if (!response.ok) throw new Error("CSV file not found.");
//             return response.text();
//         })
//         .then(text => {
//             console.log("CSV File Content:\n", text); // Debugging step

//             const rows = text.trim().split(/\r?\n/).map(row => row.split(","));
//             let headers = rows[0].map(header => header.trim()); // Trim spaces in column names

//             console.log("Parsed Headers:", headers); // Debugging step

//             const data = rows.slice(1).map(row => {
//                 return {
//                     x: parseFloat(row[headers.indexOf("x")]) || 0,
//                     y: parseFloat(row[headers.indexOf("y_co")]) || 0,
//                     width: parseFloat(row[headers.indexOf("width")]) || 1, // Ensure width is nonzero
//                     height: parseFloat(row[headers.indexOf("height")]) || 1 // Ensure height is nonzero
//                 };
//             });

//             console.log("Processed Data:", data); // Debugging step

//             drawBoundingBoxes(data);
//         })
//         .catch(error => console.warn(`No CSV found for this website: ${csvFile}`, error));
// }


// console.log("Content script loaded");

// // ✅ Ensure `boundingBoxesVisible` is declared only once - ciorrect
// if (typeof boundingBoxesVisible === "undefined") {
//     var boundingBoxesVisible = false;
// }

// // ✅ Prevent duplicate CSS injection - correct
// if (!document.querySelector("#bounding-box-style")) {
//     const style = document.createElement("style");
//     style.id = "bounding-box-style"; // Unique ID to avoid duplicates
//     style.innerHTML = `
//         .bounding-box {
//             position: absolute !important;
//             border: 2px solid red !important;
//             background-color: rgba(255, 0, 0, 0.2) !important;
//             z-index: 9999 !important;
//             pointer-events: none !important;
//         }
//     `;
//     document.head.appendChild(style);
// }

// // ✅ Function: Draw bounding boxes - correct
// function drawBoundingBoxes(data) {
//     console.log("Drawing bounding boxes...");
//     console.log("Bounding Box Data:", data);

//     // Remove old bounding boxes
//     document.querySelectorAll(".bounding-box").forEach(box => box.remove());

//     data.forEach(element => {
//         let bbox = document.createElement("div");
//         bbox.classList.add("bounding-box");
//         bbox.style.position = "absolute";
//         bbox.style.left = `${element.x}px`;
//         bbox.style.top = `${element.y}px`;
//         bbox.style.width = `${element.width}px`;
//         bbox.style.height = `${element.height}px`;
//         bbox.style.border = "2px solid red";
//         bbox.style.backgroundColor = "rgba(255, 0, 0, 0.2)";
//         bbox.style.zIndex = "9999";
//         bbox.style.pointerEvents = "none";

//         document.body.appendChild(bbox);
//     });

//     console.log("Bounding boxes should be visible now.");
//     boundingBoxesVisible = true;
// }

// // ✅ Function: Draw bounding boxes
// function drawBoundingBoxes(data) {
//     if (boundingBoxesVisible) {
//         document.querySelectorAll(".bounding-box").forEach(box => box.remove());
//         boundingBoxesVisible = false;
//         return;
//     }

//     data.forEach(element => {
//         let bbox = document.createElement("div");
//         bbox.classList.add("bounding-box");
//         bbox.style.position = "absolute";
//         bbox.style.left = `${element.x}px`;
//         bbox.style.top = `${element.y}px`;
//         bbox.style.width = `${element.width}px`;
//         bbox.style.height = `${element.height}px`;
//         bbox.style.border = "2px solid red";
//         bbox.style.zIndex = "9999";
//         bbox.style.pointerEvents = "none";

//         document.body.appendChild(bbox);
//     });

//     boundingBoxesVisible = true;
// }

// ✅ Expose function globally so `background.js` can call it - correct
window.loadCSVAndDrawBoundingBoxes = loadCSVAndDrawBoundingBoxes;

// // Track bounding box visibility
// let boundingBoxesVisible = false;

// // Function to load and parse the selected CSV file
// function loadCSVAndDrawBoundingBoxes(csvFile) {
//     console.log("Print inside getcsv");
//     fetch(chrome.runtime.getURL(csvFile))
//         .then(response => {
//             if (!response.ok) throw new Error("CSV file not found for this website.");
//             return response.text();
//         })
//         .then(text => {
//             const rows = text.trim().split("\n").map(row => row.split(","));
//             const headers = rows[0]; // First row contains column names
//             const data = rows.slice(1).map(row => ({
//                 x: parseFloat(row[headers.indexOf("x")]),
//                 y: parseFloat(row[headers.indexOf("y")]),
//                 width: parseFloat(row[headers.indexOf("width")]),
//                 height: parseFloat(row[headers.indexOf("height")])
//             }));

//             drawBoundingBoxes(data);
//         })
//         .catch(error => console.warn(`No CSV found for this website: ${csvFile}`, error));
// }

// // Function to draw bounding boxes
// function drawBoundingBoxes(data) {
//     if (boundingBoxesVisible) {
//         document.querySelectorAll(".bounding-box").forEach(box => box.remove());
//         boundingBoxesVisible = false;
//         return;
//     }

//     data.forEach((element) => {
//         let bbox = document.createElement("div");
//         bbox.classList.add("bounding-box");
//         bbox.style.position = "absolute";
//         bbox.style.left = `${element.x}px`;
//         bbox.style.top = `${element.y}px`;
//         bbox.style.width = `${element.width}px`;
//         bbox.style.height = `${element.height}px`;
//         bbox.style.border = "2px solid red";
//         bbox.style.zIndex = "9999";
//         bbox.style.pointerEvents = "none";

//         document.body.appendChild(bbox);
//     });

//     boundingBoxesVisible = true;
// }


// // // Function to draw bounding boxes
// // function drawBoundingBoxes() {
// //     if (boundingBoxesVisible) {
// //         document.querySelectorAll(".bounding-box").forEach(box => box.remove());
// //         boundingBoxesVisible = false;
// //         return;
// //     }

// //     extractedData.forEach((element) => {
// //         let bbox = document.createElement("div");
// //         bbox.classList.add("bounding-box");
// //         bbox.style.position = "absolute";
// //         bbox.style.left = `${element.x}px`;
// //         bbox.style.top = `${element.y}px`;
// //         bbox.style.width = `${element.width}px`;
// //         bbox.style.height = `${element.height}px`;
// //         bbox.style.border = "2px solid red";
// //         bbox.style.zIndex = "9999";
// //         bbox.style.pointerEvents = "none";

// //         document.body.appendChild(bbox);
// //     });

// //     boundingBoxesVisible = true;
// // }

// // // **Trigger function when keyboard shortcut is pressed**
// // function triggerBoundingBoxes() {
// //     // processBatch(Array.from(document.querySelectorAll("*")).filter(isVisible));
// //     drawBoundingBoxes();
// // }