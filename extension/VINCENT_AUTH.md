# Vincent Authentication Flow

## Overview

The extension integrates Vincent PKP authentication to provide each user with their own non-custodial wallet for Polymarket trading.

## Authentication Flow

### 1. User Initiates Connection

- User clicks "Connect with Vincent" button in the extension popup
- Extension calls `openConnectPage()` which opens Vincent Dashboard in a new tab

### 2. Vincent Dashboard Authentication

- User authenticates on Vincent Dashboard (email, phone, or passkey)
- Vincent Dashboard creates/retrieves user's PKP wallet
- User grants permissions for the app

### 3. OAuth Callback

- Vincent Dashboard redirects to backend: `http://localhost:3000/auth/callback?jwt=<token>`
- Backend verifies JWT signature and audience
- Backend extracts PKP info (address, publicKey, tokenId) from JWT
- Backend stores user in database
- Backend redirects to extension success page: `chrome-extension://.../src/success.html?jwt=<token>&pkp=<address>&auth=<method>`

### 4. Extension Storage

- `success.html` stores JWT in `chrome.storage.local`
- Extension popup detects authentication completion
- Extension fetches user info and wallet balance from backend

### 5. Authenticated API Calls

All subsequent API calls include the JWT:

```typescript
fetch(`${BACKEND_URL}/api/user/me`, {
  headers: {
    Authorization: `Bearer ${jwt}`,
  },
});
```

## Files

### Frontend (Extension)

- `src/lib/vincentAuth.ts` - Authentication helper functions
- `src/success.html` - OAuth callback success page
- `src/Popup.tsx` - Updated UI with Vincent wallet integration

### Backend (Server)

- `src/vincent-auth.ts` - JWT verification and user management
- `src/index.ts` - Auth routes (/auth/connect-url, /auth/callback, /api/user/me, etc.)

## Storage

### chrome.storage.local

```typescript
{
  vincent_jwt: string,           // JWT token from Vincent
  vincent_pkp_address: string,   // User's PKP wallet address
  vincent_auth_method: string    // Auth method (email/phone/passkey)
}
```

### Backend Database (SQLite)

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  pkp_address TEXT UNIQUE,
  pkp_public_key TEXT,
  pkp_token_id TEXT,
  auth_method TEXT,
  jwt TEXT,
  jwt_expires_at INTEGER,
  created_at TEXT
);
```

## API Endpoints

### GET /auth/connect-url

Returns Vincent Dashboard connect page URL

### GET /auth/callback?jwt=<token>

OAuth callback handler, verifies JWT and stores user

### GET /api/user/me

Returns authenticated user info (requires JWT)

### GET /api/wallet/balance

Returns USDC and POL balances (requires JWT, cached 30s)

### GET /api/trades

Returns user's trade history (requires JWT)

## Environment Variables

### Backend (.env)

```env
VINCENT_APP_ID=4430578334
VINCENT_APP_VERSION=1
VINCENT_REDIRECT_URI=http://localhost:3000/auth/callback
VINCENT_ALLOWED_AUDIENCE=localhost:3000
```

## Testing the Flow

1. Start backend server:

   ```bash
   cd server
   npm run dev
   ```

2. Build extension:

   ```bash
   cd extension
   npm run dev
   ```

3. Load unpacked extension in Chrome
4. Click extension icon
5. Click "Connect with Vincent"
6. Authenticate on Vincent Dashboard
7. Extension should show connected wallet with balances

## Troubleshooting

### JWT Verification Fails

- Check `VINCENT_ALLOWED_AUDIENCE` matches redirect URI domain
- Check `VINCENT_APP_ID` matches your app ID on Vincent Dashboard

### Success Page Not Loading

- Check `manifest.json` includes `src/success.html` in web_accessible_resources
- Check backend redirect URL is correct
- Check extension ID matches in redirect URL

### Balance Not Showing

- Check Polygon RPC is working: `https://polygon-rpc.com`
- Check USDC contract address: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`
- User needs to fund their PKP wallet with USDC and POL
