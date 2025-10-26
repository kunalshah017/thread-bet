/**
 * Vincent Client
 *
 * Handles Lit Protocol integration and PKP operations for Vincent abilities
 */

import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

let litNodeClient: LitNodeClient | null = null;

/**
 * Initialize Lit Node Client
 * Connects to the Lit Protocol decentralized network
 */
export async function initializeLitClient(): Promise<LitNodeClient> {
  if (litNodeClient && litNodeClient.ready) {
    return litNodeClient;
  }

  console.log("[Vincent Client] Initializing Lit Node Client...");

  const network = (process.env.LIT_NETWORK || "datil-dev") as any;

  litNodeClient = new LitNodeClient({
    litNetwork: network,
    debug: false,
  });

  await litNodeClient.connect();

  console.log(`[Vincent Client] ✓ Connected to Lit Network: ${network}`);

  return litNodeClient;
}

/**
 * Get delegatee signer from private key
 * This is YOUR wallet that executes abilities on behalf of users
 */
export function getDelegateeSigner(): ethers.Wallet {
  const privateKey = process.env.DELEGATEE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("DELEGATEE_PRIVATE_KEY not set in .env file");
  }

  // Add 0x prefix if not present
  const formattedKey = privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`;

  const rpcUrl = process.env.POLYGON_RPC || "https://polygon-rpc.com";
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const signer = new ethers.Wallet(formattedKey, provider);

  console.log("[Vincent Client] Delegatee address:", signer.address);

  return signer;
}

/**
 * Create a PKP signer for a user's Vincent wallet
 * This allows signing transactions on behalf of the user (with their permission)
 *
 * NOTE: In production, this would use Lit Actions and session signatures
 * For MVP, we'll simulate this with direct signing
 */
export async function getPKPSigner(
  pkpPublicKey: string,
  pkpEthAddress: string
): Promise<ethers.Signer> {
  // TODO: Implement proper PKP signing with Lit Protocol session signatures
  // For now, we'll return a mock signer for testing

  console.log("[Vincent Client] Creating PKP signer for:", pkpEthAddress);

  // In production, this would:
  // 1. Verify the user has delegated to our app
  // 2. Get session signatures
  // 3. Create a PKP signer that can sign with the user's PKP

  // For MVP testing, we can use the delegatee to sign
  // (This is temporary - in production it MUST be the PKP)
  const delegateeSigner = getDelegateeSigner();

  console.warn(
    "[Vincent Client] ⚠️  Using delegatee signer for MVP (should be PKP in production)"
  );

  return delegateeSigner;
}

/**
 * Verify Vincent JWT token
 * Used to authenticate requests from the extension
 */
export function verifyVincentJWT(token: string): {
  valid: boolean;
  payload?: any;
  error?: string;
} {
  try {
    // TODO: Implement proper JWT verification
    // For MVP, we'll do basic validation

    if (!token) {
      return { valid: false, error: "No token provided" };
    }

    // In production, verify:
    // 1. JWT signature (ES256K)
    // 2. Expiration
    // 3. Audience (your app)
    // 4. Issuer (Vincent)

    console.log("[Vincent Client] Token verification not implemented (MVP)");

    return {
      valid: true,
      payload: { temp: "mvp" },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Get app configuration
 */
export function getAppConfig() {
  return {
    appId: process.env.APP_ID || "whispers-mvp",
    appVersion: process.env.APP_VERSION || "1.0.0",
    litNetwork: process.env.LIT_NETWORK || "datil-dev",
    chainId: parseInt(process.env.POLYGON_CHAIN_ID || "137"),
    rpcUrl: process.env.POLYGON_RPC || "https://polygon-rpc.com",
  };
}

/**
 * Cleanup - disconnect from Lit
 */
export async function disconnectLit() {
  if (litNodeClient) {
    await litNodeClient.disconnect();
    litNodeClient = null;
    console.log("[Vincent Client] Disconnected from Lit Network");
  }
}
