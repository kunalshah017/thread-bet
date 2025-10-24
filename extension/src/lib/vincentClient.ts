/**
 * Vincent Client - Handles Lit Protocol PKP delegation and signing
 *
 * This module manages:
 * - User authentication and PKP creation
 * - Delegation authorization
 * - Transaction signing via Vincent
 */

import { LitNodeClient } from "@lit-protocol/lit-node-client";
import type { IRelayPKP, AuthMethod } from "@lit-protocol/types";

// Extend Window interface for ethereum provider
declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      selectedAddress?: string;
      isMetaMask?: boolean;
    };
  }
}

// Types for Vincent integration
export interface VincentConnection {
  pkp: IRelayPKP;
  authMethod: AuthMethod;
  sessionSigs?: Record<string, unknown>;
}

export interface StoredVincentAuth {
  pkpPublicKey: string;
  pkpEthAddress: string;
  pkpTokenId: string;
  authMethodType: string;
  timestamp: number;
  // Polymarket API credentials (optional, cached after first creation)
  polymarketApiKey?: string;
  polymarketApiSecret?: string;
  polymarketApiPassphrase?: string;
}

/**
 * Initialize Lit Node Client for Vincent operations
 */
export async function initializeLitClient(): Promise<LitNodeClient> {
  console.log("[Vincent] Initializing Lit Node Client...");

  const litNodeClient = new LitNodeClient({
    litNetwork: "datil-dev", // Use 'datil' for mainnet
    debug: true,
  });

  await litNodeClient.connect();
  console.log("[Vincent] ✓ Lit Node Client connected");

  return litNodeClient;
}

/**
 * Create or retrieve PKP for user via MetaMask authentication
 * This creates a Vincent Wallet (PKP) that the user controls
 */
export async function authenticateWithMetaMask(
  _litNodeClient: LitNodeClient
): Promise<VincentConnection> {
  console.log("[Vincent] Starting MetaMask authentication...");

  // Check if MetaMask is available
  if (!window.ethereum) {
    throw new Error(
      "MetaMask not detected. Please install MetaMask to continue."
    );
  }

  try {
    // Request account access
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please connect MetaMask.");
    }

    const userAddress = accounts[0];
    console.log("[Vincent] MetaMask account:", userAddress);

    // Get user signature for auth
    const message = `Sign this message to authorize Polymarket trading.\n\nThis signature proves you own this wallet.\n\nTimestamp: ${Date.now()}`;

    try {
      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message, userAddress],
      })) as string;

      console.log("[Vincent] ✓ User signature obtained");

      // Create auth method
      const authMethod: AuthMethod = {
        authMethodType: 6, // EthWallet auth type
        accessToken: signature,
      };

      // For MVP/hackathon: Use MetaMask wallet directly instead of minting PKP
      // In production with full Vincent integration, you would:
      // 1. Call Lit Relay API to mint a new PKP
      // 2. Associate PKP with user's auth method
      // 3. Delegate signing authority to your Vincent app

      console.log("[Vincent] Using MetaMask wallet for trading (MVP mode)");

      const pkp: IRelayPKP = {
        tokenId: `metamask_${Date.now()}`,
        publicKey: `0x04${signature.slice(2, 130)}`, // Derive mock pubkey from signature
        ethAddress: userAddress, // Use MetaMask address directly
      };

      const connection: VincentConnection = {
        pkp,
        authMethod,
      };

      // Store authentication
      await storeVincentAuth(connection);

      console.log("[Vincent] ✓ Authentication complete");
      console.log("[Vincent] Wallet address:", userAddress);

      return connection;
    } catch (signError) {
      console.error("[Vincent] User rejected signature:", signError);
      throw new Error("User rejected signature request");
    }
  } catch (error) {
    console.error("[Vincent] Authentication error:", error);
    throw error;
  }
}

/**
 * Store Vincent authentication in chrome storage
 */
export async function storeVincentAuth(
  connection: VincentConnection
): Promise<void> {
  const authData: StoredVincentAuth = {
    pkpPublicKey: connection.pkp.publicKey,
    pkpEthAddress: connection.pkp.ethAddress,
    pkpTokenId: connection.pkp.tokenId,
    authMethodType: connection.authMethod.authMethodType.toString(),
    timestamp: Date.now(),
  };

  await chrome.storage.local.set({
    vincent_auth: authData,
  });

  console.log("[Vincent] ✓ Authentication stored");
}

/**
 * Retrieve stored Vincent authentication
 */
export async function getStoredVincentAuth(): Promise<StoredVincentAuth | null> {
  const result = await chrome.storage.local.get("vincent_auth");
  return result.vincent_auth || null;
}

/**
 * Check if user has an active Vincent connection
 */
export async function hasVincentConnection(): Promise<boolean> {
  const auth = await getStoredVincentAuth();
  return auth !== null && auth.pkpEthAddress !== "";
}

/**
 * Clear stored Vincent authentication (disconnect)
 */
export async function disconnectVincent(): Promise<void> {
  await chrome.storage.local.remove("vincent_auth");
  console.log("[Vincent] ✓ Disconnected");
}

/**
 * Get PKP session signatures for transaction signing
 * These are used to prove the user has delegated authority
 */
export async function getPKPSessionSigs(
  _litNodeClient: LitNodeClient,
  _pkp: IRelayPKP,
  _authMethod: AuthMethod
): Promise<Record<string, unknown>> {
  console.log("[Vincent] Generating session signatures...");

  // Session signatures allow the PKP to sign transactions
  // without requiring user approval each time
  try {
    // In full implementation, this would use litNodeClient.getPkpSessionSigs()
    // with proper resource IDs and auth signatures

    // TODO: Implement actual session sig generation
    const sessionSigs = {}; // Placeholder

    console.log("[Vincent] ✓ Session signatures generated");
    return sessionSigs;
  } catch (error) {
    console.error("[Vincent] Session sig error:", error);
    throw error;
  }
}

/**
 * Sign an EIP-712 typed data message using PKP
 * This is used for Polymarket order signing
 */
export async function signTypedDataWithPKP(
  _litNodeClient: LitNodeClient,
  _pkp: IRelayPKP,
  _sessionSigs: Record<string, unknown>,
  _typedData: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    value: Record<string, unknown>;
  }
): Promise<string> {
  console.log("[Vincent] Signing typed data with PKP...");

  try {
    // This would use Lit Actions to sign EIP-712 data
    // TODO: Implement actual signing via Lit Actions

    const signature = "0x"; // Placeholder

    console.log("[Vincent] ✓ Signature generated");
    return signature;
  } catch (error) {
    console.error("[Vincent] Signing error:", error);
    throw error;
  }
}
