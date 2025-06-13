console.log("Content script is running - ensuring unique IDs for all elements.");

var elementGroups = new Map(); // Track processed elements
let uniqueIdCounter = 1; // Counter for unique Web Element IDs
let extractedData = []; // Store extracted data
let lastUpdateTime = Date.now(); // Track last time new elements were found
let isProcessing = false; // Flag to prevent redundant execution

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

// Get dimensions and position of an element
function getDimensionsAndPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
        width: rect.width || 0,
        height: rect.height || 0,
        x: rect.x || 0,
        y: rect.y || 0,
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
            console.log(ele);
            console.log(dimensions);
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

// // Process elements in batches
// function processElementsInBatches(elements, batchSize = 100) {
//     for (let i = 0; i < elements.length; i += batchSize) {
//         const batch = elements.slice(i, i + batchSize);
//         const processedBatch = processBatch(batch);
//         sendDataToBackend(processedBatch);
//     }
// }

// // Extract and process only **visible leaf node elements**
// console.log("Extracting data for visible leaf node elements...");
// const allElements = Array.from(document.querySelectorAll("*")).filter(isVisible);
// processElementsInBatches(allElements);

// console.log("All visible leaf node elements processed.");
//-----------------------------------------------

// console.log("Content script is running - ensuring unique IDs for all elements.");

// // Map to track assigned Web Element IDs
// var elementGroups = new Map();
// let uniqueIdCounter = 1; // Counter for unique Web Element IDs

// // Function to check if an element is visible
// function isVisible(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return (
//         element.offsetWidth > 0 &&
//         element.offsetHeight > 0 &&
//         computedStyles.visibility !== "hidden" &&
//         computedStyles.display !== "none" &&
//         computedStyles.opacity !== "0"
//     );
// }

// // Function to check if an element is a leaf node (has no visible children)
// function isLeafNode(element) {
//     return !Array.from(element.children).some(child => isVisible(child));
// }

// // Function to generate a unique XPath for an element
// function getXPath(element) {
//     if (!element) return "";

//     if (element.id) {
//         return `//*[@id="${element.id}"]`; // Use ID if available
//     }

//     let pathSegments = [];
//     let currentElement = element;
//     while (currentElement && currentElement !== document.documentElement) {
//         if (currentElement.id) {
//             return `//*[@id="${currentElement.id}"]${pathSegments.reverse().join("")}`;
//         }

//         const parent = currentElement.parentNode;
//         if (!parent) break;

//         let index = 1;
//         const siblings = parent.childNodes;
//         for (let i = 0; i < siblings.length; i++) {
//             const sibling = siblings[i];
//             if (sibling === currentElement) {
//                 pathSegments.push(`/${currentElement.tagName.toLowerCase()}[${index}]`);
//                 break;
//             }
//             if (sibling.nodeType === 1 && sibling.tagName === currentElement.tagName) {
//                 index++;
//             }
//         }

//         currentElement = parent;
//     }

//     return pathSegments.reverse().join("");
// }

// // Get computed styles for an element
// function getStyles(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return {
//         backgroundColor: computedStyles.backgroundColor || "transparent",
//         fontColor: computedStyles.color || "inherit",
//         fontSize: computedStyles.fontSize || "inherit",
//         fontStyle: computedStyles.fontStyle || "normal",
//     };
// }

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

// // Extract meaningful text from an element
// function getElementText(element) {
//     if (!element) return "";

//     if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
//         return element.placeholder?.trim() || "";
//     }

//     if (element.tagName === "BUTTON" || element.tagName === "A") {
//         return element.innerText.trim();
//     }

//     const ariaLabel = element.getAttribute("aria-label");
//     if (ariaLabel) {
//         return ariaLabel.trim();
//     }

//     const ignoreTags = ["SCRIPT", "STYLE", "NOSCRIPT"];
//     if (ignoreTags.includes(element.tagName)) {
//         return "";
//     }

//     let text = "";
//     for (const child of element.childNodes) {
//         if (child.nodeType === Node.TEXT_NODE) {
//             text += child.textContent.trim() + " ";
//         }
//     }

//     return text.trim();
// }

// // **Assign a unique Web Element ID to every element**
// function getUniqueWebElementId(element) {
//     const xpath = getXPath(element);

//     // If an element already has an assigned ID, return it
//     if (elementGroups.has(xpath)) {
//         return elementGroups.get(xpath);
//     }

//     // Otherwise, assign a new unique ID
//     const newId = `we-${uniqueIdCounter++}`;
//     elementGroups.set(xpath, newId);
//     return newId;
// }

// // Process a batch of elements and assign unique Web Element IDs
// function processBatch(elements) {
//     return elements
//         .filter(isLeafNode) // ✅ Retain only leaf nodes
//         .map((el) => {
//             if (!isVisible(el)) return null;

//             const xpath = getXPath(el);
//             const styles = getStyles(el);
//             const dimensions = getDimensionsAndPosition(el);
//             const text = getElementText(el);

//             return {
//                 webElementId: getUniqueWebElementId(el), // Each element gets a unique ID
//                 xpath,
//                 width: dimensions.width,
//                 height: dimensions.height,
//                 x: dimensions.x,
//                 y: dimensions.y,
//                 backgroundColor: styles.backgroundColor,
//                 fontColor: styles.fontColor,
//                 fontSize: styles.fontSize,
//                 fontStyle: styles.fontStyle,
//                 text,
//             };
//         })
//         .filter(Boolean);
// }

// // Process elements in batches
// function processElementsInBatches(elements, batchSize = 100) {
//     for (let i = 0; i < elements.length; i += batchSize) {
//         const batch = elements.slice(i, i + batchSize);
//         const processedBatch = processBatch(batch);
//         sendDataToBackend(processedBatch);
//     }
// }

// // Send data to the backend
// function sendDataToBackend(data) {
//     fetch("http://127.0.0.1:8000/api/extract/", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ elements: data }),
//     })
//     .then((response) => response.json())
//     .then((data) => console.log("Data sent successfully:", data))
//     .catch((error) => console.error("Error sending data:", error));
// }

// // **Observe dynamic content changes**
// function observeDynamicContent() {
//     const observer = new MutationObserver((mutationsList) => {
//         for (let mutation of mutationsList) {
//             if (mutation.type === "childList") {
//                 const newElements = Array.from(mutation.addedNodes)
//                     .filter(node => node.nodeType === 1) // Process only elements
//                     .filter(isVisible)
//                     .filter(isLeafNode);

//                 if (newElements.length > 0) {
//                     console.log("Processing dynamically loaded elements...");
//                     processElementsInBatches(newElements);
//                 }
//             }
//         }
//     });

//     observer.observe(document.body, {
//         childList: true,
//         subtree: true, // Observe changes in all child elements
//     });

//     console.log("MutationObserver is now tracking dynamic content.");
// }

// // **Handle Lazy-Loaded Content**
// function observeLazyLoad() {
//     const observer = new IntersectionObserver((entries, observer) => {
//         entries.forEach(entry => {
//             if (entry.isIntersecting) {
//                 const el = entry.target;
//                 if (isLeafNode(el) && isVisible(el)) {
//                     console.log("Processing lazy-loaded element:", el);
//                     processElementsInBatches([el]);
//                     observer.unobserve(el); // Stop observing once processed
//                 }
//             }
//         });
//     }, { threshold: 0.1 });

//     document.querySelectorAll("*").forEach(el => observer.observe(el));
// }

// // **Re-check for dynamically appearing elements periodically**
// setInterval(() => {
//     console.log("Checking for new visible elements...");
//     const newElements = Array.from(document.querySelectorAll("*"))
//         .filter(isVisible)
//         .filter(isLeafNode);
//     if (newElements.length > 0) {
//         processElementsInBatches(newElements);
//     }
// }, 5000); // Re-check every 5 seconds

// // **Initial execution with a delay to allow content to load**
// setTimeout(() => {
//     console.log("Waiting for dynamic content to load...");
//     const allElements = Array.from(document.querySelectorAll("*"))
//         .filter(isVisible)
//         .filter(isLeafNode);
//     processElementsInBatches(allElements);
//     observeDynamicContent(); // Start observing new changes
//     observeLazyLoad(); // Start tracking lazy-loaded elements
// }, 3000); // Delay by 3 seconds

// console.log("All visible leaf node elements processed.");


// console.log("Content script is running - ensuring unique IDs for all elements.");

// // Map to track assigned Web Element IDs
// var elementGroups = new Map();
// let uniqueIdCounter = 1; // Counter for unique Web Element IDs

// // Function to check if an element is visible
// function isVisible(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return (
//         element.offsetWidth > 0 &&
//         element.offsetHeight > 0 &&
//         computedStyles.visibility !== "hidden" &&
//         computedStyles.display !== "none" &&
//         computedStyles.opacity !== "0"
//     );
// }

// // Function to check if an element is a leaf node (has no visible children)
// function isLeafNode(element) {
//     return !Array.from(element.children).some(child => isVisible(child));
// }

// // Function to generate a unique XPath for an element
// function getXPath(element) {
//     if (!element) return "";

//     if (element.id) {
//         return `//*[@id="${element.id}"]`; // Use ID if available
//     }

//     let pathSegments = [];
//     let currentElement = element;
//     while (currentElement && currentElement !== document.documentElement) {
//         if (currentElement.id) {
//             return `//*[@id="${currentElement.id}"]${pathSegments.reverse().join("")}`;
//         }

//         const parent = currentElement.parentNode;
//         if (!parent) break;

//         let index = 1;
//         const siblings = parent.childNodes;
//         for (let i = 0; i < siblings.length; i++) {
//             const sibling = siblings[i];
//             if (sibling === currentElement) {
//                 pathSegments.push(`/${currentElement.tagName.toLowerCase()}[${index}]`);
//                 break;
//             }
//             if (sibling.nodeType === 1 && sibling.tagName === currentElement.tagName) {
//                 index++;
//             }
//         }

//         currentElement = parent;
//     }

//     return pathSegments.reverse().join("");
// }

// // Get computed styles for an element
// function getStyles(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return {
//         backgroundColor: computedStyles.backgroundColor || "transparent",
//         fontColor: computedStyles.color || "inherit",
//         fontSize: computedStyles.fontSize || "inherit",
//         fontStyle: computedStyles.fontStyle || "normal",
//     };
// }

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

// // Extract meaningful text from an element
// function getElementText(element) {
//     if (!element) return "";

//     if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
//         return element.placeholder?.trim() || "";
//     }

//     if (element.tagName === "BUTTON" || element.tagName === "A") {
//         return element.innerText.trim();
//     }

//     const ariaLabel = element.getAttribute("aria-label");
//     if (ariaLabel) {
//         return ariaLabel.trim();
//     }

//     const ignoreTags = ["SCRIPT", "STYLE", "NOSCRIPT"];
//     if (ignoreTags.includes(element.tagName)) {
//         return "";
//     }

//     let text = "";
//     for (const child of element.childNodes) {
//         if (child.nodeType === Node.TEXT_NODE) {
//             text += child.textContent.trim() + " ";
//         }
//     }

//     return text.trim();
// }

// // Check if an element is hidden
// function isHidden(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return computedStyles.display === "none" || computedStyles.visibility === "hidden" || computedStyles.opacity === "0";
// }

// // **Assign a unique Web Element ID to every element**
// function getUniqueWebElementId(element) {
//     const xpath = getXPath(element);

//     // If an element already has an assigned ID, return it
//     if (elementGroups.has(xpath)) {
//         return elementGroups.get(xpath);
//     }

//     // Otherwise, assign a new unique ID
//     const newId = `we-${uniqueIdCounter++}`;
//     elementGroups.set(xpath, newId);
//     return newId;
// }

// // Process a batch of elements and assign unique Web Element IDs
// function processBatch(elements) {
//     return elements
//         .filter(isLeafNode) // ✅ Retain only leaf nodes
//         .map((el) => {
//             if (!isVisible(el)) return null;

//             const xpath = getXPath(el);
//             const styles = getStyles(el);
//             const dimensions = getDimensionsAndPosition(el);
//             const text = getElementText(el);

//             return {
//                 webElementId: getUniqueWebElementId(el), // Each element gets a unique ID
//                 xpath,
//                 width: dimensions.width,
//                 height: dimensions.height,
//                 x: dimensions.x,
//                 y: dimensions.y,
//                 backgroundColor: styles.backgroundColor,
//                 fontColor: styles.fontColor,
//                 fontSize: styles.fontSize,
//                 fontStyle: styles.fontStyle,
//                 text,
//             };
//         })
//         .filter(Boolean);
// }

// // Send data to the backend
// function sendDataToBackend(data) {
//     fetch("http://127.0.0.1:8000/api/extract/", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ elements: data }),
//     })
//     .then((response) => response.json())
//     .then((data) => console.log("Data sent successfully:", data))
//     .catch((error) => console.error("Error sending data:", error));
// }

// // Process elements in batches
// function processElementsInBatches(elements, batchSize = 100) {
//     for (let i = 0; i < elements.length; i += batchSize) {
//         const batch = elements.slice(i, i + batchSize);
//         const processedBatch = processBatch(batch);
//         sendDataToBackend(processedBatch);
//     }
// }

// // Extract and process only **visible leaf node elements**
// console.log("Extracting data for visible leaf node elements...");
// const allElements = Array.from(document.querySelectorAll("*")).filter(isVisible);
// processElementsInBatches(allElements);

// console.log("All visible leaf node elements processed.");
// -----------------------------------------------

// console.log("Content script is running - ensuring unique IDs for all elements.");

// // Map to track assigned Web Element IDs
// var elementGroups = new Map();
// let uniqueIdCounter = 1; // Counter for unique Web Element IDs

// // Function to check if an element is visible
// function isVisible(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return (
//         element.offsetWidth > 0 &&
//         element.offsetHeight > 0 &&
//         computedStyles.visibility !== "hidden" &&
//         computedStyles.display !== "none" &&
//         computedStyles.opacity !== "0"
//     );
// }

// // Function to generate a unique XPath for an element
// function getXPath(element) {
//     if (!element) return "";

//     if (element.id) {
//         return `//*[@id="${element.id}"]`; // Use ID if available
//     }

//     let pathSegments = [];
//     let currentElement = element;
//     while (currentElement && currentElement !== document.documentElement) {
//         if (currentElement.id) {
//             return `//*[@id="${currentElement.id}"]${pathSegments.reverse().join("")}`;
//         }

//         const parent = currentElement.parentNode;
//         if (!parent) break;

//         let index = 1;
//         const siblings = parent.childNodes;
//         for (let i = 0; i < siblings.length; i++) {
//             const sibling = siblings[i];
//             if (sibling === currentElement) {
//                 pathSegments.push(`/${currentElement.tagName.toLowerCase()}[${index}]`);
//                 break;
//             }
//             if (sibling.nodeType === 1 && sibling.tagName === currentElement.tagName) {
//                 index++;
//             }
//         }

//         currentElement = parent;
//     }

//     return pathSegments.reverse().join("");
// }

// // Get computed styles for an element
// function getStyles(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return {
//         backgroundColor: computedStyles.backgroundColor || "transparent",
//         fontColor: computedStyles.color || "inherit",
//         fontSize: computedStyles.fontSize || "inherit",
//         fontStyle: computedStyles.fontStyle || "normal",
//     };
// }

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

// // Extract meaningful text from an element
// function getElementText(element) {
//     if (!element) return "";

//     if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
//         return element.placeholder?.trim() || "";
//     }

//     if (element.tagName === "BUTTON" || element.tagName === "A") {
//         return element.innerText.trim();
//     }

//     const ariaLabel = element.getAttribute("aria-label");
//     if (ariaLabel) {
//         return ariaLabel.trim();
//     }

//     const ignoreTags = ["SCRIPT", "STYLE", "NOSCRIPT"];
//     if (ignoreTags.includes(element.tagName)) {
//         return "";
//     }

//     let text = "";
//     for (const child of element.childNodes) {
//         if (child.nodeType === Node.TEXT_NODE) {
//             text += child.textContent.trim() + " ";
//         } else if (child.nodeType === Node.ELEMENT_NODE && !isHidden(child)) {
//             text += getElementText(child) + " ";
//         }
//     }

//     return text.trim();
// }

// // Check if an element is hidden
// function isHidden(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return computedStyles.display === "none" || computedStyles.visibility === "hidden" || computedStyles.opacity === "0";
// }

// // **Assign a unique Web Element ID to every element**
// function getUniqueWebElementId(element) {
//     const xpath = getXPath(element);

//     // If an element already has an assigned ID, return it
//     if (elementGroups.has(xpath)) {
//         return elementGroups.get(xpath);
//     }

//     // Otherwise, assign a new unique ID
//     const newId = `we-${uniqueIdCounter++}`;
//     elementGroups.set(xpath, newId);
//     return newId;
// }

// // Process a batch of elements and assign unique Web Element IDs
// function processBatch(elements) {
//     return elements.map((el) => {
//         if (!isVisible(el)) return null;

//         const xpath = getXPath(el);
//         const styles = getStyles(el);
//         const dimensions = getDimensionsAndPosition(el);
//         const text = getElementText(el);

//         return {
//             webElementId: getUniqueWebElementId(el), // Each element gets a unique ID
//             xpath,
//             width: dimensions.width,
//             height: dimensions.height,
//             x: dimensions.x,
//             y: dimensions.y,
//             backgroundColor: styles.backgroundColor,
//             fontColor: styles.fontColor,
//             fontSize: styles.fontSize,
//             fontStyle: styles.fontStyle,
//             text,
//         };
//     }).filter(Boolean);
// }

// // Send data to the backend
// function sendDataToBackend(data) {
//     fetch("http://127.0.0.1:8000/api/extract/", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ elements: data }),
//     })
//     .then((response) => response.json())
//     .then((data) => console.log("Data sent successfully:", data))
//     .catch((error) => console.error("Error sending data:", error));
// }

// // Process elements in batches
// function processElementsInBatches(elements, batchSize = 100) {
//     for (let i = 0; i < elements.length; i += batchSize) {
//         const batch = elements.slice(i, i + batchSize);
//         const processedBatch = processBatch(batch);
//         sendDataToBackend(processedBatch);
//     }
// }

// // Extract and process only visible elements on the screen
// console.log("Extracting data for visible elements...");
// const allElements = Array.from(document.querySelectorAll("*")).filter(isVisible);
// processElementsInBatches(allElements);

// console.log("All visible elements processed.");

// ------------------------------------------

// console.log("Content script is running - ensuring proper ID assignment.");

// // Map to track assigned Web Element IDs
// var elementGroups = new Map();
// let uniqueIdCounter = 1; // Counter for unique Web Element IDs

// // Function to check if an element is visible
// function isVisible(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return (
//         element.offsetWidth > 0 &&
//         element.offsetHeight > 0 &&
//         computedStyles.visibility !== "hidden" &&
//         computedStyles.display !== "none" &&
//         computedStyles.opacity !== "0"
//     );
// }

// // Function to extract only the unique XPath ID (if exists)
// function extractXPathID(xpath) {
//     const idMatch = xpath.match(/@\id=["']([^"']+)["']/);
//     return idMatch ? idMatch[1] : null;
// }

// // Function to generate a relative XPath
// function getXPath(element) {
//     if (!element) return "";

//     if (element.id) {
//         return `//*[@id="${element.id}"]`; // Use ID if available
//     }

//     let pathSegments = [];
//     let currentElement = element;
//     while (currentElement && currentElement !== document.documentElement) {
//         if (currentElement.id) {
//             return `//*[@id="${currentElement.id}"]${pathSegments.reverse().join("")}`;
//         }

//         const parent = currentElement.parentNode;
//         if (!parent) break;

//         let index = 1;
//         const siblings = parent.childNodes;
//         for (let i = 0; i < siblings.length; i++) {
//             const sibling = siblings[i];
//             if (sibling === currentElement) {
//                 pathSegments.push(`/${currentElement.tagName.toLowerCase()}[${index}]`);
//                 break;
//             }
//             if (sibling.nodeType === 1 && sibling.tagName === currentElement.tagName) {
//                 index++;
//             }
//         }

//         currentElement = parent;
//     }

//     return pathSegments.reverse().join("");
// }

// // **Updated Similar XPath Matching: Check XPath ID First**
// function areSimilarXPaths(xpath1, xpath2) {
//     const id1 = extractXPathID(xpath1);
//     const id2 = extractXPathID(xpath2);

//     // If both have the same XPath ID, check for similarity
//     if (id1 && id2 && id1 === id2) {
//         const parts1 = xpath1.split("/");
//         const parts2 = xpath2.split("/");

//         // Ensure both XPaths have enough depth
//         if (parts1.length < 4 || parts2.length < 4) return false;

//         // Compare up to the last 2 parts instead of only the last 3
//         const maxDepth = Math.min(parts1.length, parts2.length) - 2;
//         let matches = 0;

//         for (let i = 0; i < maxDepth; i++) {
//             if (parts1[i] === parts2[i]) {
//                 matches++;
//             }
//         }

//         // Ensure at least 80% structural similarity
//         return matches / maxDepth >= 0.99;
//     }

//     return false; // If the IDs are different, they are not similar
// }

// // Function to get all XPath variations for the same element
// function getAllXPaths(element) {
//     let xpaths = [];
//     let xpath = getXPath(element);
//     xpaths.push(xpath);

//     if (element.id) {
//         xpaths.push(`//*[@id="${element.id}"]`);
//     }
    
//     return xpaths;
// }

// // **Improved Web Element ID Assignment**
// function getOrCreateWebElementId(element) {
//     const currentXPath = getXPath(element);

//     // Check if any existing element has a similar XPath and the same XPath ID
//     for (const [existingXPath, existingId] of elementGroups.entries()) {
//         if (areSimilarXPaths(currentXPath, existingXPath)) {
//             return existingId; // Return the same ID for similar XPaths
//         }
//     }

//     // If no similar XPath exists, assign a new unique ID
//     const newId = `we-${uniqueIdCounter++}`;
//     elementGroups.set(currentXPath, newId);
//     return newId;
// }

// // Process a batch of elements and assign consistent Web Element IDs
// function processBatch(elements) {
//     return elements.map((el) => {
//         if (!isVisible(el)) return null;

//         const xpaths = getAllXPaths(el);
//         const webElementId = getOrCreateWebElementId(el);

//         return {
//             webElementId,
//             xpaths,
//             text: el.textContent.trim().substring(0, 50) || "No text"
//         };
//     }).filter(Boolean);
// }

// // Send data to the backend
// function sendDataToBackend(data) {
//     fetch("http://127.0.0.1:8000/api/extract/", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ elements: data }),
//     })
//     .then((response) => response.json())
//     .then((data) => console.log("Data sent successfully:", data))
//     .catch((error) => console.error("Error sending data:", error));
// }

// // Process elements in batches
// function processElementsInBatches(elements, batchSize = 100) {
//     for (let i = 0; i < elements.length; i += batchSize) {
//         const batch = elements.slice(i, i + batchSize);
//         const processedBatch = processBatch(batch);
//         sendDataToBackend(processedBatch);
//     }
// }

// // Extract all visible elements and process them
// function extractAndProcessElements() {
//     const visibleElements = [...document.body.getElementsByTagName("*")].filter(isVisible);
//     processElementsInBatches(visibleElements);
// }

// // Run the extraction
// extractAndProcessElements();



// ------------ console.log("Content script is running - working properly - only IDs are being assigned now.");

// // Map to track assigned Web Element IDs
// var elementGroups = new Map();
// let uniqueIdCounter = 1; // Counter for unique Web Element IDs

// // Function to check if an element is visible
// function isVisible(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return (
//         element.offsetWidth > 0 &&
//         element.offsetHeight > 0 &&
//         computedStyles.visibility !== "hidden" &&
//         computedStyles.display !== "none" &&
//         computedStyles.opacity !== "0"
//     );
// }

// // Function to generate a relative XPath
// function getXPath(element) {
//     if (!element) return "";

//     if (element.id) {
//         return `//*[@id="${element.id}"]`; // Use ID if available
//     }

//     let pathSegments = [];
//     let currentElement = element;
//     while (currentElement && currentElement !== document.documentElement) {
//         if (currentElement.id) {
//             return `//*[@id="${currentElement.id}"]${pathSegments.reverse().join("")}`;
//         }

//         const parent = currentElement.parentNode;
//         if (!parent) break;

//         let index = 1;
//         const siblings = parent.childNodes;
//         for (let i = 0; i < siblings.length; i++) {
//             const sibling = siblings[i];
//             if (sibling === currentElement) {
//                 pathSegments.push(`/${currentElement.tagName.toLowerCase()}[${index}]`);
//                 break;
//             }
//             if (sibling.nodeType === 1 && sibling.tagName === currentElement.tagName) {
//                 index++;
//             }
//         }

//         currentElement = parent;
//     }

//     return pathSegments.reverse().join("");
// }

// // Get computed styles for an element
// function getStyles(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return {
//         backgroundColor: computedStyles.backgroundColor || "transparent",
//         fontColor: computedStyles.color || "inherit",
//         fontSize: computedStyles.fontSize || "inherit",
//         fontStyle: computedStyles.fontStyle || "normal",
//     };
// }

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

// // Extract meaningful text from an element
// function getElementText(element) {
//     if (!element) return "";

//     if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
//         return element.placeholder?.trim() || "";
//     }

//     if (element.tagName === "BUTTON" || element.tagName === "A") {
//         return element.innerText.trim();
//     }

//     const ariaLabel = element.getAttribute("aria-label");
//     if (ariaLabel) {
//         return ariaLabel.trim();
//     }

//     const ignoreTags = ["SCRIPT", "STYLE", "NOSCRIPT"];
//     if (ignoreTags.includes(element.tagName)) {
//         return "";
//     }

//     let text = "";
//     for (const child of element.childNodes) {
//         if (child.nodeType === Node.TEXT_NODE) {
//             text += child.textContent.trim() + " ";
//         } else if (child.nodeType === Node.ELEMENT_NODE && !isHidden(child)) {
//             text += getElementText(child) + " ";
//         }
//     }

//     return text.trim();
// }

// // Check if an element is hidden
// function isHidden(element) {
//     const computedStyles = window.getComputedStyle(element);
//     return computedStyles.display === "none" || computedStyles.visibility === "hidden" || computedStyles.opacity === "0";
// }

// // Assign a unique Web Element ID to each logical group
// function getOrCreateWebElementId(element) {
//     const xpath = getXPath(element);

//     // Check if this element (or an ancestor) already has an assigned ID
//     let parentElement = element;
//     while (parentElement) {
//         const parentXPath = getXPath(parentElement);
//         if (elementGroups.has(parentXPath)) {
//             return elementGroups.get(parentXPath); // Inherit the parent's ID
//         }
//         parentElement = parentElement.parentElement;
//     }

//     // If no ancestor has an ID, assign a new unique one to this structure
//     const newId = `we-${uniqueIdCounter++}`;
//     elementGroups.set(xpath, newId);
//     return newId;
// }

// // Find the closest meaningful parent category
// function findMeaningfulParent(el) {
//     let current = el;
//     while (current && current.nodeType === Node.ELEMENT_NODE) {
//         if (["li", "div", "section", "article", "nav", "footer"].includes(current.tagName.toLowerCase())) {
//             const categoryName = current.textContent.trim().substring(0, 50);
//             return categoryName.length > 3 ? categoryName : null;
//         }
//         current = current.parentNode;
//     }
//     return null; // No meaningful parent found
// }

// // Process a batch of elements and assign consistent Web Element IDs
// function processBatch(elements) {
//     return elements.map((el) => {
//         if (!isVisible(el)) return null;

//         const xpath = getXPath(el);
//         const styles = getStyles(el);
//         const dimensions = getDimensionsAndPosition(el);
//         const text = getElementText(el);
//         const category = findMeaningfulParent(el);

//         return {
//             webElementId: getOrCreateWebElementId(el), // Assign the same ID to structurally related elements
//             xpath,
//             width: dimensions.width,
//             height: dimensions.height,
//             x: dimensions.x,
//             y: dimensions.y,
//             backgroundColor: styles.backgroundColor,
//             fontColor: styles.fontColor,
//             fontSize: styles.fontSize,
//             fontStyle: styles.fontStyle,
//             text,
//             category,
//         };
//     }).filter(Boolean);
// }

// // Send data to the backend
// function sendDataToBackend(data) {
//     fetch("http://127.0.0.1:8000/api/extract/", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ elements: data }),
//     })
//     .then((response) => response.json())
//     .then((data) => console.log("Data sent successfully:", data))
//     .catch((error) => console.error("Error sending data:", error));
// }

// // Process elements in batches
// function processElementsInBatches(elements, batchSize = 100) {
//     for (let i = 0; i < elements.length; i += batchSize) {
//         const batch = elements.slice(i, i + batchSize);
//         const processedBatch = processBatch(batch);
//         sendDataToBackend(processedBatch);
//     }
// }

// // Extract all visible elements and process them
// function extractAndProcessElements() {
//     const visibleElements = [...document.body.getElementsByTagName("*")].filter(isVisible);
//     processElementsInBatches(visibleElements);
// }

// // Run the extraction
// extractAndProcessElements();



// function getCategoryElements() {
//     const categoryMap = new Map(); // Stores unique IDs for each component
//     let idCounter = 1;
//     const result = [];

//     document.querySelectorAll("*").forEach((el) => {
//         const style = window.getComputedStyle(el);
        
//         // ❌ Ignore scripts, styles, and hidden elements
//         if (
//             el.tagName.toLowerCase() === "script" || 
//             el.tagName.toLowerCase() === "style" || 
//             style.display === "none" || 
//             style.visibility === "hidden" || 
//             el.offsetParent === null
//         ) {
//             return;
//         }

//         // Identify the closest meaningful parent element dynamically
//         let parentCategory = findMeaningfulParent(el);
//         if (parentCategory) {
//             if (!categoryMap.has(parentCategory)) {
//                 categoryMap.set(parentCategory, `we-${idCounter++}`); // Assign same ID to all elements in this group
//             }
//             const categoryID = categoryMap.get(parentCategory);
            
//             result.push({
//                 id: categoryID,
//                 tag: el.tagName.toLowerCase(),
//                 text: el.textContent.trim().substring(0, 50),
//                 xpaths: getRelativeXPath(el), // Use relative XPath
//                 category: parentCategory
//             });
//         }
//     });

//     console.log(result);
//     return result;
// }

// // Function to detect the closest meaningful parent dynamically
// function findMeaningfulParent(el) {
//     let current = el;
//     while (current && current.nodeType === Node.ELEMENT_NODE) {
//         // Detect meaningful containers
//         if (["li", "div", "section", "article", "nav", "footer"].includes(current.tagName.toLowerCase())) {
//             const categoryName = current.textContent.trim().substring(0, 50);
//             return categoryName.length > 3 ? categoryName : null;
//         }
//         current = current.parentNode;
//     }
//     return null; // No meaningful parent found
// }

// // Function to generate a relative XPath
// function getRelativeXPath(element) {
//     if (element.id) {
//         return `//*[@id="${element.id}"]`; // Use ID if available
//     }
//     let path = [];
//     while (element && element.nodeType === Node.ELEMENT_NODE) {
//         let index = 1;
//         let sibling = element.previousElementSibling;
//         while (sibling) {
//             if (sibling.tagName === element.tagName) index++;
//             sibling = sibling.previousElementSibling;
//         }
//         path.unshift(`${element.tagName.toLowerCase()}[${index}]`);
//         element = element.parentNode;
//     }
//     return `./${path.join("/")}`;
// }

// // Run the function
// getCategoryElements();



// function getVisibleElements() {
//     const elements = document.querySelectorAll('*');
//     const visibleElements = [];
//     elements.forEach((el, index) => {
//         const style = window.getComputedStyle(el);
//         if (style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null) {
//             visibleElements.push({
//                 id: `element-${index}`,  // Assign a unique ID
//                 tag: el.tagName,
//                 text: el.textContent.trim().substring(0, 50), // Capture content snippet
//                 xpath: getXPath(el) // Generate XPath
//             });
//         }
//     });
//     return visibleElements;
// }

// function getXPath(element) {
//     if (element.id !== '') return `//*[@id="${element.id}"]`;
//     if (element === document.body) return '/HTML/BODY';
//     let ix = 0;
//     const siblings = element.parentNode.children;
//     for (let i = 0; i < siblings.length; i++) {
//         if (siblings[i] === element) return `${getXPath(element.parentNode)}/${element.tagName}[${ix + 1}]`;
//         if (siblings[i].tagName === element.tagName) ix++;
//     }
// }
// console.log(getVisibleElements());



// // console.log("Content script is running - working not properly - batches with ids");

// // // Map to track assigned Web Element IDs
// // const elementGroups = new Map();
// // let uniqueIdCounter = 1; // Counter for unique Web Element IDs

// // // Function to check if an element is visible
// // function isVisible(element) {
// //     const computedStyles = window.getComputedStyle(element);
// //     return (
// //         element.offsetWidth > 0 &&
// //         element.offsetHeight > 0 &&
// //         computedStyles.visibility !== "hidden" &&
// //         computedStyles.display !== "none" &&
// //         computedStyles.opacity !== "0"
// //     );
// // }

// // // Function to get the relative XPath of an element
// // function getXPath(element) {
// //     if (!element) return "";

// //     if (element.id) {
// //         return `//*[@id="${element.id}"]`;
// //     }

// //     let currentElement = element;
// //     let pathSegments = [];
// //     while (currentElement && currentElement !== document.documentElement) {
// //         if (currentElement.id) {
// //             return `//*[@id="${currentElement.id}"]${pathSegments.reverse().join("")}`;
// //         }

// //         const parent = currentElement.parentNode;
// //         if (!parent) break;

// //         let ix = 0;
// //         const siblings = parent.childNodes;
// //         for (let i = 0; i < siblings.length; i++) {
// //             const sibling = siblings[i];
// //             if (sibling === currentElement) {
// //                 pathSegments.push(`/${currentElement.tagName.toLowerCase()}[${ix + 1}]`);
// //                 break;
// //             }
// //             if (sibling.nodeType === 1 && sibling.tagName === currentElement.tagName) {
// //                 ix++;
// //             }
// //         }

// //         currentElement = parent;
// //     }

// //     return pathSegments.reverse().join("");
// // }

// // // Get computed styles for an element
// // function getStyles(element) {
// //     const computedStyles = window.getComputedStyle(element);
// //     return {
// //         backgroundColor: computedStyles.backgroundColor || "transparent",
// //         fontColor: computedStyles.color || "inherit",
// //         fontSize: computedStyles.fontSize || "inherit",
// //         fontStyle: computedStyles.fontStyle || "normal",
// //     };
// // }

// // // Get dimensions and position of an element
// // function getDimensionsAndPosition(element) {
// //     const rect = element.getBoundingClientRect();
// //     return {
// //         width: rect.width || 0,
// //         height: rect.height || 0,
// //         x: rect.x || 0,
// //         y: rect.y || 0,
// //     };
// // }

// // // Extract meaningful text from an element
// // function getElementText(element) {
// //     if (!element) return "";

// //     if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
// //         return element.placeholder?.trim() || "";
// //     }

// //     if (element.tagName === "BUTTON" || element.tagName === "A") {
// //         return element.innerText.trim();
// //     }

// //     const ariaLabel = element.getAttribute("aria-label");
// //     if (ariaLabel) {
// //         return ariaLabel.trim();
// //     }

// //     const ignoreTags = ["SCRIPT", "STYLE", "NOSCRIPT"];
// //     if (ignoreTags.includes(element.tagName)) {
// //         return "";
// //     }

// //     let text = "";
// //     for (const child of element.childNodes) {
// //         if (child.nodeType === Node.TEXT_NODE) {
// //             text += child.textContent.trim() + " ";
// //         } else if (child.nodeType === Node.ELEMENT_NODE && !isHidden(child)) {
// //             text += getElementText(child) + " ";
// //         }
// //     }

// //     return text.trim();
// // }

// // // Check if an element is hidden
// // function isHidden(element) {
// //     const computedStyles = window.getComputedStyle(element);
// //     return computedStyles.display === "none" || computedStyles.visibility === "hidden" || computedStyles.opacity === "0";
// // }

// // // Assign a unique Web Element ID to each logical group
// // function getOrCreateWebElementId(element) {
// //     const xpath = getXPath(element);
    
// //     // Check if this element (or an ancestor) already has an assigned ID
// //     let parentElement = element;
// //     while (parentElement) {
// //         const parentXPath = getXPath(parentElement);
// //         if (elementGroups.has(parentXPath)) {
// //             return elementGroups.get(parentXPath); // Inherit the parent's ID
// //         }
// //         parentElement = parentElement.parentElement;
// //     }

// //     // If no ancestor has an ID, assign a new unique one to this structure
// //     const newId = `we${uniqueIdCounter++}`;
// //     elementGroups.set(xpath, newId);
// //     return newId;
// // }

// // // Process a batch of elements and assign consistent Web Element IDs
// // function processBatch(elements) {
// //     return elements.map((el) => {
// //         const xpath = getXPath(el);
// //         const styles = getStyles(el);
// //         const dimensions = getDimensionsAndPosition(el);
// //         const text = getElementText(el);

// //         return {
// //             webElementId: getOrCreateWebElementId(el), // Assign the same ID to structurally related elements
// //             xpath,
// //             width: dimensions.width,
// //             height: dimensions.height,
// //             x: dimensions.x,
// //             y: dimensions.y,
// //             backgroundColor: styles.backgroundColor,
// //             fontColor: styles.fontColor,
// //             fontSize: styles.fontSize,
// //             fontStyle: styles.fontStyle,
// //             text,
// //         };
// //     });
// // }

// // // Send data to the backend
// // function sendDataToBackend(data) {
// //     fetch("http://127.0.0.1:8000/api/extract/", {
// //         method: "POST",
// //         headers: {
// //             "Content-Type": "application/json",
// //         },
// //         body: JSON.stringify({ elements: data }),
// //     })
// //     .then((response) => response.json())
// //     .then((data) => console.log("Data sent successfully:", data))
// //     .catch((error) => console.error("Error sending data:", error));
// // }

// // // Process elements in batches
// // function processElementsInBatches(elements, batchSize = 100) {
// //     for (let i = 0; i < elements.length; i += batchSize) {
// //         const batch = elements.slice(i, i + batchSize);
// //         const processedBatch = processBatch(batch);
// //         sendDataToBackend(processedBatch);
// //     }
// // }

// // // Extract and process only visible elements on the screen
// // console.log("Extracting data for visible elements...");
// // const allElements = Array.from(document.querySelectorAll("*")).filter(isVisible);
// // processElementsInBatches(allElements);

// // console.log("All visible elements processed.");


// // console.log("Content script is running - working properly - btaches");

// // // Check if an element is visible on the screen
// // // function isVisible(element) {
// // //     const rect = element.getBoundingClientRect();
// // //     const computedStyles = window.getComputedStyle(element);
// // //     const isInViewport = (
// // //         rect.top >= 0 &&
// // //         rect.left >= 0 &&
// // //         rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
// // //         rect.right <= (window.innerWidth || document.documentElement.clientWidth)
// // //     );
// // //     return (
// // //         rect.width > 0 &&
// // //         rect.height > 0 &&
// // //         computedStyles.visibility !== "hidden" &&
// // //         computedStyles.display !== "none" &&
// // //         isInViewport // Ensure the element is within the viewport
// // //     );
// // // }

// // function isVisible(element) {
// //     const computedStyles = window.getComputedStyle(element);
// //     return (
// //         element.offsetWidth > 0 &&
// //         element.offsetHeight > 0 &&
// //         computedStyles.visibility !== "hidden" &&
// //         computedStyles.display !== "none" &&
// //         computedStyles.opacity !== "0"
// //     );
// // }

// // // Generate relative XPath for an element, starting from the nearest ancestor with an ID
// // function getXPath(element) {
// //     if (!element) return "";

// //     // If the element has an ID, use it for the XPath
// //     if (element.id) {
// //         return `//*[@id="${element.id}"]`;
// //     }

// //     // Traverse up the DOM tree to find the nearest ancestor with an ID
// //     let currentElement = element;
// //     let pathSegments = [];
// //     while (currentElement && currentElement !== document.documentElement) {
// //         if (currentElement.id) {
// //             // If an ancestor with an ID is found, build the XPath from there
// //             return `//*[@id="${currentElement.id}"]${pathSegments.reverse().join("")}`;
// //         }

// //         // Calculate the position of the current element among its siblings with the same tag name
// //         const parent = currentElement.parentNode;
// //         if (!parent) break;

// //         let ix = 0;
// //         const siblings = parent.childNodes;
// //         for (let i = 0; i < siblings.length; i++) {
// //             const sibling = siblings[i];
// //             if (sibling === currentElement) {
// //                 pathSegments.push(`/${currentElement.tagName.toLowerCase()}[${ix + 1}]`);
// //                 break;
// //             }
// //             if (sibling.nodeType === 1 && sibling.tagName === currentElement.tagName) {
// //                 ix++;
// //             }
// //         }

// //         currentElement = parent;
// //     }

// //     // If no ancestor with an ID is found, return the full path from the root
// //     return pathSegments.reverse().join("");
// // }

// // // Get computed styles for an element
// // function getStyles(element) {
// //     const computedStyles = window.getComputedStyle(element);
// //     return {
// //         backgroundColor: computedStyles.backgroundColor || "transparent",
// //         fontColor: computedStyles.color || "inherit",
// //         fontSize: computedStyles.fontSize || "inherit",
// //         fontStyle: computedStyles.fontStyle || "normal",
// //     };
// // }

// // // Get dimensions and position of an element
// // function getDimensionsAndPosition(element) {
// //     const rect = element.getBoundingClientRect();
// //     return {
// //         width: rect.width || 0,
// //         height: rect.height || 0,
// //         x: rect.x || 0,
// //         y: rect.y || 0,
// //     };
// // }

// // // // Extract meaningful text from an element
// // // function getElementText(element) {
// // //     if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
// // //         return element.placeholder || "";
// // //     } else if (element.tagName === "BUTTON") {
// // //         return element.textContent.trim();
// // //     } else {
// // //         return element.textContent.trim();
// // //     }
// // // }

// // function getElementText(element) {
// //     if (!element) return "";

// //     // Handle input fields (text inside placeholders)
// //     if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
// //         return element.placeholder?.trim() || "";
// //     }

// //     // Handle buttons
// //     if (element.tagName === "BUTTON") {
// //         return element.innerText.trim();
// //     }

// //     // Handle links (use text inside <a> tags)
// //     if (element.tagName === "A") {
// //         return element.innerText.trim();
// //     }

// //     // Handle elements with `aria-label`
// //     const ariaLabel = element.getAttribute("aria-label");
// //     if (ariaLabel) {
// //         return ariaLabel.trim();
// //     }

// //     // Ignore unwanted elements
// //     const ignoreTags = ["SCRIPT", "STYLE", "NOSCRIPT"];
// //     if (ignoreTags.includes(element.tagName)) {
// //         return "";
// //     }

// //     // Extract meaningful text (ignoring hidden content)
// //     let text = "";
// //     for (const child of element.childNodes) {
// //         if (child.nodeType === Node.TEXT_NODE) {
// //             text += child.textContent.trim() + " ";
// //         } else if (child.nodeType === Node.ELEMENT_NODE && !isHidden(child)) {
// //             text += getElementText(child) + " ";
// //         }
// //     }

// //     return text.trim();
// // }

// // // Check if an element is hidden
// // function isHidden(element) {
// //     const computedStyles = window.getComputedStyle(element);
// //     return computedStyles.display === "none" || computedStyles.visibility === "hidden" || computedStyles.opacity === "0";
// // }

// // // Process a batch of elements
// // function processBatch(elements) {
// //     return elements.map((el) => {
// //         const xpath = getXPath(el);
// //         const styles = getStyles(el);
// //         const dimensions = getDimensionsAndPosition(el);
// //         const text = getElementText(el);

// //         return {
// //             xpath,
// //             width: dimensions.width,
// //             height: dimensions.height,
// //             x: dimensions.x,
// //             y: dimensions.y,
// //             backgroundColor: styles.backgroundColor,
// //             fontColor: styles.fontColor,
// //             fontSize: styles.fontSize,
// //             fontStyle: styles.fontStyle,
// //             text,
// //         };
// //     });
// // }

// // // Send data to the backend
// // function sendDataToBackend(data) {
// //     fetch("http://127.0.0.1:8000/api/extract/", {
// //         method: "POST",
// //         headers: {
// //             "Content-Type": "application/json",
// //         },
// //         body: JSON.stringify({ elements: data }),
// //     })
// //     .then((response) => response.json())
// //     .then((data) => console.log("Data sent successfully:", data))
// //     .catch((error) => console.error("Error sending data:", error));
// // }

// // // Process elements in batches
// // function processElementsInBatches(elements, batchSize = 100) {
// //     for (let i = 0; i < elements.length; i += batchSize) {
// //         const batch = elements.slice(i, i + batchSize);
// //         const processedBatch = processBatch(batch);
// //         sendDataToBackend(processedBatch);
// //     }
// // }

// // // Extract and process only visible elements on the screen
// // console.log("Extracting data for visible elements...");
// // const allElements = Array.from(document.querySelectorAll("*")).filter(isVisible);
// // processElementsInBatches(allElements);

// // console.log("All visible elements processed.");

// //----------------------------------------------------------------
// // console.log("Content script is running - working properly");

// // function isVisible(element) {
// //     const rect = element.getBoundingClientRect();
// //     const computedStyles = window.getComputedStyle(element);
// //     return (
// //         rect.width > 0 &&
// //         rect.height > 0 &&
// //         computedStyles.visibility !== "hidden" &&
// //         computedStyles.display !== "none"
// //     );
// // }

// // function getXPath(element) {
// //     console.log("inside getXPath");
// //     if (!element) {
// //         console.log("Element is null or undefined.");
// //         return "";
// //     }
// //     if (element.id) {
// //         console.log(`Element has ID: ${element.id}`);
// //         return `//*[@id="${element.id}"]`;
// //     }
// //     if (element === document.documentElement) {
// //         console.log("Element is <html>");
// //         return "/html";
// //     }
// //     if (element === document.body) {
// //         console.log("Element is <body>");
// //         return "/html/body";
// //     }

// //     const parent = element.parentNode;
// //     if (!parent) {
// //         console.log("Parent node is null.");
// //         return "";
// //     }

// //     let ix = 0; // Index for sibling elements with the same tag name
// //     const siblings = parent.childNodes;
// //     for (let i = 0; i < siblings.length; i++) {
// //         const sibling = siblings[i];
// //         if (sibling === element) {
// //             console.log(`Matched element. XPath so far: ${getXPath(parent)}/${element.tagName.toLowerCase()}[${ix + 1}]`);
// //             return `${getXPath(parent)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
// //         }
// //         if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
// //             ix++; // Increment index for matching sibling
// //         }
// //     }

// //     return "";
// // }

// // function getStyles(element) {
// //     console.log("inside getStyles for element:", element);
// //     const computedStyles = window.getComputedStyle(element);
// //     return {
// //         backgroundColor: computedStyles.backgroundColor || "transparent",
// //         fontColor: computedStyles.color || "inherit",
// //         fontSize: computedStyles.fontSize || "inherit",
// //         fontStyle: computedStyles.fontStyle || "normal",
// //     };
// // }

// // function getDimensionsAndPosition(element) {
// //     console.log("inside getDimensionsAndPosition for element:", element);
// //     const rect = element.getBoundingClientRect();
// //     return {
// //         width: rect.width || 0,
// //         height: rect.height || 0,
// //         x: rect.x || 0,
// //         y: rect.y || 0,
// //     };
// // }

// // function getElementText(element) {
// //     console.log("inside getElementText for element:", element);

// //     // Extract meaningful text
// //     if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
// //         return element.placeholder || ""; // Use placeholder for inputs
// //     } else if (element.tagName === "BUTTON") {
// //         return element.textContent.trim(); // Button text
// //     } else {
// //         return element.textContent.trim(); // Visible text
// //     }
// // }

// // console.log("Extracting data for visible elements...");
// // const elementsData = Array.from(document.querySelectorAll("*"))
// //     .filter((el) => isVisible(el)) // Filter only visible elements
// //     .map((el) => {
// //         console.log("Processing element:", el);
// //         const xpath = getXPath(el);
// //         const styles = getStyles(el);
// //         const dimensions = getDimensionsAndPosition(el);
// //         const text = getElementText(el);

// //         const elementData = {
// //             xpath,
// //             width: dimensions.width,
// //             height: dimensions.height,
// //             x: dimensions.x,
// //             y: dimensions.y,
// //             backgroundColor: styles.backgroundColor,
// //             fontColor: styles.fontColor,
// //             fontSize: styles.fontSize,
// //             fontStyle: styles.fontStyle,
// //             text, // Extracted meaningful text
// //         };

// //         console.log("Extracted data for element:", elementData);
// //         return elementData;
// //     });

// // console.log("All extracted visible elements data:", elementsData);

// // console.log("Sending data to backend...");
// // fetch("http://127.0.0.1:8000/api/extract/", {
// //     method: "POST",
// //     headers: {
// //         "Content-Type": "application/json",
// //     },
// //     body: JSON.stringify({ elements: elementsData }),
// // })
// //     .then((response) => {
// //         console.log("Response received from backend:", response);
// //         return response.json();
// //     })
// //     .then((data) => console.log("Data sent successfully:", data))
// //     .catch((error) => console.error("Error sending data:", error));


// // --------------------------------------------------------------------------------------------------------------------------

// // console.log("Content script is running");

// // function getXPath(element) {
// //     console.log("inside getXpath");
// //     if (!element) return ""; // Handle null or undefined elements
// //     if (element.id) return `//*[@id="${element.id}"]`; // Use ID if available
// //     if (element === document.documentElement) return "/html"; // Base case for <html>
// //     if (element === document.body) return "/html/body"; // Base case for <body>

// //     const parent = element.parentNode;
// //     if (!parent) return ""; // If parentNode is null, return empty string

// //     let ix = 0; // Index for sibling elements with the same tag name
// //     const siblings = parent.childNodes;
// //     for (let i = 0; i < siblings.length; i++) {
// //         const sibling = siblings[i];
// //         if (sibling === element) {
// //             console.log(getXPath(parent)}/${element.tagName.toLowerCase()}[${ix + 1}]);
// //             return `${getXPath(parent)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
// //         }
// //         if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
// //             ix++; // Increment index for matching sibling
// //         }
// //     }

// //     return "";
// // }

// // // Function to get computed styles
// // function getStyles(element) {
// //     console.log("inside getStyles");
// //     const computedStyles = window.getComputedStyle(element);
// //     return {
// //         backgroundColor: computedStyles.backgroundColor || "transparent",
// //         fontColor: computedStyles.color || "inherit",
// //         fontSize: computedStyles.fontSize || "inherit",
// //         fontStyle: computedStyles.fontStyle || "normal",
// //     };
// // }

// // // Function to get dimensions and position
// // function getDimensionsAndPosition(element) {
// //     console.log("inside getDimensionsAndPosition");

// //     const rect = element.getBoundingClientRect();
// //     return {
// //         width: rect.width || 0,
// //         height: rect.height || 0,
// //         x: rect.x || 0,
// //         y: rect.y || 0,
// //     };
// // }

// // // Extract data for all elements
// // const elementsData = Array.from(document.querySelectorAll("*"))
// //     .filter((el) => el.textContent.trim().length > 0) // Exclude elements without visible text
// //     .map((el) => {
// //         const xpath = getXPath(el);
// //         const styles = getStyles(el);
// //         const dimensions = getDimensionsAndPosition(el);

// //         return {
// //             xpath,
// //             width: dimensions.width,
// //             height: dimensions.height,
// //             x: dimensions.x,
// //             y: dimensions.y,
// //             backgroundColor: styles.backgroundColor,
// //             fontColor: styles.fontColor,
// //             fontSize: styles.fontSize,
// //             fontStyle: styles.fontStyle,
// //             text: el.textContent.trim(),
// //         };
// //     });

// // // Send extracted data to the backend
// // fetch("http://127.0.0.1:8000/api/extract/", {
// //     method: "POST",
// //     headers: {
// //         "Content-Type": "application/json",
// //     },
// //     body: JSON.stringify({ elements: elementsData }),
// // })
// //     .then((response) => response.json())
// //     .then((data) => console.log("Data sent successfully:", data))
// //     .catch((error) => console.error("Error sending data:", error));



// // --------------------------------------------------------------------------------------------------------------------------

// // console.log("Content script is running - working - only thing wrong is weird text and for all tags its coming");

// // function getXPath(element) {
// //     console.log("inside getXPath");
// //     if (!element) {
// //         console.log("Element is null or undefined.");
// //         return "";
// //     }
// //     if (element.id) {
// //         console.log(`Element has ID: ${element.id}`);
// //         return `//*[@id="${element.id}"]`;
// //     }
// //     if (element === document.documentElement) {
// //         console.log("Element is <html>");
// //         return "/html";
// //     }
// //     if (element === document.body) {
// //         console.log("Element is <body>");
// //         return "/html/body";
// //     }

// //     const parent = element.parentNode;
// //     if (!parent) {
// //         console.log("Parent node is null.");
// //         return "";
// //     }

// //     let ix = 0; // Index for sibling elements with the same tag name
// //     const siblings = parent.childNodes;
// //     console.log("Siblings of the element:", siblings);

// //     for (let i = 0; i < siblings.length; i++) {
// //         const sibling = siblings[i];
// //         if (sibling === element) {
// //             console.log(`Matched element. XPath so far: ${getXPath(parent)}/${element.tagName.toLowerCase()}[${ix + 1}]`);
// //             return `${getXPath(parent)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
// //         }
// //         if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
// //             ix++; // Increment index for matching sibling
// //         }
// //     }

// //     return "";
// // }

// // // Function to get computed styles
// // function getStyles(element) {
// //     console.log("inside getStyles for element:", element);
// //     const computedStyles = window.getComputedStyle(element);
// //     console.log("Computed styles:", computedStyles);
// //     return {
// //         backgroundColor: computedStyles.backgroundColor || "transparent",
// //         fontColor: computedStyles.color || "inherit",
// //         fontSize: computedStyles.fontSize || "inherit",
// //         fontStyle: computedStyles.fontStyle || "normal",
// //     };
// // }

// // // Function to get dimensions and position
// // function getDimensionsAndPosition(element) {
// //     console.log("inside getDimensionsAndPosition for element:", element);
// //     const rect = element.getBoundingClientRect();
// //     console.log("Element rect:", rect);
// //     return {
// //         width: rect.width || 0,
// //         height: rect.height || 0,
// //         x: rect.x || 0,
// //         y: rect.y || 0,
// //     };
// // }

// // // Extract data for all elements
// // console.log("Extracting data for all elements...");
// // const elementsData = Array.from(document.querySelectorAll("*"))
// //     .filter((el) => el.textContent.trim().length > 0) // Exclude elements without visible text
// //     .map((el) => {
// //         console.log("Processing element:", el);
// //         const xpath = getXPath(el);
// //         const styles = getStyles(el);
// //         const dimensions = getDimensionsAndPosition(el);

// //         const elementData = {
// //             xpath,
// //             width: dimensions.width,
// //             height: dimensions.height,
// //             x: dimensions.x,
// //             y: dimensions.y,
// //             backgroundColor: styles.backgroundColor,
// //             fontColor: styles.fontColor,
// //             fontSize: styles.fontSize,
// //             fontStyle: styles.fontStyle,
// //             text: el.textContent.trim(),
// //         };

// //         console.log("Extracted data for element:", elementData);
// //         return elementData;
// //     });

// // console.log("All extracted elements data:", elementsData);

// // // Send extracted data to the backend
// // console.log("Sending data to backend...");
// // fetch("http://127.0.0.1:8000/api/extract/", {
// //     method: "POST",
// //     headers: {
// //         "Content-Type": "application/json",
// //     },
// //     body: JSON.stringify({ elements: elementsData }),
// // })
// //     .then((response) => {
// //         console.log("Response received from backend:", response);
// //         return response.json();
// //     })
// //     .then((data) => console.log("Data sent successfully:", data))
// //     .catch((error) => console.error("Error sending data:", error));

