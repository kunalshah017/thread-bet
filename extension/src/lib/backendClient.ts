/**
 * Backend API Client
 *
 * Handles communication with the Whispers backend server
 * All requests are proxied through the background script to bypass CORS
 */

/**
 * Check if a trade passes validation
 */
export async function backendPrecheck(params: {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  amount: number;
  userAddress: string;
}): Promise<{
  success: boolean;
  reason?: string;
  details?: {
    balance: number;
    allowance: number;
    required: number;
  };
}> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "backendPrecheck",
        params,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Backend] Precheck error:", chrome.runtime.lastError);
          resolve({
            success: false,
            reason:
              chrome.runtime.lastError.message ||
              "Extension communication error",
          });
          return;
        }
        resolve(response);
      }
    );
  });
}

/**
 * Execute a trade via the backend
 */
export async function backendExecuteTrade(params: {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  amount: number;
  userAddress: string;
  authToken?: string;
  pkpPublicKey?: string;
  orderType?: string;
}): Promise<{
  success: boolean;
  orderId?: string;
  signature?: string;
  message?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "backendExecuteTrade",
        params,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Backend] Trade execution error:",
            chrome.runtime.lastError
          );
          resolve({
            success: false,
            error:
              chrome.runtime.lastError.message ||
              "Extension communication error",
          });
          return;
        }
        resolve(response);
      }
    );
  });
}

/**
 * Get USDC balance for an address
 */
export async function backendGetBalance(address: string): Promise<{
  balance: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "backendGetBalance",
        address,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Backend] Balance check error:",
            chrome.runtime.lastError
          );
          resolve({
            balance: "0",
            error:
              chrome.runtime.lastError.message ||
              "Extension communication error",
          });
          return;
        }
        resolve(response);
      }
    );
  });
}

/**
 * Check backend health
 */
export async function backendHealthCheck(): Promise<{
  status: string;
  litInitialized: boolean;
  delegateeAddress?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "backendHealthCheck",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Backend] Health check error:",
            chrome.runtime.lastError
          );
          resolve({
            status: "ERROR",
            litInitialized: false,
            error:
              chrome.runtime.lastError.message ||
              "Extension communication error",
          });
          return;
        }
        resolve(response);
      }
    );
  });
}
