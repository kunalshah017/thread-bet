/**
 * Script to create Polymarket API keys
 *
 * Run with: npx ts-node scripts/create-api-key.ts
 */

import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function createApiKey() {
  const privateKey = process.env.DELEGATEE_PRIVATE_KEY;

  if (!privateKey) {
    console.error("❌ DELEGATEE_PRIVATE_KEY not found in .env file");
    process.exit(1);
  }

  const wallet = new Wallet(privateKey);

  console.log("🔑 Creating Polymarket API key...");
  console.log("📍 Wallet address:", wallet.address);
  console.log("");

  const client = new ClobClient(
    "https://clob.polymarket.com",
    137, // Polygon
    wallet
  );

  try {
    const creds = await client.createApiKey();

    console.log("✅ API Key Created Successfully!");
    console.log("");
    console.log("📋 Add these to your .env file:");
    console.log("─────────────────────────────────────────");
    console.log(`POLYMARKET_API_KEY=${creds.key}`);
    console.log(`POLYMARKET_API_SECRET=${creds.secret}`);
    console.log(`POLYMARKET_API_PASSPHRASE=${creds.passphrase}`);
    console.log("─────────────────────────────────────────");
    console.log("");
    console.log("💡 After adding these to .env, restart the server");
  } catch (error) {
    console.error("❌ Failed to create API key");
    console.error("");
    console.error("Error details:", error);
    console.error("");
    console.error("Common reasons:");
    console.error("  - Address not whitelisted on Polymarket");
    console.error("  - Insufficient MATIC for gas");
    console.error("  - Rate limiting");
    console.error("  - Network issues");
    console.error("");
    console.error("💡 Try creating API keys manually at:");
    console.error("   https://docs.polymarket.com/#create-api-key");
  }
}

createApiKey();
