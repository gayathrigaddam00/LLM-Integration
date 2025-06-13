// chrome.action.onClicked.addListener(async (tab) => {
//     if (!tab.url.startsWith("http")) {
//         console.error("Invalid tab URL. -sel");
//         return;
//     }

//     console.log(`Injecting content script into tab: ${tab.url} - sel`);

//     chrome.scripting.executeScript({
//         target: { tabId: tab.id },
//         files: ["content.js"],
//     });
// });

console.log(`background.js - sel`);
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.url.startsWith("http")) {
        console.error("Invalid tab URL.- sel");
        return;
    }
    console.log(`Injecting content script into tab: ${tab.url} - sel`);
    // Inject the content script only if not already injected
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"], // Inject content.js
    });
});

