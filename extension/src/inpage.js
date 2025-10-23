// Inpage Script - Runs in main page context with access to window.ethereum
// This script has access to MetaMask's injected provider

console.log("[Inpage Script] Loaded in main page context");

// Check for MetaMask
const checkWallet = () => {
  if (typeof window.ethereum !== "undefined") {
    console.log("[Inpage Script] ✓ MetaMask detected");
    return true;
  }
  console.log("[Inpage Script] ✗ No MetaMask detected");
  return false;
};

// Listen for wallet connection requests from content script
window.addEventListener("WHISPERS_CONNECT_WALLET", async (event) => {
  console.log("[Inpage Script] Received wallet connection request");

  try {
    if (!window.ethereum) {
      throw new Error(
        "MetaMask not detected. Please install MetaMask extension."
      );
    }

    console.log("[Inpage Script] Requesting MetaMask accounts...");

    // Request account access from MetaMask
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No MetaMask accounts found. Please unlock MetaMask.");
    }

    const userAddress = accounts[0];
    console.log("[Inpage Script] MetaMask connected:", userAddress);

    // Get user signature for authentication
    const timestamp = Date.now();
    const message = `Sign this message to authorize Polymarket trading.\n\nThis signature proves you own this wallet.\n\nTimestamp: ${timestamp}`;

    console.log("[Inpage Script] Requesting signature...");

    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [message, userAddress],
    });

    console.log("[Inpage Script] ✓ Signature obtained");

    // Send success response back to content script
    window.dispatchEvent(
      new CustomEvent("WHISPERS_WALLET_RESPONSE", {
        detail: {
          success: true,
          address: userAddress,
          signature: signature,
          timestamp: timestamp,
        },
      })
    );
  } catch (error) {
    console.error("[Inpage Script] Wallet connection failed:", error);

    // Send error response back to content script
    window.dispatchEvent(
      new CustomEvent("WHISPERS_WALLET_RESPONSE", {
        detail: {
          success: false,
          error: error.message || "Failed to connect wallet",
        },
      })
    );
  }
});

// Listen for EIP-712 typed data signing (for Polymarket orders)
window.addEventListener("WHISPERS_SIGN_TYPED_DATA", async (event) => {
  console.log("[Inpage Script] Received typed data signing request");

  try {
    if (!window.ethereum) {
      throw new Error("MetaMask not detected");
    }

    const { domain, types, message } = event.detail;

    // Get current account
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No MetaMask account connected");
    }

    const address = accounts[0];

    console.log("[Inpage Script] Requesting EIP-712 signature...");

    // Request EIP-712 signature
    const signature = await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [
        address,
        JSON.stringify({
          domain,
          types,
          primaryType: "Order",
          message,
        }),
      ],
    });

    console.log("[Inpage Script] ✓ EIP-712 signature obtained");

    window.dispatchEvent(
      new CustomEvent("WHISPERS_TYPED_DATA_RESPONSE", {
        detail: {
          success: true,
          signature: signature,
          address: address,
        },
      })
    );
  } catch (error) {
    console.error("[Inpage Script] EIP-712 signing failed:", error);

    window.dispatchEvent(
      new CustomEvent("WHISPERS_TYPED_DATA_RESPONSE", {
        detail: {
          success: false,
          error: error.message || "Failed to sign typed data",
        },
      })
    );
  }
});

// Listen for transaction signing (for USDC approval)
window.addEventListener("WHISPERS_SEND_TRANSACTION", async (event) => {
  console.log("[Inpage Script] Received transaction send request");

  try {
    if (!window.ethereum) {
      throw new Error("MetaMask not detected");
    }

    const { transaction } = event.detail;

    console.log("[Inpage Script] Requesting transaction approval...");

    // Send transaction via MetaMask
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [transaction],
    });

    console.log("[Inpage Script] ✓ Transaction sent:", txHash);

    window.dispatchEvent(
      new CustomEvent("WHISPERS_TRANSACTION_RESPONSE", {
        detail: {
          success: true,
          txHash: txHash,
        },
      })
    );
  } catch (error) {
    console.error("[Inpage Script] Transaction failed:", error);

    window.dispatchEvent(
      new CustomEvent("WHISPERS_TRANSACTION_RESPONSE", {
        detail: {
          success: false,
          error: error.message || "Transaction failed",
        },
      })
    );
  }
});

// Initial wallet check
setTimeout(checkWallet, 100);

console.log("[Inpage Script] ✓ Event listeners registered");
