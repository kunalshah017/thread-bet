# 🔑 Creating Polymarket API Keys Manually

## Problem

Polymarket's `createApiKey()` is returning "Could not create api key" error.

## Solution: Create API Keys Manually

### Option 1: Use Polymarket's Official API Key Creator

1. **Visit Polymarket CLOB API docs:**
   https://docs.polymarket.com/#create-api-key

2. **Create API key using your wallet:**

   - You need to sign a message with your wallet
   - This generates: `apiKey`, `apiSecret`, `apiPassphrase`

3. **Add to server/.env:**
   ```env
   # Pre-created Polymarket API credentials
   POLYMARKET_API_KEY=your_api_key_here
   POLYMARKET_API_SECRET=your_api_secret_here
   POLYMARKET_API_PASSPHRASE=your_passphrase_here
   ```

### Option 2: Quick Test Script

Create a test script to generate API keys:

```bash
# In server directory
cd k:/whispers/server
```

Create `scripts/create-api-key.ts`:

```typescript
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function createApiKey() {
  const privateKey = process.env.DELEGATEE_PRIVATE_KEY!;
  const wallet = new Wallet(privateKey);

  console.log("Creating API key for wallet:", wallet.address);

  const client = new ClobClient(
    "https://clob.polymarket.com",
    137, // Polygon
    wallet
  );

  try {
    const creds = await client.createApiKey();
    console.log("\n✅ API Key Created!");
    console.log("\nAdd these to your .env file:");
    console.log(`POLYMARKET_API_KEY=${creds.key}`);
    console.log(`POLYMARKET_API_SECRET=${creds.secret}`);
    console.log(`POLYMARKET_API_PASSPHRASE=${creds.passphrase}`);
  } catch (error) {
    console.error("❌ Failed to create API key:", error);
  }
}

createApiKey();
```

Run it:

```bash
npx ts-node scripts/create-api-key.ts
```

### Option 3: Use Polymarket SDK Directly

If the above fails, the issue might be that Polymarket has restrictions. Common reasons:

1. **Address not whitelisted** - Some Polymarket features require whitelisting
2. **Insufficient MATIC** - Need gas for L1 signature
3. **Rate limiting** - Too many API key creation attempts

### Temporary Workaround

For testing, we can skip API key creation and use existing keys. Update your ability to accept pre-configured API credentials:

```typescript
// In server/src/abilities/polymarket-trade.ts
const apiCreds = {
  polymarketApiKey:
    process.env.POLYMARKET_API_KEY || params.userParams?.polymarketApiKey,
  polymarketApiSecret:
    process.env.POLYMARKET_API_SECRET || params.userParams?.polymarketApiSecret,
  polymarketApiPassphrase:
    process.env.POLYMARKET_API_PASSPHRASE ||
    params.userParams?.polymarketApiPassphrase,
};
```

This way you can use pre-created API keys for the MVP demo!

---

**Next Steps:**

1. Try creating API keys manually using Option 2
2. If that works, add them to `.env`
3. Update the ability to use env-based API keys
4. Test the trade flow again
