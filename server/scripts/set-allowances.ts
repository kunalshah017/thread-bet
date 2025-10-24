/**
 * Script to check and set required Polymarket allowances
 * 
 * Polymarket requires approvals for multiple contracts:
 * 1. CTF Exchange (0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E)
 * 2. Neg Risk CTF Exchange (0xC5d563A36AE78145C45a50134d48A1215220f80a)
 * 3. Neg Risk Adapter (0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296)
 * 
 * Each needs both USDC.e and CTF approvals
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  maxUint256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

// ==== Basic Config ====
const rpcUrl = process.env.POLYGON_RPC || "https://polygon-rpc.com";
const privKey = process.env.DELEGATEE_PRIVATE_KEY as `0x${string}`;

if (!privKey) {
  console.error("❌ DELEGATEE_PRIVATE_KEY not found in .env file");
  process.exit(1);
}

const account = privateKeyToAccount(privKey.startsWith("0x") ? privKey : `0x${privKey}`);

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain: polygon,
  transport: http(rpcUrl),
});

// ==== ABI ====
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 value) returns (bool)",
]);

const erc1155Abi = parseAbi([
  "function setApprovalForAll(address operator, bool approved)",
]);

// ==== Contract Addresses ====
const usdc = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as `0x${string}`; // USDC.e
const ctf = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045" as `0x${string}`;

const targets: `0x${string}`[] = [
  "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E", // CTF Exchange
  "0xC5d563A36AE78145C45a50134d48A1215220f80a", // Neg Risk CTF Exchange
  "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296", // Neg Risk Adapter
];

// ==== Execute approve / setApprovalForAll ====
async function main() {
  console.log(`� Using account: ${account.address}`);
  console.log("");

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 MATIC Balance: ${Number(balance) / 1e18} MATIC`);
  
  if (balance < BigInt(10000000000000000)) { // 0.01 MATIC
    console.error("❌ Insufficient MATIC for gas. Need at least 0.01 MATIC");
    console.error("   Send some MATIC to:", account.address);
    process.exit(1);
  }
  console.log("");

  for (const target of targets) {
    console.log(`📋 Granting approvals to ${target}...`);

    try {
      // --- 1. ERC20 approve (USDC.e) ---
      console.log("   ⏳ Approving USDC.e...");
      const { request: approveReq } = await publicClient.simulateContract({
        address: usdc,
        abi: erc20Abi,
        functionName: "approve",
        args: [target, maxUint256],
        account,
      });

      const approveHash = await walletClient.writeContract(approveReq);
      console.log(`   � USDC approve TX: ${approveHash}`);
      
      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveHash,
      });
      console.log(`   ✅ USDC approved (status: ${approveReceipt.status})`);

      // --- 2. ERC1155 setApprovalForAll (CTF) ---
      console.log("   ⏳ Approving CTF...");
      const { request: setApprovalReq } = await publicClient.simulateContract({
        address: ctf,
        abi: erc1155Abi,
        functionName: "setApprovalForAll",
        args: [target, true],
        account,
      });

      const setApprovalHash = await walletClient.writeContract(setApprovalReq);
      console.log(`   📝 CTF approval TX: ${setApprovalHash}`);
      
      const setApprovalReceipt = await publicClient.waitForTransactionReceipt({
        hash: setApprovalHash,
      });
      console.log(`   ✅ CTF approved (status: ${setApprovalReceipt.status})`);
      console.log("");
    } catch (error: any) {
      console.error(`   ❌ Error approving ${target}:`, error.message);
      console.log("");
    }
  }

  console.log("✅ All allowances set!");
  console.log("");
  console.log("💡 Now try creating API keys:");
  console.log("   npx ts-node scripts/create-api-key.ts");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
