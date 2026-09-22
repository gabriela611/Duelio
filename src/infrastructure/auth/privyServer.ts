import { PrivyClient, type User, type AuthTokenClaims } from "@privy-io/server-auth";
import { normalizeAddress } from "../../domain/social/identity.ts";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

let privyClientInstance: PrivyClient | null = null;

export function getPrivyServerClient(): PrivyClient {
  if (!privyClientInstance) {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
      throw new Error("AUTH_CONFIG_ERROR: Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET in server environment");
    }
    privyClientInstance = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  }
  return privyClientInstance;
}

export interface AuthenticatedSession {
  userId: string; // Privy DID e.g. "did:privy:..."
  walletAddress?: string; // Verified EVM address normalized to lowercase
  claims: AuthTokenClaims;
  user?: User;
}

/**
 * Extracts Bearer token from Request Authorization header or cookies
 */
export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  
  // Fallback to cookie if present
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)privy-token=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }

  return null;
}

/**
 * Extracts the primary verified EVM wallet from a Privy User object
 */
export function extractPrimaryWallet(user: User): string | undefined {
  if (user.wallet?.address && user.wallet.chainType === "ethereum") {
    return normalizeAddress(user.wallet.address);
  }

  const walletAccount = user.linkedAccounts?.find(
    (account) => account.type === "wallet" && (account as any).chainType === "ethereum"
  );
  if (walletAccount && (walletAccount as any).address) {
    return normalizeAddress((walletAccount as any).address);
  }

  return undefined;
}

/**
 * Verifies the incoming HTTP request's Privy authentication.
 * Throws an error or returns null depending on required flag.
 */
export async function authenticateRequest(
  req: Request,
  options: { required?: boolean } = { required: true }
): Promise<AuthenticatedSession | null> {
  const token = extractAuthToken(req);

  if (!token) {
    if (options.required) {
      throw new Error("UNAUTHORIZED: Missing or malformed Bearer authorization token");
    }
    return null;
  }

  const client = getPrivyServerClient();
  try {
    const claims = await client.verifyAuthToken(token);
    let user: User | undefined;
    let walletAddress: string | undefined;

    try {
      user = await client.getUser(claims.userId);
      if (user) {
        walletAddress = extractPrimaryWallet(user);
      }
    } catch (userErr) {
      // In high-throughput read cases, getUser network failure shouldn't completely fail
      // if we only need the verified DID
      console.warn(`[PrivyServer] Failed to fetch full user for ${claims.userId}:`, userErr);
    }

    return {
      userId: claims.userId,
      walletAddress,
      claims,
      user,
    };
  } catch (err: any) {
    if (options.required) {
      throw new Error(`UNAUTHORIZED: Invalid authentication token (${err?.message || "verification failed"})`);
    }
    return null;
  }
}
