# Duelio

[![Monad Testnet](https://img.shields.io/badge/Monad%20Testnet-Chain%2010143-836EF9?style=for-the-badge&logo=ethereum&logoColor=white)](https://testnet.monadscan.com)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://docs.soliditylang.org/)
[![Envio](https://img.shields.io/badge/Envio-HyperIndex-FF5722?style=for-the-badge)](https://envio.dev)
[![Privy](https://img.shields.io/badge/Privy-Embedded%20Wallets-6366F1?style=for-the-badge)](https://privy.io)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Duelio is a mobile-first PvP arena for crypto trading strategies on Monad.** Two traders compete in a short, rules-bound duel while spectators follow the match, make a testnet prediction, and build a public reputation around their calls.

The product turns a private trading decision into a social, observable event: a live arena, a spectator layer, and an onchain record that can be checked after the match.

> **Live Deployment:** Duelio is deployed and verified on **Monad Testnet (Chain ID `10143`)**. All Arena duels use real on-chain escrow in `DuelArena.sol`, Pyth Network live price feeds, and EIP-712 verifiable referee outcome signatures.

## Quick Judge Summary

| Feature | Implementation | Stack / Reference |
| --- | --- | --- |
| **Blockchain** | Monad Testnet (Chain ID `10143`) | EVM 10,000 TPS, 1s block time, sub-cent gas |
| **Deployed Contract** | `DuelArena.sol` at [`0x92c227328a45269b1a6a399df7f71627e0dc209e`](https://testnet.monadscan.com/address/0x92c227328a45269b1a6a399df7f71627e0dc209e) | Monad Testnet Block `64486303` (Tx: [`0xed83d4...`](https://testnet.monadscan.com/tx/0xed83d4d40d1c748a112623809cbddd8e27035710f6fc081726ed9eac25429867)) |
| **Oracle & Pricing** | Pyth Hermes Oracle (SSE / REST) | Sub-second latency price feeds for BTC, ETH, SOL, MON |
| **Outcome Security** | EIP-712 Typed Data Evidence | Domain-separated (`chainId`, `contract`), replay-safe, deadline-enforced |
| **Indexer** | Envio HyperIndex | Real-time event indexing, deterministic replay, ELO rankings |
| **Authentication** | Privy Embedded Wallets | Web2 social login (X, Google, Farcaster) + external EVM wallets |
| **Frontend** | Next.js 15 (App Router) | Mobile-first PvP arena, dynamic sparklines, live lobby, social pulse |

## Real Two-Wallet Judge Walkthrough

Duelio runs 100% real on-chain duels escrowed by `DuelArena.sol`:

1. **Sign In:** Connect using Privy with Google, X, Farcaster, or MetaMask/Rabby on Monad Testnet.
2. **Fund Wallet:** Use the official Monad faucet (<https://testnet.monad.xyz>) if you need testnet MON.
3. **Wallet A — Create Duel:**
   - Tap **Enter 10s Arena** and choose your target asset (BTC, ETH, SOL, MON), stake (`0.05` to `0.5` MON), duration (`30s` Blitz or `60s` Standard), and directional prediction (`HIGHER` or `LOWER`).
   - Confirm transaction: `DuelArena.createDuel` escrows Player A's stake on Monad Testnet.
4. **Wallet B (or Incognito Window) — Join Duel:**
   - Connect second wallet and open the **Open Matches Lobby**.
   - Select the duel created by Wallet A and click **Join Duel** with matching stake.
   - Confirm transaction: `DuelArena.joinDuel` escrows Player B's stake.
5. **Live Match Synchronization:**
   - Both players start match on-chain via `DuelArena.startDuel`.
   - Strike price is captured from Pyth Hermes Oracle.
   - Live countdown ticks while price sparkline streams real-time ticks.
6. **Verifiable Outcome & Settlement:**
   - At expiry, final price is read and signed off-chain by the authoritative referee under EIP-712 domain separation.
   - Either player (or winner) submits `DuelArena.settleAndClaim` in a **single transaction**: validates signatures, deducts protocol fee (or 0% fee on DRAW refund), and transfers winnings directly to the winner's wallet.
7. **Social Pulse & Direct Challenge:**
   - Broadcast custom challenges to Community Pulse; clicking **Accept** routes directly into Arena with the challenge's `duelId`.

## Architecture & Security Model

```text
Next.js 15 Mobile UI
  |-- Privy embedded wallet + Monad Testnet provider
  |-- Pyth Hermes SSE stream for high-frequency pricing
  |-- Authoritative EIP-712 referee endpoint (/api/clash/referee)
  |-- Persistent social store (/api/social/feed, follow, reactions)
        |                         |
        v                         v
  DuelArena.sol  ---- events -->  Envio HyperIndex
  (canonical state)               (history, ELO rankings, global stats)
        |
        +--> on-chain escrow, predictions, EIP-712 settlement, claims
```

### Trust & Security Boundaries

- **DuelArena.sol is Canonical:** Holds all MON in escrow. Client-side declared outcomes are completely rejected. Settlement requires verified EIP-712 signatures.
- **EIP-712 Domain Separation:** Domain includes dynamic `block.chainid` and `address(this)`. Signatures cannot be replayed across forks, testnets, or contract versions.
- **Deadline Enforced:** Outcome evidence expires if submitted past `deadline`.
- **Zero Owner Bypass:** Removed all owner-bypass backdoors (`msg.sender == owner`). Settlement requires mutual consent or authorized referee signature.
- **DRAW Safety Invariant:** If `winner == address(0)`, both players receive 100% refund of their initial stake with zero fee deduction, and spectator pools refund 100% without division-by-zero.
- **Envio is a Read Model:** Reconstructs full match history and trader ELO deterministically from clean restarts.

## Onchain Lifecycle

```text
createDuel -> joinDuel -> startDuel -> commitOutcome -> settleDuel
                                                        |-> claimReward (or settleAndClaim)
                                                        `-> claimPrediction
```

## Repository Structure

```text
contracts/
  DuelArena.sol                 # Duel lifecycle, escrow, predictions, EIP-712 claims
  interfaces/IDuelArena.sol     # Contract data types and events
  artifacts/DuelArena.json      # Compiled bytecode and ABI
scripts/
  compileContracts.mjs          # Solc compiler script with viaIR optimization
  deployDuelArena.mjs           # Monad Testnet deployment & config updater
indexer/
  config.yaml                   # Envio configuration for Monad Testnet (64486303)
  schema.graphql                # Traders, duels, predictions, global stats
  src/EventHandlers.ts          # Event/state transformation logic & ELO calculation
  tests/EventHandlers.test.ts   # Deterministic replay and DRAW tests
src/
  app/                          # Next.js App Router (pages & API routes)
  domain/                       # Duel, trader, social identity & service models
  infrastructure/               # Web3, Monad chain, Pyth Hermes, Envio, Social store
  presentation/                 # Mobile-first arena, spectator, rank, profile UI
tests/
  contracts.test.ts             # Artifact ABI security & EIP-712 signature tests
  duelLifecycle.test.ts         # Two-wallet on-chain simulation tests
  settlement.test.ts            # Fail-closed legacy containment tests
  social.test.ts                # Persistent social challenges, likes, & follows tests
  pyth.test.ts                  # Hermes price parser & feed ID verification tests
```

## Run Locally

Requirements: Node.js 20+ and npm.

```bash
git clone https://github.com/gabriela611/Duelio.git
cd Duelio
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

### Automated Checks & Test Suite

All 29 tests pass with zero warnings:

```bash
# Run complete test suite (29 tests)
npm test

# Verify TypeScript types
npm run typecheck

# Run linter
npm run lint

# Build production bundle
npm run build
```

### Monad Testnet Configuration

| Network property | Value |
| --- | --- |
| Chain ID | `10143` |
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Explorer | <https://testnet.monadscan.com> |
| Native token | `MON` |
| Deployed Contract | `0x92c227328a45269b1a6a399df7f71627e0dc209e` |

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MONAD_CHAIN_ID` | Monad Testnet chain ID (`10143`) |
| `NEXT_PUBLIC_MONAD_RPC_URL` | Public Monad Testnet RPC endpoint |
| `NEXT_PUBLIC_DUEL_ARENA_ADDRESS` | Deployed `DuelArena` address (`0x92c227...`) |
| `NEXT_PUBLIC_ENVIO_ENDPOINT` | HyperIndex GraphQL endpoint |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Browser-safe Privy app ID |
| `PRIVY_APP_SECRET` | Server-side secret; never expose it to the browser |
| `NEXT_PUBLIC_PYTH_HERMES_ENDPOINT` | Pyth Hermes price feed endpoint |
| `REFEREE_PRIVATE_KEY` | Server-side referee signer for EIP-712 outcome evidence |
