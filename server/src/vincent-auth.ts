/**
 * Vincent Authentication Module
 *
 * Handles user authentication via Vincent PKPs
 */

import { verifyVincentAppUserJWT } from "@lit-protocol/vincent-app-sdk/jwt";
import { UserDB } from "./database";

const VINCENT_APP_ID = parseInt(process.env.VINCENT_APP_ID || "0");
const VINCENT_ALLOWED_AUDIENCE = process.env.VINCENT_ALLOWED_AUDIENCE || "";

if (!VINCENT_APP_ID || !VINCENT_ALLOWED_AUDIENCE) {
  throw new Error("Missing Vincent configuration in .env file");
}

console.log("✅ Vincent Auth initialized");
console.log(`   App ID: ${VINCENT_APP_ID}`);
console.log(`   Allowed Audience: ${VINCENT_ALLOWED_AUDIENCE}`);

/**
 * Get connect page URL for frontend
 */
export function getConnectPageUrl(): string {
  const redirectUri = encodeURIComponent(
    process.env.VINCENT_REDIRECT_URI || ""
  );
  return `https://dashboard.heyvincent.ai/user/appId/${VINCENT_APP_ID}/connect?redirectUri=${redirectUri}`;
}

/**
 * Handle OAuth callback and store user
 */
export async function handleAuthCallback(jwtToken: string) {
  console.log("🔐 Handling auth callback...");

  // Decode and verify JWT
  const decodedJWT = await verifyVincentAppUserJWT({
    jwt: jwtToken,
    expectedAudience: VINCENT_ALLOWED_AUDIENCE,
    requiredAppId: VINCENT_APP_ID,
  });

  if (!decodedJWT) {
    throw new Error("Invalid JWT token");
  }

  console.log("✅ JWT verified successfully");

  // Extract PKP info from the JWT
  const pkpAddress = decodedJWT.payload.pkpInfo.ethAddress;
  const pkpPublicKey = decodedJWT.payload.pkpInfo.publicKey;
  const pkpTokenId = decodedJWT.payload.pkpInfo.tokenId;
  const authMethod = decodedJWT.payload.authentication.type;
  const authValue = decodedJWT.payload.authentication.value || "";
  const expiresAt = decodedJWT.payload.exp;

  console.log(`   PKP Address: ${pkpAddress}`);
  console.log(`   Auth Method: ${authMethod}`);

  // Store/update user in database
  const user = UserDB.upsertUser({
    pkpAddress,
    pkpPublicKey,
    pkpTokenId,
    authMethod,
    authValue,
    jwt: jwtToken,
    jwtExpiresAt: expiresAt,
  });

  console.log(`✅ User stored in database (ID: ${user.id})`);

  return user;
}

/**
 * Verify JWT from request header
 */
export async function verifyRequestJWT(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No authorization token provided");
  }

  const jwt = authHeader.substring(7);

  // Verify JWT
  const decodedJWT = await verifyVincentAppUserJWT({
    jwt,
    expectedAudience: VINCENT_ALLOWED_AUDIENCE,
    requiredAppId: VINCENT_APP_ID,
  });

  if (!decodedJWT) {
    throw new Error("Invalid or expired token");
  }

  // Get user from database
  const pkpAddress = decodedJWT.payload.pkpInfo.ethAddress;
  const user = UserDB.getByPkpAddress(pkpAddress);

  if (!user) {
    throw new Error("User not found");
  }

  // Check if JWT is expired
  if (UserDB.isJwtExpired(user)) {
    throw new Error("Token expired. Please reconnect.");
  }

  return { user, decodedJWT };
}
