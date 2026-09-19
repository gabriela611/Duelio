import { monadTestnet, DUEL_ARENA_CONTRACT_ADDRESS } from "./monadChain";

/**
 * Privy Security Configuration & Session Signer Policies for Duelio
 *
 * Privy integration scope:
 * 1. Embedded Wallet provisioning for zero-friction judge & user onboarding.
 * 2. Scoped Delegated Actions / Session Signers restricted by contract, chain, and selector.
 * 3. Anti-abuse bounds (max testnet MON allowance, 15m session TTL, emergency revocation).
 */

export const PRIVY_APP_ID = (() => {
  const envId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  if (envId && envId.length > 5 && envId !== "replace-with-privy-app-id") {
    return envId;
  }
  return "cl00000000000000000000000";
})();

export interface SessionPolicy {
  chainId: number;
  targetContract: string;
  allowedMethods: {
    name: string;
    selector: string;
  }[];
  maxSpendMon: string;
  expiresInSeconds: number;
}

export const DUELIO_SESSION_POLICY: SessionPolicy = {
  chainId: monadTestnet.id, // Strictly Monad Testnet 10143
  targetContract: DUEL_ARENA_CONTRACT_ADDRESS,
  allowedMethods: [
    {
      name: "joinDuel",
      selector: "0x6f9fb98b", // joinDuel(uint256)
    },
    {
      name: "commitOutcome",
      selector: "0xd87870a4", // commitOutcome(uint256,address,bytes32,uint256,uint256,bytes,bytes)
    },
    {
      name: "placePrediction",
      selector: "0x9815049b", // placePrediction(uint256,address)
    },
  ],
  maxSpendMon: "0.5", // Anti-abuse limit per session
  expiresInSeconds: 900, // 15 minutes TTL
};

export const privyConfig = {
  appId: PRIVY_APP_ID,
  config: {
    defaultChain: monadTestnet,
    supportedChains: [monadTestnet],
    appearance: {
      theme: "light" as const,
      accentColor: "#836EF9" as `#${string}`, // Monad Purple
      logo: "/duelio-logo.png",
      showWalletLoginFirst: false,
    },
    loginMethods: ["google" as const, "twitter" as const, "wallet" as const, "farcaster" as const],
    embeddedWallets: {
      createOnLogin: "users-without-wallets" as const,
      requireUserPasswordOnCreate: false,
    },
  },
};
