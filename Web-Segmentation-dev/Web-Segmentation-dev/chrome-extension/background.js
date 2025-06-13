// chrome.action.onClicked.addListener((tab) => {
//     if (tab) {
//       console.log(`Current Tab URL: ${tab.url}`);
//       console.log(`Current Tab Title: ${tab.title}`);
//     } else {
//       console.error("No active tab found.");
//     }
//   });
  
console.log("Background is running script is running");

chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.url.startsWith("http")) {
        console.error("Invalid tab URL.");
        return;
    }

    console.log(`Processing tab: ${tab.url}`);

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
    });
});
