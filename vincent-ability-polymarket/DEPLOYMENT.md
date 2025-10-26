# Deployment Guide for @whispers/vincent-ability-polymarket-trade

This guide walks you through publishing this Vincent Ability to npm and registering it on the Vincent Dashboard.

---

## Prerequisites

1. **npm account**: Create one at https://www.npmjs.com/signup
2. **npm CLI**: Already installed with Node.js
3. **Vincent Dashboard access**: Sign in at https://dashboard.heyvincent.ai/

---

## Step 1: Prepare the Package

### 1.1 Install Dependencies

```bash
cd k:/whispers/vincent-ability-polymarket
npm install
```

### 1.2 Build the Package

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 1.3 Test Locally (Optional)

```bash
# In another project, you can test by linking locally
npm link

# Then in your server project:
cd k:/whispers/server
npm link @whispers/vincent-ability-polymarket-trade
```

---

## Step 2: Publish to npm

### 2.1 Login to npm

```bash
npm login
```

Enter your:
- Username
- Password
- Email
- One-time password (if 2FA is enabled)

### 2.2 Check Package Name Availability

```bash
npm view @whispers/vincent-ability-polymarket-trade
```

If it shows "404", the name is available! If not, you'll need to:
- Use a different name (e.g., `@your-username/vincent-ability-polymarket-trade`)
- Or make it a scoped private package

### 2.3 Publish (Public)

```bash
npm publish --access public
```

**Note**: If this is your first time publishing a scoped package (`@whispers/...`), you need `--access public`.

### 2.4 Verify Publication

```bash
npm view @whispers/vincent-ability-polymarket-trade
```

You should see your package details!

---

## Step 3: Register on Vincent Dashboard

### 3.1 Log into Vincent Dashboard

Go to https://dashboard.heyvincent.ai/ and sign in.

### 3.2 Create New Ability

1. Click **"Create an ability"** button
2. Fill in the form:

   **Package Name**: `@whispers/vincent-ability-polymarket-trade`
   
   **Title**: `Polymarket Trade`
   
   **Description**:
   ```
   Place buy and sell orders on Polymarket prediction markets. Supports automatic balance validation, USDC allowance checking, and secure execution via PKP signing.
   ```
   
   **Active Version**: `1.0.0`
   
   **Deployment Status**: `dev` (for testing) or `active` (for production)
   
   **Logo** (optional): Upload an icon (e.g., Polymarket logo)

3. Click **"Create Ability"**

### 3.3 Wait for Verification

Vincent will verify your package is published on npm and extract metadata. This usually takes a few seconds.

### 3.4 Success!

Once verified, your ability is now available for Vincent App developers to use!

---

## Step 4: Add Ability to Your Vincent App

### 4.1 Navigate to Your App

In the Vincent Dashboard:
1. Go to your "Whispers" app
2. Click **"Edit"** or **"Add Abilities"**

### 4.2 Add the Polymarket Trade Ability

1. Click **"Add Abilities to Version"**
2. Search for "Polymarket Trade"
3. Select your ability
4. Click **"Save"**

### 4.3 Publish App Version

1. Click **"Publish App Version"**
2. This registers the new version in the Vincent Registry smart contract
3. Wait for the transaction to confirm

### 4.4 Update Your Code

In your backend (`server/src/index.ts`):

```typescript
// Import your published ability
import { bundledVincentAbility as polymarketAbility } from '@whispers/vincent-ability-polymarket-trade';
import { getVincentAbilityClient } from '@lit-protocol/vincent-app-sdk/abilityClient';

// Create ability client
const polymarketAbilityClient = getVincentAbilityClient({
  bundledVincentAbility: polymarketAbility,
  ethersSigner: delegateeSigner,
});

// Use it in your trade endpoint
app.post('/api/trade', async (req, res) => {
  const { user } = await verifyRequestJWT(req.headers.authorization);
  const { tokenId, side, price, amount } = req.body;
  
  // Precheck
  const precheckResult = await polymarketAbilityClient.precheck(
    { tokenId, side, price, amount, rpcUrl: process.env.POLYGON_RPC_URL },
    { delegatorPkpEthAddress: user.pkp_address }
  );
  
  if (!precheckResult.success) {
    return res.status(400).json({ error: precheckResult.result.reason });
  }
  
  // Execute
  const executeResult = await polymarketAbilityClient.execute(
    { tokenId, side, price, amount, rpcUrl: process.env.POLYGON_RPC_URL },
    { delegatorPkpEthAddress: user.pkp_address }
  );
  
  if (executeResult.success) {
    res.json({ orderId: executeResult.result.orderId });
  } else {
    res.status(400).json({ error: executeResult.result.error });
  }
});
```

---

## Step 5: Update Package Version (Future)

When you make changes:

### 5.1 Update version in package.json

```json
{
  "version": "1.0.1"  // Increment version
}
```

### 5.2 Rebuild and republish

```bash
npm run build
npm publish
```

### 5.3 Update in Vincent Dashboard

1. Go to your ability in the dashboard
2. Click **"Create Ability Version"**
3. Enter:
   - **Version**: `1.0.1`
   - **Changes**: Brief description of what changed
4. Click **"Create Version"**

---

## Troubleshooting

### "Package name already exists"

Change the package name in `package.json`:
```json
{
  "name": "@your-username/vincent-ability-polymarket-trade"
}
```

### "Permission denied"

You don't have access to the `@whispers` scope. Either:
1. Create an npm organization called "whispers" and add yourself
2. Use your personal username scope: `@kunalshah017/vincent-ability-polymarket-trade`

### "Vincent can't find my package"

- Wait a few minutes for npm's CDN to update
- Verify your package is public: `npm view <package-name>`
- Check that `package.json` has correct `main` and `types` fields

### "Ability not appearing in app"

- Make sure you published the App Version (not just created it)
- The transaction needs to confirm on-chain
- Check your app's abilities list in the dashboard

---

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Build
npm run build

# Publish to npm
npm publish --access public

# Update version
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# Republish after update
npm run build && npm publish
```

---

## Next Steps

After deployment:

1. ✅ Update your `IMPLEMENTATION_GUIDE.md` to reflect using the published ability
2. ✅ Install it in your server: `npm install @whispers/vincent-ability-polymarket-trade`
3. ✅ Update imports in your backend code
4. ✅ Test the full flow: connect → fund → trade
5. ✅ Share with the community!

---

## Resources

- [npm Documentation](https://docs.npmjs.com/)
- [Vincent Ability Publishing](https://docs.heyvincent.ai/ability/publishing)
- [Semantic Versioning](https://semver.org/)
