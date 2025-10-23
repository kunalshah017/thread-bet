/**
 * Background Service Worker
 *
 * Handles:
 * - API calls (bypasses CORS)
 * - Vincent authentication flow
 * - Transaction signing and broadcasting
 */

// Load polyfills first
import "./polyfills";

// Note: Vincent auth is now handled in content script since it needs window.ethereum
// import {
//   initializeLitClient,
//   authenticateWithMetaMask,
//   storeVincentAuth,
// } from "./lib/vincentClient";
// import {
//   buildApprovalTransaction,
//   buildOrderTransaction,
// } from "./lib/polymarketTrading";

console.log("[Background] Service worker initialized");

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("[Background] Received message:", request.action);

  // Fetch Polymarket event data
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

    return true; // Keep channel open for async response
  }

  // Store Vincent Auth (called from content script after MetaMask interaction)
  if (request.action === "storeVincentAuth") {
    console.log("[Background] Storing Vincent auth...");

    (async () => {
      try {
        const { auth } = request;

        // Store in chrome.storage.local
        await chrome.storage.local.set({
          vincent_auth: {
            pkpPublicKey: auth.pkpPublicKey,
            pkpEthAddress: auth.pkpEthAddress,
            pkpTokenId: auth.pkpTokenId,
            authMethodType: auth.authMethodType,
            timestamp: Date.now(),
          },
        });

        console.log("[Background] ✓ Vincent auth stored");

        sendResponse({
          success: true,
        });
      } catch (error: unknown) {
        console.error("[Background] Failed to store auth:", error);
        sendResponse({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to store auth",
        });
      }
    })();

    return true; // Keep channel open for async response
  }

  // Execute trade via Vincent
  if (request.action === "executeTrade") {
    const { order } = request;

    console.log("[Background] Executing trade:", order);

    (async () => {
      try {
        // TODO: Implement full trading flow:
        // 1. Check USDC allowance
        // 2. If needed, approve USDC
        // 3. Build order transaction
        // 4. Sign with Vincent PKP
        // 5. Broadcast to Polygon

        // For MVP, simulate success
        const mockTxHash = "0x" + Math.random().toString(16).slice(2, 66);

        console.log("[Background] ✓ Trade executed (simulated)");
        sendResponse({
          success: true,
          txHash: mockTxHash,
        });
      } catch (error: unknown) {
        console.error("[Background] Trade execution failed:", error);
        sendResponse({
          success: false,
          error:
            error instanceof Error ? error.message : "Trade execution failed",
        });
      }
    })();

    return true; // Keep channel open for async response
  }

  return false;
});
