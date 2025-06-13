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

// // Get dimensions and position of an element
// function getDimensionsAndPosition(element) {
//     const rect = element.getBoundingClientRect();
//     return {
//         width: rect.width || 0,
//         height: rect.height || 0,
//         x: rect.x || 0,
//         y: rect.y || 0,
//     };
// }

// ✅ Function: Get correct x, y, width, and height of an element
function getDimensionsAndPosition(element) {
    if (!element) {
        console.warn("⚠️ Element is null or undefined.");
        return { width: 0, height: 0, x: 0, y: 0 };
    }

    const rect = element.getBoundingClientRect();
    console.log(rect);
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

function loadCSVAndDrawBoundingBoxes(csvFile) {
    console.log(`Loading CSV: ${csvFile}`);

    fetch(chrome.runtime.getURL(csvFile))
        .then(response => {
            if (!response.ok) throw new Error("CSV file not found.");
            return response.text();
        })
        .then(text => {
            console.log("CSV File Content:\n", text); // Debugging step

            const rows = text.trim().split(/\r?\n/).map(row => row.split(","));
            let headers = rows[0].map(header => header.trim()); // Trim spaces in column names

            console.log("Parsed Headers:", headers); // Debugging step

            const data = rows.slice(1).map(row => {
                return {
                    webElementId: row[headers.indexOf("webElementId")].trim(), // Read Web Element ID
                    x: parseFloat(row[headers.indexOf("x")]) || 0,
                    y: parseFloat(row[headers.indexOf("y")]) || 0,
                    width: parseFloat(row[headers.indexOf("width")]) || 1, // Ensure width is nonzero
                    height: parseFloat(row[headers.indexOf("height")]) || 1, // Ensure height is nonzero
                    segmentId: row[headers.indexOf("Segment")].trim() // Read Segment ID
                };
            });

            console.log("Processed Data:", data); // Debugging step

            // ✅ Get unique segment IDs and assign colors
            const uniqueSegments = [...new Set(data.map(d => d.segmentId))];
            const segmentColors = {};
            uniqueSegments.forEach((segment, index) => {
                // Generate random colors for each segment
                segmentColors[segment] = `hsl(${(index * 137) % 360}, 70%, 60%)`; // Unique HSL color
            });

            console.log("Segment Colors:", segmentColors); // Debugging step

            drawBoundingBoxes(data, segmentColors);
        })
        .catch(error => console.warn(`No CSV found for this website: ${csvFile}`, error));
}

console.log("Content script loaded");

// // ✅ Ensure `boundingBoxesVisible` is declared only once
// if (typeof boundingBoxesVisible === "undefined") {
//     var boundingBoxesVisible = false;
// }

// ✅ Prevent duplicate CSS injection
if (!document.querySelector("#bounding-box-style")) {
    const style = document.createElement("style");
    style.id = "bounding-box-style"; // Unique ID to avoid duplicates
    style.innerHTML = `
        .bounding-box {
            position: absolute !important;
            z-index: 9999 !important;
            pointer-events: none !important;
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

// ✅ Function: Draw bounding boxes with Web Element IDs and segment colors
function drawBoundingBoxes(data, segmentColors) {
    console.log("Drawing bounding boxes...");
    console.log("Bounding Box Data:", data);

    // Remove old bounding boxes
    document.querySelectorAll(".bounding-box").forEach(box => box.remove());

    data.forEach(element => {
        let bbox = document.createElement("div");
        bbox.classList.add("bounding-box");
        bbox.style.position = "absolute";
        bbox.style.left = `${element.x}px`;
        bbox.style.top = `${element.y}px`;
        bbox.style.width = `${element.width}px`;
        bbox.style.height = `${element.height}px`;

        // Assign color based on the segment
        bbox.style.border = `2px solid ${segmentColors[element.segmentId]}`;
        bbox.style.backgroundColor = `${segmentColors[element.segmentId]}33`; // Add transparency

        bbox.style.zIndex = "9999";
        bbox.style.pointerEvents = "none";

        // // ✅ Create a label for the Web Element ID
        // let label = document.createElement("span");
        // label.classList.add("bounding-box-label");
        // label.innerText = `${element.webElementId || "No ID"} (${element.segmentId})`; // Show ID and Segment ID

        // bbox.appendChild(label);
        document.body.appendChild(bbox);
    });

    console.log("Bounding boxes with segment-based colors should be visible now.");
    boundingBoxesVisible = true;
}

// ✅ Expose function globally so `background.js` can call it
window.loadCSVAndDrawBoundingBoxes = loadCSVAndDrawBoundingBoxes;


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