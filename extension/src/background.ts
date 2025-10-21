// Background script to handle API calls and bypass CORS
console.log("[Background] Service worker initialized");

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Received message:", request.action);

  if (request.action === "fetchPolymarketData") {
    const { slug } = request;

    // Make the fetch request from background (bypasses CORS)
    fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("[Background] Successfully fetched Polymarket data");
        sendResponse({ success: true, data });
      })
      .catch((error) => {
        console.error("[Background] Fetch error:", error);
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    // Return true to indicate we'll respond asynchronously
    return true;
  }
});
