# Balance/Allowance Issue - MVP Explanation

## Current Architecture (MVP Mode)

In the current MVP implementation:

1. **Backend delegatee wallet** signs Polymarket orders
2. **Delegatee wallet address**: `0x52c0344AAad255CfCac1C19D04F8647230224326`
3. **Polymarket requires the order signer to have**:
   - USDC balance >= order amount
   - USDC allowance >= order amount (for CTF Exchange)
   - CTF token allowance (for exchanges)

## Why You're Getting "not enough balance / allowance"

The error occurs because:

- Your **user's MetaMask wallet** has USDC ✅
- But the **delegatee wallet** (which signs orders) only has 1 USDC.e ❌
- Polymarket checks the **order signer's** balance, not the user's

## Quick Fix for Demo

**Transfer USDC.e to your delegatee wallet:**

```bash
# From your MetaMask wallet, send to delegatee:
# To: 0x52c0344AAad255CfCac1C19D04F8647230224326
# Amount: 20-50 USDC.e (enough for multiple test trades)
# Network: Polygon
# Token: USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)
```

**Then set allowances for the delegatee wallet:**

```bash
cd k:/whispers/server
npx ts-node scripts/set-allowances.ts
```

This will approve USDC.e + CTF for all Polymarket exchanges using the delegatee wallet.

## Production Architecture (Future)

In production Vincent apps, the flow should be:

1. **User's PKP wallet** holds the USDC
2. **User's PKP wallet** signs the order (via Lit Actions)
3. **Delegatee** just submits the signed order (doesn't need funds)

This requires implementing proper Lit Protocol PKP signing in `vincent-client.ts` (currently marked as TODO).

## Files to Update for Production

1. **`server/src/vincent-client.ts`**:

   - Line 88: Replace delegatee signer with real PKP signer
   - Implement Lit Actions for signing

2. **`server/src/abilities/polymarket-trade.ts`**:

   - Already updated to accept `userAddress` parameter
   - Already uses proper maker address

3. **Extension**:
   - Would need to pre-approve USDC from user's PKP wallet
   - Or implement approval delegation flow

## Current Status

✅ Backend configured for MVP testing with delegatee wallet
⚠️ Requires delegatee wallet to have USDC + allowances
🔜 Production requires proper PKP implementation
