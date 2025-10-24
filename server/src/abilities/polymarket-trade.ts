/**
 * Polymarket Trade Ability
 *
 * Enables Vincent users to place trades on Polymarket prediction markets
 * This ability handles:
 * - Creating Polymarket API keys using the user's PKP
 * - Checking USDC balance and allowances
 * - Building and signing orders
 * - Submitting orders to the Polymarket CLOB
 */

import { ethers } from "ethers";
import { ClobClient } from "@polymarket/clob-client";

// Polymarket contract addresses
const POLYMARKET_CONTRACTS = {
  CTF_EXCHANGE: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Native USDC on Polygon
};

const POLYGON_CHAIN_ID = 137;

/**
 * Ability Schema - Defines the parameters this ability accepts
 */
export const polymarketTradeAbilitySchema = {
  name: "polymarket-trade",
  description: "Place orders on Polymarket prediction markets",
  version: "1.0.0",

  // Parameters the user/app provides
  abilityParamsSchema: {
    type: "object",
    properties: {
      tokenId: {
        type: "string",
        description: "Polymarket outcome token ID (256-bit integer as string)",
      },
      side: {
        type: "string",
        enum: ["BUY", "SELL"],
        description: "Order side - BUY or SELL",
      },
      price: {
        type: "number",
        minimum: 0.01,
        maximum: 0.99,
        description: "Price as decimal (0.01 to 0.99, representing 1% to 99%)",
      },
      amount: {
        type: "number",
        minimum: 1,
        description: "Amount in USDC",
      },
      orderType: {
        type: "string",
        enum: ["GTC", "FOK", "GTD"],
        default: "GTC",
        description:
          "Order type - GTC (Good til Cancelled), FOK (Fill or Kill), GTD (Good til Date)",
      },
    },
    required: ["tokenId", "side", "price", "amount"],
  },

  // User-specific parameters (stored per user)
  userParamsSchema: {
    type: "object",
    properties: {
      polymarketApiKey: {
        type: "string",
        description: "Cached Polymarket API key",
      },
      polymarketApiSecret: {
        type: "string",
        description: "Cached Polymarket API secret",
      },
      polymarketApiPassphrase: {
        type: "string",
        description: "Cached Polymarket API passphrase",
      },
    },
  },
};

/**
 * Check USDC balance for a wallet
 */
async function checkUSDCBalance(
  address: string,
  rpcUrl: string
): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const usdcAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  const usdcContract = new ethers.Contract(
    POLYMARKET_CONTRACTS.USDC,
    usdcAbi,
    provider
  );

  const [balance, decimals] = await Promise.all([
    usdcContract.balanceOf(address),
    usdcContract.decimals(),
  ]);

  return parseFloat(ethers.utils.formatUnits(balance, decimals));
}

/**
 * Check USDC allowance for Polymarket CTF Exchange
 */
async function checkUSDCAllowance(
  ownerAddress: string,
  rpcUrl: string
): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const usdcAbi = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  const usdcContract = new ethers.Contract(
    POLYMARKET_CONTRACTS.USDC,
    usdcAbi,
    provider
  );

  const [allowance, decimals] = await Promise.all([
    usdcContract.allowance(ownerAddress, POLYMARKET_CONTRACTS.CTF_EXCHANGE),
    usdcContract.decimals(),
  ]);

  return parseFloat(ethers.utils.formatUnits(allowance, decimals));
}

/**
 * Pre-check function - Validates conditions before executing
 * This runs BEFORE the trade to ensure it will succeed
 */
export async function polymarketTradePrecheck(params: {
  abilityParams: {
    tokenId: string;
    side: "BUY" | "SELL";
    price: number;
    amount: number;
    orderType?: string;
  };
  userParams?: {
    polymarketApiKey?: string;
    polymarketApiSecret?: string;
    polymarketApiPassphrase?: string;
  };
  delegatorPkpEthAddress: string;
  rpcUrl: string;
}): Promise<{
  allowed: boolean;
  reason?: string;
  details?: {
    balance?: number;
    allowance?: number;
    required?: number;
  };
}> {
  const { abilityParams, delegatorPkpEthAddress, rpcUrl } = params;

  try {
    console.log("[Polymarket Ability] Running precheck...");

    // 1. Check USDC balance
    const balance = await checkUSDCBalance(delegatorPkpEthAddress, rpcUrl);
    console.log(`[Polymarket Ability] Balance: ${balance} USDC`);

    if (balance < abilityParams.amount) {
      return {
        allowed: false,
        reason: `Insufficient USDC balance. Have: ${balance.toFixed(
          2
        )} USDC, Need: ${abilityParams.amount} USDC`,
        details: {
          balance,
          required: abilityParams.amount,
        },
      };
    }

    // 2. Check USDC allowance
    const allowance = await checkUSDCAllowance(delegatorPkpEthAddress, rpcUrl);
    console.log(`[Polymarket Ability] Allowance: ${allowance} USDC`);

    if (allowance < abilityParams.amount) {
      return {
        allowed: false,
        reason: `Insufficient USDC allowance. Have: ${allowance.toFixed(
          2
        )} USDC, Need: ${
          abilityParams.amount
        } USDC. Please approve USDC first.`,
        details: {
          allowance,
          required: abilityParams.amount,
        },
      };
    }

    // 3. Validate price range
    if (abilityParams.price < 0.01 || abilityParams.price > 0.99) {
      return {
        allowed: false,
        reason: "Price must be between 0.01 (1%) and 0.99 (99%)",
      };
    }

    console.log("[Polymarket Ability] ✓ Precheck passed");

    return {
      allowed: true,
      details: {
        balance,
        allowance,
        required: abilityParams.amount,
      },
    };
  } catch (error) {
    console.error("[Polymarket Ability] Precheck error:", error);
    return {
      allowed: false,
      reason: `Precheck failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Build Polymarket order structure
 */
function buildPolymarketOrder(params: {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  amount: number;
  userAddress: string;
  nonce?: number;
}): {
  order: any;
  domain: any;
  types: any;
} {
  const { tokenId, side, price, amount, userAddress, nonce } = params;

  // Calculate maker/taker amounts
  const amountBN = ethers.utils.parseUnits(amount.toString(), 6); // USDC has 6 decimals
  const shares = amount / price;
  const sharesBN = ethers.utils.parseUnits(shares.toFixed(6), 6);

  const makerAmount =
    side === "BUY" ? amountBN.toString() : sharesBN.toString();
  const takerAmount =
    side === "BUY" ? sharesBN.toString() : amountBN.toString();

  // Build order
  const order = {
    salt: Math.floor(Math.random() * 1000000000),
    maker: userAddress,
    signer: userAddress,
    taker: "0x0000000000000000000000000000000000000000",
    tokenId: tokenId,
    makerAmount,
    takerAmount,
    expiration: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    nonce: nonce || Date.now(),
    feeRateBps: 0,
    side: side === "BUY" ? 0 : 1,
    signatureType: 0, // EOA signature
  };

  // EIP-712 domain
  const domain = {
    name: "Polymarket CTF Exchange",
    version: "1",
    chainId: POLYGON_CHAIN_ID,
    verifyingContract: POLYMARKET_CONTRACTS.CTF_EXCHANGE,
  };

  // EIP-712 types
  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "signer", type: "address" },
      { name: "taker", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "makerAmount", type: "uint256" },
      { name: "takerAmount", type: "uint256" },
      { name: "expiration", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "feeRateBps", type: "uint256" },
      { name: "side", type: "uint8" },
      { name: "signatureType", type: "uint8" },
    ],
  };

  return { order, domain, types };
}

/**
 * Execute function - Main trading logic
 * This is called by your backend delegatee to execute the trade
 *
 * NOTE: This is a simplified version for manual testing
 * In production, this would be a Lit Action that runs inside the Lit Network
 */
export async function polymarketTradeExecute(params: {
  abilityParams: {
    tokenId: string;
    side: "BUY" | "SELL";
    price: number;
    amount: number;
    orderType?: string;
  };
  userParams?: {
    polymarketApiKey?: string;
    polymarketApiSecret?: string;
    polymarketApiPassphrase?: string;
  };
  delegatorPkpEthAddress: string;
  pkpSigner: ethers.Signer; // The PKP wallet signer (provided by Lit)
  userAddress?: string; // Optional: If provided, this address will be the maker (must have funds)
}): Promise<{
  success: boolean;
  orderId?: string;
  error?: string;
  signature?: string;
}> {
  const { abilityParams, delegatorPkpEthAddress, pkpSigner, userAddress } =
    params;

  try {
    console.log("[Polymarket Ability] Building order...");

    // Use userAddress if provided (for MetaMask flow), otherwise use PKP address
    const makerAddress = userAddress || delegatorPkpEthAddress;
    console.log("[Polymarket Ability] Maker address:", makerAddress);

    // 1. Build order structure
    const { order, domain, types } = buildPolymarketOrder({
      tokenId: abilityParams.tokenId,
      side: abilityParams.side,
      price: abilityParams.price,
      amount: abilityParams.amount,
      userAddress: makerAddress,
    });

    console.log("[Polymarket Ability] Order built:", {
      side: abilityParams.side,
      price: abilityParams.price,
      amount: abilityParams.amount,
    });

    // 2. Sign order with PKP
    console.log("[Polymarket Ability] Signing order with PKP...");

    // Type assertion for _signTypedData (it exists on Wallet but not on base Signer interface)
    const signature = await (pkpSigner as any)._signTypedData(
      domain,
      types,
      order
    );

    console.log("[Polymarket Ability] ✓ Order signed");

    // 3. Get API credentials (try env vars first, then create if needed)
    console.log("[Polymarket Ability] Getting API credentials...");

    let apiCreds = params.userParams;

    // Check if we have pre-configured API keys in environment
    if (
      process.env.CLOB_API_KEY &&
      process.env.CLOB_SECRET &&
      process.env.CLOB_PASS_PHRASE
    ) {
      console.log(
        "[Polymarket Ability] Using pre-configured API credentials from environment"
      );
      apiCreds = {
        polymarketApiKey: process.env.CLOB_API_KEY,
        polymarketApiSecret: process.env.CLOB_SECRET,
        polymarketApiPassphrase: process.env.CLOB_PASS_PHRASE,
      };
    }
    // Otherwise, try to create new API credentials
    else if (!apiCreds?.polymarketApiKey || !apiCreds?.polymarketApiSecret) {
      console.log(
        "[Polymarket Ability] Creating Polymarket API credentials..."
      );

      // Create a temporary client to generate API keys
      const tempClient = new ClobClient(
        "https://clob.polymarket.com",
        POLYGON_CHAIN_ID,
        pkpSigner as any
      );

      try {
        // This creates L1 and L2 auth for Polymarket
        const credentials = await tempClient.createApiKey();

        // Verify credentials were actually created
        if (
          !credentials ||
          !credentials.key ||
          !credentials.secret ||
          !credentials.passphrase
        ) {
          throw new Error("API key creation returned invalid credentials");
        }

        apiCreds = {
          polymarketApiKey: credentials.key,
          polymarketApiSecret: credentials.secret,
          polymarketApiPassphrase: credentials.passphrase,
        };

        console.log("[Polymarket Ability] ✓ API credentials created");
        console.log(
          "[Polymarket Ability] API Key:",
          credentials.key.slice(0, 20) + "..."
        );
      } catch (apiError) {
        console.error(
          "[Polymarket Ability] Failed to create API key:",
          apiError
        );
        throw new Error(
          `Failed to create Polymarket API key: ${
            apiError instanceof Error ? apiError.message : "Unknown error"
          }`
        );
      }
    }

    // Verify we have valid credentials before proceeding
    if (
      !apiCreds?.polymarketApiKey ||
      !apiCreds?.polymarketApiSecret ||
      !apiCreds?.polymarketApiPassphrase
    ) {
      throw new Error("Missing API credentials - cannot proceed with trade");
    }

    // 4. Create authenticated CLOB client
    console.log("[Polymarket Ability] Creating authenticated CLOB client...");
    const clobClient = new ClobClient(
      "https://clob.polymarket.com",
      POLYGON_CHAIN_ID,
      pkpSigner as any,
      {
        key: apiCreds.polymarketApiKey,
        secret: apiCreds.polymarketApiSecret,
        passphrase: apiCreds.polymarketApiPassphrase,
      }
    );

    // 5. Create and post the order
    console.log("[Polymarket Ability] Creating order...");

    const userOrder = {
      tokenID: abilityParams.tokenId,
      price: abilityParams.price,
      size: abilityParams.amount,
      side: abilityParams.side as any, // "BUY" or "SELL"
    };

    // Use createAndPostOrder which handles both signing and submission
    const response = await clobClient.createAndPostOrder(userOrder);

    console.log("[Polymarket Ability] ✓ Order submitted successfully");
    console.log("[Polymarket Ability] Order ID:", response.orderID);

    // 6. Return success with order details
    return {
      success: true,
      signature,
      orderId: response.orderID,
    };
  } catch (error) {
    console.error("[Polymarket Ability] Execution error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Execution failed",
    };
  }
}

/**
 * Export ability metadata
 */
export const polymarketTradeAbility = {
  schema: polymarketTradeAbilitySchema,
  precheck: polymarketTradePrecheck,
  execute: polymarketTradeExecute,
};
