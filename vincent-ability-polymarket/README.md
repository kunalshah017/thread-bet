# @whispers/vincent-ability-polymarket-trade

A [Vincent Ability](https://docs.heyvincent.ai/) for trading on [Polymarket](https://polymarket.com) prediction markets.

## Features

- ✅ Place BUY orders on Polymarket markets
- ✅ Place SELL orders on Polymarket markets
- ✅ Automatic USDC balance validation
- ✅ Automatic USDC allowance checking
- ✅ Secure execution via PKP signing in Lit Actions
- ✅ Type-safe parameters with Zod validation

## Installation

```bash
npm install @whispers/vincent-ability-polymarket-trade
```

## Peer Dependencies

This package requires the following peer dependencies:

```json
{
  "@lit-protocol/vincent-ability-sdk": "^0.1.0",
  "@polymarket/clob-client": "^7.0.0",
  "ethers": "^5.7.0",
  "zod": "^3.22.0"
}
```

## Usage

### In Your Vincent App Backend

```typescript
import { getVincentAbilityClient } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { bundledVincentAbility } from '@whispers/vincent-ability-polymarket-trade';
import { ethers } from 'ethers';

// Your delegatee signer
const delegateeSigner = new ethers.Wallet('YOUR_DELEGATEE_PRIVATE_KEY');

// Create ability client
const polymarketAbilityClient = getVincentAbilityClient({
  bundledVincentAbility,
  ethersSigner: delegateeSigner,
});

// Run precheck
const precheckResult = await polymarketAbilityClient.precheck(
  {
    tokenId: '21742633143463906290569050155826241533067272736897614950488156847949938836455',
    side: 'BUY',
    price: 0.65,
    amount: 10, // 10 USDC
    rpcUrl: 'https://polygon-rpc.com',
  },
  {
    delegatorPkpEthAddress: '0x...', // User's PKP wallet address
  }
);

if (precheckResult.success) {
  console.log('Balance:', precheckResult.result.usdcBalance);
  console.log('Allowance:', precheckResult.result.usdcAllowance);
  
  // Execute trade
  const executeResult = await polymarketAbilityClient.execute(
    {
      tokenId: '21742633143463906290569050155826241533067272736897614950488156847949938836455',
      side: 'BUY',
      price: 0.65,
      amount: 10,
      rpcUrl: 'https://polygon-rpc.com',
    },
    {
      delegatorPkpEthAddress: '0x...',
    }
  );
  
  if (executeResult.success) {
    console.log('Order placed! Order ID:', executeResult.result.orderId);
  }
}
```

## Parameters

### Ability Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenId` | string | Yes | Polymarket outcome token ID (256-bit integer as string) |
| `side` | `'BUY'` \| `'SELL'` | Yes | Order side |
| `price` | number | Yes | Price as decimal (0.01 to 0.99, representing 1% to 99%) |
| `amount` | number | Yes | For BUY: USDC amount to spend. For SELL: Number of shares to sell |
| `rpcUrl` | string | No | Polygon RPC endpoint (defaults to 'https://polygon-rpc.com') |

### Execution Context

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `delegatorPkpEthAddress` | string | Yes | User's PKP wallet address |

## Response Schemas

### Precheck Success

```typescript
{
  usdcBalance: number;      // Current USDC balance
  usdcAllowance: number;    // Current USDC allowance for CTF Exchange
  requiredAmount: number;   // Required USDC for this trade
  hasBalance: boolean;      // Whether wallet has sufficient USDC
  hasAllowance: boolean;    // Whether USDC allowance is sufficient
}
```

### Precheck Fail

```typescript
{
  reason: string;           // Reason for precheck failure
  usdcBalance?: number;     // Current USDC balance
  usdcAllowance?: number;   // Current USDC allowance
  requiredAmount?: number;  // Required amount
}
```

### Execute Success

```typescript
{
  orderId: string;          // Polymarket order ID
  price: number;            // Order price
  size: number;             // Order size in shares
  side: 'BUY' | 'SELL';     // Order side
}
```

### Execute Fail

```typescript
{
  error: string;            // Error message
  code?: string;            // Error code
}
```

## Examples

### Buy 10 USDC worth of YES tokens at 65%

```typescript
const result = await polymarketAbilityClient.execute(
  {
    tokenId: '21742633143463906290569050155826241533067272736897614950488156847949938836455',
    side: 'BUY',
    price: 0.65,
    amount: 10, // 10 USDC
    rpcUrl: 'https://polygon-rpc.com',
  },
  {
    delegatorPkpEthAddress: userPkpAddress,
  }
);
// Result: Buys ~15.38 shares (10 USDC / 0.65 price)
```

### Sell 20 shares at 70%

```typescript
const result = await polymarketAbilityClient.execute(
  {
    tokenId: '21742633143463906290569050155826241533067272736897614950488156847949938836455',
    side: 'SELL',
    price: 0.70,
    amount: 20, // 20 shares
    rpcUrl: 'https://polygon-rpc.com',
  },
  {
    delegatorPkpEthAddress: userPkpAddress,
  }
);
// Result: Sells 20 shares for 14 USDC (20 shares * 0.70 price)
```

## Prerequisites

Users must:

1. Have USDC balance on Polygon for BUY orders
2. Have approved USDC to the CTF Exchange contract (`0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`)
3. Have POL tokens for gas fees
4. Have the shares for SELL orders

## Contract Addresses (Polygon)

- **CTF Exchange**: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`
- **USDC**: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## Resources

- [Vincent Documentation](https://docs.heyvincent.ai/)
- [Polymarket API](https://docs.polymarket.com/)
- [Lit Protocol](https://developer.litprotocol.com/)

## License

MIT

## Author

Whispers Team

## Support

For issues and questions:
- GitHub: https://github.com/kunalshah017/thread-bet
- Vincent Discord: https://discord.gg/litprotocol
- Polymarket Discord: https://discord.gg/polymarket
