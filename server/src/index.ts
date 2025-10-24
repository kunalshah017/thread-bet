/**
 * Whispers Backend Server
 *
 * Handles Vincent ability execution for Polymarket trading
 * Acts as the delegatee that executes trades on behalf of users
 */

import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";
import {
  initializeLitClient,
  getDelegateeSigner,
  getPKPSigner,
  verifyVincentJWT,
  getAppConfig,
} from "./vincent-client";
import {
  polymarketTradePrecheck,
  polymarketTradeExecute,
} from "./abilities/polymarket-trade";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests from Chrome extensions and localhost
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
      const isExtension = origin?.startsWith("chrome-extension://");
      const isLocalhost =
        origin?.includes("localhost") || origin?.includes("127.0.0.1");
      const isAllowed =
        allowedOrigins.includes(origin || "") || allowedOrigins.includes("*");

      if (!origin || isExtension || isLocalhost || isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Initialize Lit on startup
let litInitialized = false;

async function initializeLit() {
  if (!litInitialized) {
    try {
      await initializeLitClient();
      litInitialized = true;
      console.log("[Server] ✓ Lit Protocol initialized");
    } catch (error) {
      console.error("[Server] Failed to initialize Lit:", error);
      throw error;
    }
  }
}

// Health check route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    message: "Whispers Backend Server",
    litInitialized,
    delegateeAddress: getDelegateeSigner().address,
  });
});

// Get app configuration
app.get("/api/config", (req: Request, res: Response) => {
  const config = getAppConfig();
  res.json({
    appId: config.appId,
    appVersion: config.appVersion,
    chainId: config.chainId,
    network: config.litNetwork,
  });
});

/**
 * Precheck endpoint - Validates if a trade can be executed
 * Call this BEFORE asking user to confirm the trade
 */
app.post("/api/trade/precheck", async (req: Request, res: Response) => {
  try {
    const { tokenId, side, price, amount, userAddress } = req.body;

    // Validate required fields
    if (!tokenId || !side || !price || !amount || !userAddress) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: tokenId, side, price, amount, userAddress",
      });
    }

    console.log("[API] Precheck request:", {
      tokenId,
      side,
      price,
      amount,
      userAddress,
    });

    // Run precheck
    const result = await polymarketTradePrecheck({
      abilityParams: {
        tokenId,
        side: side.toUpperCase(),
        price: parseFloat(price),
        amount: parseFloat(amount),
      },
      delegatorPkpEthAddress: userAddress,
      rpcUrl: process.env.POLYGON_RPC || "https://polygon-rpc.com",
    });

    res.json({
      success: result.allowed,
      reason: result.reason,
      details: result.details,
    });
  } catch (error) {
    console.error("[API] Precheck error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Precheck failed",
    });
  }
});

/**
 * Execute trade endpoint
 * This executes the Polymarket trade using the user's PKP wallet
 */
app.post("/api/trade/execute", async (req: Request, res: Response) => {
  try {
    const {
      tokenId,
      side,
      price,
      amount,
      orderType,
      userAddress,
      pkpPublicKey,
      authToken,
    } = req.body;

    // Validate required fields
    if (!tokenId || !side || !price || !amount || !userAddress) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: tokenId, side, price, amount, userAddress",
      });
    }

    console.log("[API] Execute trade request:", {
      tokenId,
      side,
      price,
      amount,
      userAddress,
    });

    // Verify authentication (simplified for MVP)
    if (authToken) {
      const authResult = verifyVincentJWT(authToken);
      if (!authResult.valid) {
        return res.status(401).json({
          success: false,
          error: "Invalid authentication token",
        });
      }
    }

    // Initialize Lit if needed
    await initializeLit();

    // Get PKP signer
    const pkpSigner = await getPKPSigner(pkpPublicKey || "", userAddress);

    // Execute the ability
    const result = await polymarketTradeExecute({
      abilityParams: {
        tokenId,
        side: side.toUpperCase(),
        price: parseFloat(price),
        amount: parseFloat(amount),
        orderType: orderType || "GTC",
      },
      delegatorPkpEthAddress: userAddress,
      pkpSigner,
    });

    if (result.success) {
      res.json({
        success: true,
        orderId: result.orderId,
        signature: result.signature,
        message: "Trade executed successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || "Trade execution failed",
      });
    }
  } catch (error) {
    console.error("[API] Execute trade error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Trade execution failed",
    });
  }
});

/**
 * Check USDC balance
 */
app.get("/api/balance/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address || !ethers.utils.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: "Invalid address",
      });
    }

    const provider = new ethers.providers.JsonRpcProvider(
      process.env.POLYGON_RPC || "https://polygon-rpc.com"
    );

    const usdcAbi = [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];

    const usdcContract = new ethers.Contract(
      process.env.USDC_ADDRESS || "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      usdcAbi,
      provider
    );

    const [balance, decimals] = await Promise.all([
      usdcContract.balanceOf(address),
      usdcContract.decimals(),
    ]);

    const formattedBalance = ethers.utils.formatUnits(balance, decimals);

    res.json({
      success: true,
      address,
      balance: formattedBalance,
      balanceRaw: balance.toString(),
    });
  } catch (error) {
    console.error("[API] Balance check error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Balance check failed",
    });
  }
});

// Basic route
app.get("/", (req: Request, res: Response) => {
  res.send(`
    <h1>Whispers Backend Server</h1>
    <p>Vincent-powered Polymarket trading automation</p>
    <h2>Endpoints:</h2>
    <ul>
      <li>GET /health - Health check</li>
      <li>GET /api/config - App configuration</li>
      <li>POST /api/trade/precheck - Validate trade</li>
      <li>POST /api/trade/execute - Execute trade</li>
      <li>GET /api/balance/:address - Check USDC balance</li>
    </ul>
  `);
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 Whispers Backend Server`);
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health\n`);

  // Initialize Lit on startup
  try {
    await initializeLit();
  } catch (error) {
    console.error(
      "⚠️  Warning: Lit initialization failed. Will retry on first request."
    );
  }

  // Show delegatee info
  try {
    const delegatee = getDelegateeSigner();
    console.log(`👤 Delegatee Address: ${delegatee.address}`);
    console.log(`⛓️  Network: ${getAppConfig().litNetwork}`);
    console.log(`\n✅ Server ready!\n`);
  } catch (error) {
    console.error(
      "⚠️  Warning: Could not get delegatee address. Check DELEGATEE_PRIVATE_KEY in .env"
    );
  }
});
