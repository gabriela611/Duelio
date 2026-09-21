/**
 * Client-side token provider registry.
 * Allows non-React services (like domain services and API repositories)
 * to retrieve the active Privy access token without prop-drilling React hooks.
 */

type TokenGetter = () => Promise<string | null>;

let currentTokenGetter: TokenGetter | null = null;

export function setAccessTokenProvider(getter: TokenGetter | null): void {
  currentTokenGetter = getter;
}

export async function getClientAccessToken(): Promise<string | null> {
  if (!currentTokenGetter) return null;
  try {
    return await currentTokenGetter();
  } catch (err) {
    console.warn("[clientToken] Failed to acquire access token:", err);
    return null;
  }
}

/**
 * Creates authenticated fetch headers by including Authorization Bearer token if available
 */
export async function getAuthHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getClientAccessToken();
  const headers: Record<string, string> = { ...customHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}
