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

> **Demo status:** Duelio is a hackathon prototype on Monad Testnet. It uses testnet MON only. The current UI includes a simulated game loop; the contract and indexer define the settlement and data contracts that the production loop will call.

## Quick Judge Summary

| Feature | Implementation | Stack / Reference |
| --- | --- | --- |
| **Blockchain** | Monad Testnet (Chain ID `10143`) | EVM 10,000 TPS, 1s block time, sub-cent gas |
| **Smart Contracts** | `DuelArena.sol` | Solidity `^0.8.24`, escrow, predictions, deterministic payouts |
| **Indexer** | Envio HyperIndex | Real-time event indexing, trader ELO rankings, GraphQL API |
| **Authentication** | Privy Embedded Wallets | Web2 social login (X, Google, Farcaster) + scoped session policies |
| **Frontend** | Next.js 15 (App Router) | Mobile-first PvP arena, tactical asset cards, spectator view |

## Why Duelio

- **Fast social loop:** join a duel, make tactical portfolio decisions, and watch the outcome in a compact arena.
- **Low-friction onboarding:** Privy embedded wallets let a judge enter without installing a browser extension.
- **Verifiable outcomes:** the smart contract owns duel state, escrow, prediction pools, and claims.
- **Queryable reputation:** Envio HyperIndex turns contract events into duel history, trader statistics, and leaderboards.

## Judge Walkthrough

1. Open the app and sign in with Google, Twitter/X, Farcaster, or an existing wallet through Privy.
2. Enter the Arena view and inspect the active duel and its rules.
3. Use the tactical asset controls during the short game loop.
4. Open Spectate and inspect the prediction flow before the prediction window closes.
5. In the prototype, inspect the simulated settlement state. In a deployed environment, this step resolves through `DuelArena.sol` on Monad Testnet.
6. Open Leaderboard to see the local/indexed duel view and the intended indexer sync indicator.

## Architecture

```text
Next.js mobile UI
  |-- Privy embedded wallet + scoped session policy
  |-- Offchain game loop and signed outcome transcript
  |-- Read-only GraphQL queries
        |                         |
        v                         v
  DuelArena.sol  ---- events -->  Envio HyperIndex
  (canonical state)               (history and analytics)
        |
        +--> escrow, prediction pools, settlement, claims
```

### Trust boundaries

- **DuelArena.sol is canonical.** It validates the duel lifecycle, holds testnet MON escrow, closes prediction windows, records the outcome commitment, and exposes claim paths.
- **The game loop is offchain.** The prototype produces a deterministic transcript and `stateHash`; the contract receives signed evidence for settlement. Price snapshots and the rule-set hash are part of the committed outcome.
- **Envio is a read model.** HyperIndex powers history and rankings from emitted events. It is not a matching engine, oracle, wallet, or settlement authority. The UI should treat its data as eventually consistent and expose `_meta` freshness.
- **Privy is scoped.** The session policy is restricted to Monad Testnet (`10143`), the deployed DuelArena address, approved methods, a spend cap, and a short expiry. Users can revoke the session.

## Onchain Lifecycle

```text
createDuel -> joinDuel -> startDuel -> commitOutcome -> settleDuel
                                                        |-> claimReward
                                                        `-> claimPrediction
```

Spectator predictions are limited to the two participants, reject self-betting, and close at the midpoint of an active duel. Protocol and payout rules are encoded in the contract and should be reviewed before any mainnet deployment.

## Repository

```text
contracts/
  DuelArena.sol                 # Duel lifecycle, escrow, predictions, claims
  interfaces/IDuelArena.sol     # Contract data types and events
  test/DuelArena.t.sol          # Contract lifecycle tests
indexer/
  config.yaml                   # Envio configuration for Monad Testnet
  schema.graphql                # Traders, duels, predictions, global stats
  src/EventHandlers.ts          # Event/state transformation logic
  tests/EventHandlers.test.ts   # Handler tests
src/
  app/                          # Next.js App Router entry points
  domain/                       # Duel, trader, and prediction models
  application/                  # Duel orchestration
  infrastructure/               # Monad, Privy, Envio, and game-engine adapters
  presentation/                 # Mobile-first arena, spectator, rank, profile UI
.env.example                    # Safe local configuration template
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

The default public configuration targets Monad Testnet, chain ID `10143`. Replace the zero address and placeholder Privy app ID with your deployment values in `.env.local`. Never commit `.env.local`, private keys, app secrets, or deployed credentials.

### Automated Checks & Testing

```bash
# Run unit tests (Envio handlers & ELO algorithm)
npm test

# Verify TypeScript types
npm run typecheck

# Run linter
npm run lint

# Build production bundle
npm run build
```

### Monad Testnet

| Network property | Value |
| --- | --- |
| Chain ID | `10143` |
| RPC URL | `https://rpc.testnet.monad.xyz` |
| Explorer | <https://testnet.monadscan.com> |
| Native token | `MON` |

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MONAD_CHAIN_ID` | Monad Testnet chain ID (`10143`) |
| `NEXT_PUBLIC_MONAD_RPC_URL` | Public Monad Testnet RPC endpoint |
| `NEXT_PUBLIC_DUEL_ARENA_ADDRESS` | Deployed `DuelArena` address |
| `NEXT_PUBLIC_ENVIO_ENDPOINT` | HyperIndex GraphQL endpoint |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Browser-safe Privy app ID |
| `PRIVY_APP_SECRET` | Server-side secret; never expose it to the browser |

## Scope and Limitations

- Testnet only; no real-money trading or wagering is supported.
- The current game loop is a prototype and does not execute external asset trades.
- The contract accepts signed outcome evidence; production deployments need an audited referee/oracle design, finalized-block handling, and stronger dispute/recovery paths.
- Indexer views can lag the chain and can be rolled back during reorganization. Settlement and withdrawals must be checked against finalized onchain state.

## References

- [Monad Testnet](https://docs.monad.xyz/guides/verify-smart-contract/hardhat) — chain ID `10143` and RPC configuration.
- [Monad block states](https://docs.monad.xyz/monad-arch/consensus/block-states) — finalized state semantics.
- [Envio HyperIndex](https://docs.envio.dev/docs/HyperIndex/overview) — event indexing and GraphQL read models.
- [Privy session signers](https://docs.privy.io/wallets/using-wallets/signers/use-signers) — scoped delegated wallet actions.
