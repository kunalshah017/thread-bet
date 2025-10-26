/**
 * Vincent Authentication Module (Frontend)
 *
 * Handles user authentication flow with Vincent Dashboard and backend
 */

const BACKEND_URL = "http://localhost:3000";

export interface VincentUser {
  pkpAddress: string;
  authMethod: string;
  createdAt: string;
}

export interface WalletBalance {
  pkpAddress: string;
  usdc: string;
  pol: string;
  lastUpdated: string;
}

export interface TradeRecord {
  id: number;
  market_id: string;
  token_id: string;
  side: string;
  amount: string;
  price: string;
  order_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Storage keys for chrome.storage.local
 */
const STORAGE_KEYS = {
  JWT: "vincent_jwt",
  PKP_ADDRESS: "vincent_pkp_address",
  AUTH_METHOD: "vincent_auth_method",
};

/**
 * Get Vincent connect page URL from backend
 */
export async function getConnectUrl(): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/auth/connect-url`);
  if (!response.ok) {
    throw new Error("Failed to get connect URL");
  }
  const data = await response.json();
  return data.url;
}

/**
 * Store JWT and user info in chrome.storage
 */
export async function storeAuth(
  jwt: string,
  pkpAddress: string,
  authMethod: string
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.JWT]: jwt,
    [STORAGE_KEYS.PKP_ADDRESS]: pkpAddress,
    [STORAGE_KEYS.AUTH_METHOD]: authMethod,
  });
  console.log("[Vincent Auth] Stored authentication data");
}

/**
 * Get stored JWT token
 */
export async function getJWT(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.JWT);
  return result[STORAGE_KEYS.JWT] || null;
}

/**
 * Get stored user info
 */
export async function getStoredUser(): Promise<{
  pkpAddress: string;
  authMethod: string;
} | null> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.PKP_ADDRESS,
    STORAGE_KEYS.AUTH_METHOD,
  ]);

  if (!result[STORAGE_KEYS.PKP_ADDRESS]) {
    return null;
  }

  return {
    pkpAddress: result[STORAGE_KEYS.PKP_ADDRESS],
    authMethod: result[STORAGE_KEYS.AUTH_METHOD],
  };
}

/**
 * Clear stored authentication
 */
export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.JWT,
    STORAGE_KEYS.PKP_ADDRESS,
    STORAGE_KEYS.AUTH_METHOD,
  ]);
  console.log("[Vincent Auth] Cleared authentication data");
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const jwt = await getJWT();
  return jwt !== null;
}

/**
 * Get current authenticated user from backend
 */
export async function getCurrentUser(): Promise<VincentUser> {
  const jwt = await getJWT();
  if (!jwt) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${BACKEND_URL}/api/user/me`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // JWT expired, clear stored auth
      await clearAuth();
      throw new Error("Authentication expired. Please reconnect.");
    }
    throw new Error("Failed to get user info");
  }

  return response.json();
}

/**
 * Get wallet balance from backend
 */
export async function getWalletBalance(): Promise<WalletBalance> {
  const jwt = await getJWT();
  if (!jwt) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${BACKEND_URL}/api/wallet/balance`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      await clearAuth();
      throw new Error("Authentication expired. Please reconnect.");
    }
    throw new Error("Failed to get wallet balance");
  }

  return response.json();
}

/**
 * Get trade history from backend
 */
export async function getTradeHistory(): Promise<TradeRecord[]> {
  const jwt = await getJWT();
  if (!jwt) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${BACKEND_URL}/api/trades`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      await clearAuth();
      throw new Error("Authentication expired. Please reconnect.");
    }
    throw new Error("Failed to get trade history");
  }

  return response.json();
}

/**
 * Open Vincent connect page in new tab
 */
export async function openConnectPage(): Promise<void> {
  const url = await getConnectUrl();
  chrome.tabs.create({ url });
}
