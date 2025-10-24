/**
 * Polymarket Trading Module
 *
 * Handles Polymarket CLOB operations:
 * - Constructing order transactions
 * - USDC approvals
 * - Order placement via MetaMask signing
 */

import { ethers } from "ethers";

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

// Polygon network configuration
export const POLYGON_CHAIN_ID = 137;
export const POLYGON_RPC = "https://polygon-rpc.com";

// Polymarket contract addresses on Polygon
export const POLYMARKET_CONTRACTS = {
  // CTF Exchange contract for order matching
  CTF_EXCHANGE: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  // Conditional Token Framework
  CONDITIONAL_TOKENS: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
  // Native USDC on Polygon (NOT USDC.e - the bridged version)
  // Native USDC: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
  // USDC.e (old): 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
  USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  // Neg Risk CTF Exchange
  NEG_RISK_CTF_EXCHANGE: "0xC5d563A36AE78145C45a50134d48A1215220f80a",
  // Neg Risk Adapter
  NEG_RISK_ADAPTER: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
};

export interface OrderParams {
  tokenId: string; // Market token ID
  side: "BUY" | "SELL";
  amount: string; // Amount in USDC
  price: string; // Price (0-1)
}

export interface MarketOrder {
  market: string;
  side: "YES" | "NO";
  amount: number; // USDC amount
  price: number; // Price as percentage (0-100)
}

/**
 * Get current market prices for an event
 */
export async function getMarketPrices(conditionId: string): Promise<{
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}> {
  try {
    // Fetch order book from CLOB API
    const response = await fetch(
      `https://clob.polymarket.com/book?token_id=${conditionId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch order book: ${response.status}`);
    }

    const orderBook = await response.json();
    return orderBook;
  } catch (error) {
    console.error("[Polymarket] Error fetching prices:", error);
    throw error;
  }
}

/**
 * Check USDC balance for a wallet
 */
export async function checkUSDCBalance(address: string): Promise<string> {
  try {
    // Use MetaMask's provider instead of public RPC for better reliability
    let provider;
    if (typeof window !== "undefined" && window.ethereum) {
      provider = new ethers.providers.Web3Provider(window.ethereum);

      // Ensure we're on Polygon network
      const network = await provider.getNetwork();
      if (network.chainId !== POLYGON_CHAIN_ID) {
        console.warn(
          `[Polymarket] Not on Polygon network (chainId: ${network.chainId}), using fallback RPC`
        );
        provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
      }
    } else {
      // Fallback to public RPC if MetaMask not available
      provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
    }

    // USDC contract ABI (just balanceOf)
    const usdcAbi = [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];

    const usdcContract = new ethers.Contract(
      POLYMARKET_CONTRACTS.USDC,
      usdcAbi,
      provider
    );

    console.log(`[Polymarket] Checking USDC balance for: ${address}`);
    const balance = await usdcContract.balanceOf(address);
    const decimals = await usdcContract.decimals();

    console.log(
      `[Polymarket] Raw balance: ${balance.toString()}, decimals: ${decimals}`
    );

    // Convert to human-readable format
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`[Polymarket] Formatted USDC balance: ${formattedBalance}`);

    return formattedBalance;
  } catch (error) {
    console.error("[Polymarket] Error checking balance:", error);
    return "0";
  }
}

/**
 * Check if USDC is approved for CTF Exchange
 */
export async function checkUSDCAllowance(
  ownerAddress: string,
  spenderAddress: string = POLYMARKET_CONTRACTS.CTF_EXCHANGE
): Promise<string> {
  try {
    // Use MetaMask's provider instead of public RPC for better reliability
    let provider;
    if (typeof window !== "undefined" && window.ethereum) {
      provider = new ethers.providers.Web3Provider(window.ethereum);

      // Ensure we're on Polygon network
      const network = await provider.getNetwork();
      if (network.chainId !== POLYGON_CHAIN_ID) {
        console.warn(
          `[Polymarket] Not on Polygon network (chainId: ${network.chainId}), using fallback RPC`
        );
        provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
      }
    } else {
      // Fallback to public RPC if MetaMask not available
      provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
    }

    const usdcAbi = [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];

    const usdcContract = new ethers.Contract(
      POLYMARKET_CONTRACTS.USDC,
      usdcAbi,
      provider
    );

    console.log(
      `[Polymarket] Checking USDC allowance for owner: ${ownerAddress}, spender: ${spenderAddress}`
    );
    const allowance = await usdcContract.allowance(
      ownerAddress,
      spenderAddress
    );
    const decimals = await usdcContract.decimals();
    const formattedAllowance = ethers.utils.formatUnits(allowance, decimals);
    console.log(`[Polymarket] USDC allowance: ${formattedAllowance}`);

    return formattedAllowance;
  } catch (error) {
    console.error("[Polymarket] Error checking allowance:", error);
    return "0";
  }
}

/**
 * Build USDC approval transaction data
 * This allows the CTF Exchange to spend USDC on behalf of the user
 */
export function buildApprovalTransaction(amount: string): {
  to: string;
  data: string;
  value: string;
} {
  const usdcInterface = new ethers.utils.Interface([
    "function approve(address spender, uint256 amount) returns (bool)",
  ]);

  // Convert amount to raw units (USDC has 6 decimals)
  const amountBN = ethers.utils.parseUnits(amount, 6);

  // Encode the approval call
  const data = usdcInterface.encodeFunctionData("approve", [
    POLYMARKET_CONTRACTS.CTF_EXCHANGE,
    amountBN,
  ]);

  return {
    to: POLYMARKET_CONTRACTS.USDC,
    data,
    value: "0",
  };
}

/**
 * Build Polymarket order for EIP-712 signing
 * Returns order structure ready for MetaMask signing
 */
export async function buildPolymarketOrder(params: {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number; // 0-1 decimal
  size: number; // USDC amount
  userAddress: string;
  nonce?: number;
}): Promise<{
  order: {
    salt: number;
    maker: string;
    signer: string;
    taker: string;
    tokenId: string;
    makerAmount: string;
    takerAmount: string;
    expiration: number;
    nonce: number;
    feeRateBps: number;
    side: number; // 0=BUY, 1=SELL
    signatureType: number; // 0=EOA
  };
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    Order: Array<{ name: string; type: string }>;
  };
}> {
  console.log("[Polymarket] Building order:", params);

  try {
    const { tokenId, side, price, size, userAddress, nonce } = params;

    // Convert price and size to amounts
    // For BUY: makerAmount = USDC to spend, takerAmount = shares to receive
    // For SELL: makerAmount = shares to sell, takerAmount = USDC to receive
    const usdcDecimals = 6;
    const shareDecimals = 6; // CTF tokens use 6 decimals

    let makerAmount: string;
    let takerAmount: string;

    if (side === "BUY") {
      // Buying shares with USDC
      const usdcAmount = ethers.utils.parseUnits(size.toFixed(6), usdcDecimals);
      const shareAmount = ethers.utils.parseUnits(
        (size / price).toFixed(6),
        shareDecimals
      );
      makerAmount = usdcAmount.toString();
      takerAmount = shareAmount.toString();
    } else {
      // Selling shares for USDC
      const shareAmount = ethers.utils.parseUnits(
        size.toFixed(6),
        shareDecimals
      );
      const usdcAmount = ethers.utils.parseUnits(
        (size * price).toFixed(6),
        usdcDecimals
      );
      makerAmount = shareAmount.toString();
      takerAmount = usdcAmount.toString();
    }

    // Build the order
    const order = {
      salt: Math.floor(Math.random() * 1000000000), // Random salt
      maker: userAddress,
      signer: userAddress,
      taker: "0x0000000000000000000000000000000000000000", // Anyone can take
      tokenId: tokenId,
      makerAmount,
      takerAmount,
      expiration: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      nonce: nonce || Date.now(),
      feeRateBps: 0, // Fee will be set by operator
      side: side === "BUY" ? 0 : 1,
      signatureType: 0, // EOA
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
  } catch (error) {
    console.error("[Polymarket] Order building failed:", error);
    throw error;
  }
}

/**
 * Submit signed order to Polymarket CLOB API
 * For browser wallets, we submit the EIP-712 signed order directly without API keys
 *
 * NOTE: API key authentication would require Vincent PKP for programmatic signing
 * For MVP, we're using direct order signature which should work for public markets
 */
export async function submitOrder(params: {
  order: Record<string, unknown>;
  signature: string;
  orderType?: "GTC" | "FOK" | "GTD";
  ownerAddress: string;
}): Promise<{ success: boolean; orderID?: string; error?: string }> {
  try {
    console.log("[Polymarket] Submitting order to CLOB API...");

    const { order, signature, orderType = "GTC", ownerAddress } = params;

    // Add signature to order
    const signedOrder = {
      ...order,
      signature,
    };

    const requestBody = {
      order: signedOrder,
      orderType,
      owner: ownerAddress, // Use wallet address directly (no API key needed)
    };

    console.log(
      "[Polymarket] Submitting signed order (browser wallet mode - no API key)..."
    );

    // Submit without API authentication
    // The EIP-712 order signature should be sufficient
    const response = await fetch("https://clob.polymarket.com/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg =
        (errorData as { error?: string; errorMsg?: string }).error ||
        (errorData as { errorMsg?: string }).errorMsg ||
        `HTTP ${response.status}: ${response.statusText}`;

      console.error(
        "[Polymarket] Order submission failed:",
        errorMsg,
        errorData
      );

      throw new Error(errorMsg);
    }

    const result = await response.json();

    console.log("[Polymarket] ✓ Order submitted:", result);

    return {
      success: true,
      orderID:
        (result as { orderID?: string; id?: string; orderId?: string })
          .orderID ||
        (result as { id?: string }).id ||
        (result as { orderId?: string }).orderId,
    };
  } catch (error) {
    console.error("[Polymarket] Order submission failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit order",
    };
  }
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(tx: {
  to: string;
  data: string;
  from: string;
}): Promise<string> {
  const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);

  try {
    const gasEstimate = await provider.estimateGas(tx);
    return gasEstimate.toString();
  } catch (error) {
    console.error("[Polymarket] Gas estimation error:", error);
    // Return a safe default
    return "500000";
  }
}

/**
 * Get current gas price on Polygon
 */
export async function getGasPrice(): Promise<string> {
  const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);

  try {
    const gasPrice = await provider.getGasPrice();
    return ethers.utils.formatUnits(gasPrice, "gwei");
  } catch (error) {
    console.error("[Polymarket] Gas price error:", error);
    return "50"; // Default 50 gwei
  }
}

/**
 * Format order details for display
 */
export function formatOrderDetails(order: MarketOrder): string {
  const side = order.side === "YES" ? "✅ Yes" : "❌ No";
  const amount = order.amount.toFixed(2);
  const price = order.price.toFixed(1);

  return `${side} • $${amount} USDC @ ${price}%`;
}

/**
 * Calculate expected shares from order
 */
export function calculateExpectedShares(
  usdcAmount: number,
  price: number // Price as 0-100
): number {
  // Shares = USDC / (Price/100)
  const priceDecimal = price / 100;
  return usdcAmount / priceDecimal;
}

/**
 * Calculate potential profit
 */
export function calculatePotentialProfit(
  shares: number,
  buyPrice: number // 0-100
): number {
  // If outcome wins, each share = $1
  // Profit = shares * $1 - cost
  const cost = shares * (buyPrice / 100);
  const revenue = shares * 1; // $1 per share if wins
  return revenue - cost;
}
