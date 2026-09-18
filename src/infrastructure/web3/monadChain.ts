import { defineChain } from "viem";

/**
 * Official Monad Testnet Chain Definition for Viem / Wagmi
 * Chain ID: 10143
 * RPC: https://rpc.testnet.monad.xyz
 * Explorer: https://testnet.monadscan.com
 */
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.monad.xyz"],
    },
    public: {
      http: ["https://rpc.testnet.monad.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Monadscan",
      url: "https://testnet.monadscan.com",
    },
  },
  testnet: true,
});

export const DUEL_ARENA_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_DUEL_ARENA_ADDRESS as `0x${string}`) ||
  "0x0000000000000000000000000000000000000000";
