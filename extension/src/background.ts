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

  // Execute trade via Vincent backend
  if (request.action === "backendExecuteTrade") {
    const { params } = request;

    console.log("[Background] Executing trade via backend:", params);

    (async () => {
      try {
        const BACKEND_URL = "http://localhost:3000";

        const response = await fetch(`${BACKEND_URL}/api/trade/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${params.authToken || "mock-jwt-token"}`,
          },
          body: JSON.stringify({
            tokenId: params.tokenId,
            side: params.side,
            price: params.price,
            amount: params.amount,
            userAddress: params.userAddress,
            pkpPublicKey: params.pkpPublicKey,
            orderType: params.orderType || "GTC",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Trade failed: ${response.statusText}`
          );
        }

        const result = await response.json();
        console.log("[Background] ✓ Trade executed successfully");
        sendResponse(result);
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

  // Check backend health
  if (request.action === "backendHealthCheck") {
    console.log("[Background] Checking backend health...");

    (async () => {
      try {
        const BACKEND_URL = "http://localhost:3000";
        const response = await fetch(`${BACKEND_URL}/health`);
        const result = await response.json();
        console.log("[Background] Backend health:", result);
        sendResponse(result);
      } catch (error: unknown) {
        console.error("[Background] Health check failed:", error);
        sendResponse({
          status: "ERROR",
          litInitialized: false,
          error: error instanceof Error ? error.message : "Network error",
        });
      }
    })();

    return true; // Keep channel open for async response
  }

  // Get balance from backend
  if (request.action === "backendGetBalance") {
    const { address } = request;

    console.log("[Background] Getting balance for:", address);

    (async () => {
      try {
        const BACKEND_URL = "http://localhost:3000";
        const response = await fetch(`${BACKEND_URL}/api/balance/${address}`);

        if (!response.ok) {
          throw new Error(`Balance check failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log("[Background] Balance:", result.balance);
        sendResponse(result);
      } catch (error: unknown) {
        console.error("[Background] Balance check failed:", error);
        sendResponse({
          balance: "0",
          error: error instanceof Error ? error.message : "Network error",
        });
      }
    })();

    return true; // Keep channel open for async response
  }

  // Precheck trade via backend
  if (request.action === "backendPrecheck") {
    const { params } = request;

    console.log("[Background] Precheck trade:", params);

    (async () => {
      try {
        const BACKEND_URL = "http://localhost:3000";
        const response = await fetch(`${BACKEND_URL}/api/trade/precheck`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`Precheck failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log("[Background] Precheck result:", result);
        sendResponse(result);
      } catch (error: unknown) {
        console.error("[Background] Precheck failed:", error);
        sendResponse({
          success: false,
          reason: error instanceof Error ? error.message : "Network error",
        });
      }
    })();

    return true; // Keep channel open for async response
  }

  return false;
});
