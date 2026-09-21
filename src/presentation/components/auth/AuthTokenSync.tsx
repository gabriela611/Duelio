"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { setAccessTokenProvider } from "@/infrastructure/auth/clientToken";

/**
 * Syncs the Privy session token getter with the infrastructure layer.
 * Mounts once at the root provider level.
 */
export function AuthTokenSync() {
  const { getAccessToken, authenticated } = usePrivy();

  useEffect(() => {
    if (authenticated) {
      setAccessTokenProvider(() => getAccessToken());
    } else {
      setAccessTokenProvider(null);
    }
  }, [authenticated, getAccessToken]);

  return null;
}
