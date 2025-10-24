/**
 * Script to create Polymarket API keys using USER's wallet (not delegatee)
 *
 * This creates API keys that can be reused for all trades
 * Run with: npx ts-node scripts/create-api-key-user.ts <PRIVATE_KEY>
 */

import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

async function createApiKey(privateKey: string) {
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
    console.log("⏳ Requesting API key from Polymarket...");
    const creds = await client.createOrDeriveApiKey();

    console.log("creds", creds);

    // console.log("");
    // console.log("✅ API Key Created Successfully!");
    // console.log("");
    // console.log("📋 Add these to your server/.env file:");
    // console.log("═══════════════════════════════════════════════════════════");
    // console.log(`POLYMARKET_API_KEY=${creds.key}`);
    // console.log(`POLYMARKET_API_SECRET=${creds.secret}`);
    // console.log(`POLYMARKET_API_PASSPHRASE=${creds.passphrase}`);
    // console.log("═══════════════════════════════════════════════════════════");
    // console.log("");
    // console.log("💡 After adding these to .env, restart the server with:");
    // console.log("   cd k:/whispers/server && npm run dev");
    // console.log("");
  } catch (error: any) {
    console.error("");
    console.error("❌ Failed to create API key");
    console.error("");

    if (error.response?.data) {
      console.error(
        "Polymarket error:",
        JSON.stringify(error.response.data, null, 2)
      );
    } else {
      console.error("Error:", error.message || error);
    }

    console.error("");
    console.error("📖 Common reasons:");
    console.error("   • Address not approved by Polymarket");
    console.error("   • No trading history on Polymarket");
    console.error("   • Insufficient MATIC for gas (~0.01 MATIC needed)");
    console.error("   • Rate limiting (try again in a few minutes)");
    console.error("");
    console.error("💡 Alternative: Create API keys manually");
    console.error(
      "   Visit: https://polymarket.com (connect wallet → settings → API keys)"
    );
    console.error("");
  }
}

// Get private key from command line or prompt
const privateKey = process.argv[2];

if (!privateKey) {
  console.error(
    "❌ Usage: npx ts-node scripts/create-api-key-user.ts <PRIVATE_KEY>"
  );
  console.error("");
  console.error("Example:");
  console.error(
    "  npx ts-node scripts/create-api-key-user.ts aaf7fdff3a01cf7f808cff233678a1069d51194eac79bde063c61429253445b0"
  );
  console.error("");
  console.error("⚠️  Make sure to use your MAIN wallet's private key");
  console.error(
    "   (the one with USDC: 0x0e6937a18de79ed54692e65f7a0da5a81b8d7bcf)"
  );
  process.exit(1);
}

createApiKey(privateKey);
