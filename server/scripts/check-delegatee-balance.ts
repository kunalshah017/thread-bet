/**
 * Check Delegatee Wallet Balance & Allowances
 *
 * This script checks if your delegatee wallet has sufficient
 * USDC and allowances to execute Polymarket trades.
 */

import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const POLYGON_RPC = process.env.POLYGON_RPC || "https://polygon-rpc.com";
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e
const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

const EXCHANGES = {
  "CTF Exchange": "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  "Neg Risk CTF Exchange": "0xC5d563A36AE78145C45a50134d48A1215220f80a",
  "Neg Risk Adapter": "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
};

async function main() {
  const privateKey = process.env.DELEGATEE_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ DELEGATEE_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
  const wallet = new ethers.Wallet(
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`,
    provider
  );

  console.log("🔍 Checking Delegatee Wallet Status\n");
  console.log("📍 Address:", wallet.address);
  console.log("🌐 Network: Polygon (Chain ID 137)\n");

  // Check MATIC balance
  const maticBalance = await provider.getBalance(wallet.address);
  const maticBalanceFormatted = ethers.utils.formatEther(maticBalance);
  console.log("⛽ MATIC Balance:", maticBalanceFormatted, "MATIC");

  if (parseFloat(maticBalanceFormatted) < 0.1) {
    console.log("   ⚠️  Low MATIC - may not be enough for gas");
  } else {
    console.log("   ✅ Sufficient MATIC for gas");
  }

  // Check USDC.e balance
  const usdcContract = new ethers.Contract(
    USDC_ADDRESS,
    [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function allowance(address owner, address spender) view returns (uint256)",
    ],
    provider
  );

  const [usdcBalance, usdcDecimals] = await Promise.all([
    usdcContract.balanceOf(wallet.address),
    usdcContract.decimals(),
  ]);

  const usdcBalanceFormatted = parseFloat(
    ethers.utils.formatUnits(usdcBalance, usdcDecimals)
  );
  console.log(
    "\n💵 USDC.e Balance:",
    usdcBalanceFormatted.toFixed(2),
    "USDC.e"
  );

  if (usdcBalanceFormatted < 5) {
    console.log(
      "   ❌ Insufficient USDC - need at least 5 USDC.e for min order size"
    );
    console.log("   📝 Transfer USDC.e to:", wallet.address);
  } else if (usdcBalanceFormatted < 20) {
    console.log("   ⚠️  Low USDC - may only support 1-2 trades");
  } else {
    console.log("   ✅ Sufficient USDC for multiple trades");
  }

  // Check USDC allowances
  console.log("\n🔐 USDC.e Allowances:");
  for (const [name, exchange] of Object.entries(EXCHANGES)) {
    const allowance = await usdcContract.allowance(wallet.address, exchange);
    const allowanceFormatted = ethers.utils.formatUnits(
      allowance,
      usdcDecimals
    );

    if (parseFloat(allowanceFormatted) > 1000000) {
      console.log(`   ✅ ${name}: Approved (∞)`);
    } else if (parseFloat(allowanceFormatted) > 0) {
      console.log(
        `   ⚠️  ${name}: ${parseFloat(allowanceFormatted).toFixed(2)} USDC.e`
      );
    } else {
      console.log(`   ❌ ${name}: Not approved`);
    }
  }

  // Check CTF approvals
  const ctfContract = new ethers.Contract(
    CTF_ADDRESS,
    [
      "function isApprovedForAll(address owner, address operator) view returns (bool)",
    ],
    provider
  );

  console.log("\n🎟️  CTF Token Approvals:");
  for (const [name, exchange] of Object.entries(EXCHANGES)) {
    const isApproved = await ctfContract.isApprovedForAll(
      wallet.address,
      exchange
    );

    if (isApproved) {
      console.log(`   ✅ ${name}: Approved`);
    } else {
      console.log(`   ❌ ${name}: Not approved`);
    }
  }

  // Summary
  console.log("\n📊 Summary:");
  const hasBalance = usdcBalanceFormatted >= 5;
  const hasMatic = parseFloat(maticBalanceFormatted) >= 0.1;

  if (hasBalance && hasMatic) {
    console.log("✅ Delegatee wallet is ready to execute trades!");
    console.log("\n💡 If allowances are not set, run:");
    console.log("   npx ts-node scripts/set-allowances.ts");
  } else {
    console.log("❌ Delegatee wallet needs setup:");
    if (!hasBalance) {
      console.log("   1. Transfer USDC.e to:", wallet.address);
      console.log("      Minimum: 5 USDC.e");
      console.log("      Recommended: 20-50 USDC.e");
    }
    if (!hasMatic) {
      console.log("   2. Transfer MATIC for gas to:", wallet.address);
      console.log("      Minimum: 0.5 MATIC");
    }
    console.log("   3. Run: npx ts-node scripts/set-allowances.ts");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
