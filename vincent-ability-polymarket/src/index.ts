/**
 * Polymarket Trade Vincent Ability
 *
 * Enables users to place trades on Polymarket prediction markets using Vincent PKPs
 *
 * @package @whispers/vincent-ability-polymarket-trade
 * @version 1.0.0
 */

import {
  createVincentAbility,
  supportedPoliciesForAbility,
} from "@lit-protocol/vincent-ability-sdk";
import { z } from "zod";
import { ethers } from "ethers";
import { ClobClient } from "@polymarket/clob-client";

// Polymarket contract addresses on Polygon
const POLYMARKET_CONTRACTS = {
  CTF_EXCHANGE: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC on Polygon
} as const;

const POLYGON_CHAIN_ID = 137;

/**
 * Ability Parameters Schema (Zod)
 * Defines what parameters the ability accepts
 */
const abilityParamsSchema = z.object({
  tokenId: z
    .string()
    .describe("Polymarket outcome token ID (256-bit integer as string)"),
  side: z.enum(["BUY", "SELL"]).describe("Order side - BUY or SELL"),
  price: z
    .number()
    .min(0.01)
    .max(0.99)
    .describe("Price as decimal (0.01 to 0.99, representing 1% to 99%)"),
  amount: z
    .number()
    .positive()
    .describe(
      "For BUY: USDC amount to spend. For SELL: Number of shares to sell"
    ),
  rpcUrl: z
    .string()
    .url()
    .describe("Polygon RPC endpoint")
    .default("https://polygon-rpc.com"),
});

/**
 * Precheck Success Schema
 */
const precheckSuccessSchema = z.object({
  usdcBalance: z.number().describe("Current USDC balance"),
  usdcAllowance: z.number().describe("Current USDC allowance for CTF Exchange"),
  requiredAmount: z.number().describe("Required USDC for this trade"),
  hasBalance: z.boolean().describe("Whether wallet has sufficient USDC"),
  hasAllowance: z.boolean().describe("Whether USDC allowance is sufficient"),
});

/**
 * Precheck Fail Schema
 */
const precheckFailSchema = z.object({
  reason: z.string().describe("Reason for precheck failure"),
  usdcBalance: z.number().optional().describe("Current USDC balance"),
  usdcAllowance: z.number().optional().describe("Current USDC allowance"),
  requiredAmount: z.number().optional().describe("Required amount"),
});

/**
 * Execute Success Schema
 */
const executeSuccessSchema = z.object({
  orderId: z.string().describe("Polymarket order ID"),
  price: z.number().describe("Order price"),
  size: z.number().describe("Order size in shares"),
  side: z.enum(["BUY", "SELL"]).describe("Order side"),
});

/**
 * Execute Fail Schema
 */
const executeFailSchema = z.object({
  error: z.string().describe("Error message"),
  code: z.string().optional().describe("Error code"),
});

/**
 * Helper: Check USDC balance
 */
async function checkUSDCBalance(
  address: string,
  rpcUrl: string
): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const usdcContract = new ethers.Contract(
    POLYMARKET_CONTRACTS.USDC,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );

  const balance = await usdcContract.balanceOf(address);
  return parseFloat(ethers.utils.formatUnits(balance, 6));
}

/**
 * Helper: Check USDC allowance
 */
async function checkUSDCAllowance(
  ownerAddress: string,
  rpcUrl: string
): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const usdcContract = new ethers.Contract(
    POLYMARKET_CONTRACTS.USDC,
    ["function allowance(address,address) view returns (uint256)"],
    provider
  );

  const allowance = await usdcContract.allowance(
    ownerAddress,
    POLYMARKET_CONTRACTS.CTF_EXCHANGE
  );
  return parseFloat(ethers.utils.formatUnits(allowance, 6));
}

/**
 * Polymarket Trade Vincent Ability
 *
 * This ability allows Vincent users to:
 * - Place BUY orders on Polymarket markets
 * - Place SELL orders on Polymarket markets
 * - Automatic balance and allowance validation
 * - Secure execution via PKP signing in Lit Actions
 */
export const vincentAbility = createVincentAbility({
  packageName: "@kunalshah017/vincent-ability-polymarket-trade",
  abilityDescription:
    "Place buy and sell orders on Polymarket prediction markets",

  abilityParamsSchema,
  supportedPolicies: supportedPoliciesForAbility([]),

  precheckSuccessSchema,
  precheckFailSchema,
  executeSuccessSchema,
  executeFailSchema,

  /**
   * Precheck: Validate conditions before execution
   * Runs outside of Lit Action to check if execution will likely succeed
   */
  precheck: async ({ abilityParams }, { succeed, fail }) => {
    try {
      const { amount, side, rpcUrl } = abilityParams;

      // Get the delegator's PKP address from the execution context
      // This is passed separately by the Vincent SDK
      const pkpAddress = (abilityParams as any).delegatorPkpEthAddress;

      if (!pkpAddress) {
        return fail({
          reason: "Missing delegator PKP address",
        });
      }

      // Check USDC balance
      const usdcBalance = await checkUSDCBalance(pkpAddress, rpcUrl);

      // Check USDC allowance for CTF Exchange
      const usdcAllowance = await checkUSDCAllowance(pkpAddress, rpcUrl);

      // Calculate required USDC (for BUY orders only)
      const requiredAmount = side === "BUY" ? amount : 0;

      // Validate balance and allowance
      const hasBalance = usdcBalance >= requiredAmount;
      const hasAllowance = usdcAllowance >= requiredAmount;

      if (!hasBalance) {
        return fail({
          reason: `Insufficient USDC balance. Have: ${usdcBalance.toFixed(
            2
          )}, Need: ${requiredAmount.toFixed(2)}`,
          usdcBalance,
          usdcAllowance,
          requiredAmount,
        });
      }

      if (!hasAllowance) {
        return fail({
          reason: `Insufficient USDC allowance. Have: ${usdcAllowance.toFixed(
            2
          )}, Need: ${requiredAmount.toFixed(2)}. Please approve USDC first.`,
          usdcBalance,
          usdcAllowance,
          requiredAmount,
        });
      }

      return succeed({
        usdcBalance,
        usdcAllowance,
        requiredAmount,
        hasBalance,
        hasAllowance,
      });
    } catch (error) {
      return fail({
        reason: `Precheck failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  },

  /**
   * Execute: Main trading logic
   * Runs inside Lit Action with access to PKP signing
   *
   * NOTE: This function runs in a sandboxed Lit Action environment.
   * The pkpSigner is provided by the Lit Protocol runtime.
   */
  execute: async ({ abilityParams }, { succeed, fail }) => {
    try {
      const { tokenId, side, price, amount } = abilityParams;

      // In the Lit Action runtime, the PKP signer is available via Lit.Actions
      // For now, we'll get it from the params for testing
      const pkpSigner = (abilityParams as any).pkpSigner;

      if (!pkpSigner) {
        return fail({
          error: "PKP signer not available in execution context",
          code: "NO_SIGNER",
        });
      }

      // Create CLOB client with PKP signer
      const clobClient = new ClobClient(
        "https://clob.polymarket.com",
        POLYGON_CHAIN_ID,
        pkpSigner as any
      );

      // Calculate shares
      // For BUY: shares = USDC / price
      // For SELL: shares = amount (already in shares)
      const shares = side === "BUY" ? amount / price : amount;

      // Create order
      const userOrder = {
        tokenID: tokenId,
        price,
        size: shares,
        side: side as any,
      };

      // Submit order to Polymarket CLOB
      const response = await clobClient.createAndPostOrder(userOrder);

      return succeed({
        orderId: response.orderID,
        price,
        size: shares,
        side,
      });
    } catch (error) {
      return fail({
        error: error instanceof Error ? error.message : "Execution failed",
        code: "EXECUTION_ERROR",
      });
    }
  },
});

/**
 * Export the bundled ability
 * This uses asBundledVincentAbility to properly bundle with IPFS CID
 */
import { asBundledVincentAbility } from "@lit-protocol/vincent-ability-sdk";
import metadata from "../vincent-ability-metadata.json";

export const bundledVincentAbility = asBundledVincentAbility(
  vincentAbility,
  metadata.ipfsCid
);

/**
 * Default export
 */
export default bundledVincentAbility;
