import { defineChain } from "viem";

const rawRpc = process.env.NEXT_PUBLIC_MONAD_RPC_URL?.trim();
const MONAD_TESTNET_RPC_URL =
  rawRpc && !rawRpc.includes("rpc.testnet.monad.xyz")
    ? rawRpc
    : "https://testnet-rpc.monad.xyz";

/**
 * Monad Testnet Chain Specification for viem and Privy
 * Chain ID: 10143
 * RPC: https://testnet-rpc.monad.xyz
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
      http: [MONAD_TESTNET_RPC_URL],
    },
    public: {
      http: [MONAD_TESTNET_RPC_URL],
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

/**
 * Duelio House / Protocol Treasury Wallet on Monad Testnet
 * Used to collect platform fees and verify fund routing
 */
export const HOUSE_TREASURY_ADDRESS =
  (process.env.NEXT_PUBLIC_HOUSE_TREASURY_ADDRESS as `0x${string}`) ||
  "0x5A9798AE1abB0b004a4d46a4dC626f87C7513D23";

