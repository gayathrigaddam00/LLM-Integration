// console.log("Content script is running - sel");

// // Extract the full HTML of the current page
// var pageHTML = document.documentElement.outerHTML;

// // Send the HTML to the backend
// fetch("http://127.0.0.1:8000/api/extract-html/", {
//     method: "POST",
//     headers: {
//         "Content-Type": "application/json",
//     },
//     body: JSON.stringify({ html: pageHTML }),
// })
//     .then((response) => response.json())
//     .then((data) => console.log("HTML sent successfully:", data))
//     .catch((error) => console.error("Error sending HTML:", error));

(() => {
    console.log("Content script is running - sel");

    // Extract the full HTML of the current page
    const pageHTML = document.documentElement.outerHTML;

    // Send the HTML to the backend
    fetch("http://127.0.0.1:8000/api/extract-html/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ html: pageHTML }),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => console.log("HTML sent successfully:", data))
        .catch((error) => console.error("Error sending HTML:", error));
})();
