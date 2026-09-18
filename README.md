# ⚔️ Duelio — The Clash Royale of Crypto Trading on Monad

> **PvP Portfolio Arena & Spectator Attention Economy** built natively for **Monad Testnet** (Chain ID: `10143`), powered by **Envio HyperIndex** and **Privy Session Signers**.

---

## 🎯 Hackathon Tracks & Bounties

1. **Primary Track — Social, Attention & Culture**:
   - Transforming trading from solitary speculation into a high-stakes, spectator-driven arena.
   - Spectators back traders in real-time onchain prediction pools, capturing real economic upside from their attention and market insights.
   - Onchain ELO rating and reputation system that turns trading prowess into verifiable social status.

2. **Envio Bounty ($1,000 USD — Best Use of Envio)**:
   - Complete **Envio HyperIndex** pipeline (`indexer/config.yaml`, `indexer/schema.graphql`, `indexer/src/EventHandlers.ts`).
   - Indexes `DuelCreated`, `DuelJoined`, `PredictionPlaced`, and `DuelSettled` events to power low-latency leaderboards, win streaks, and live spectator odds without saturating RPC endpoints.
   - Features real-time `_meta` block height observability to monitor indexer sync status.

3. **Privy Bounty ($5,000 USD — Beyond Authentication)**:
   - **Embedded Wallets**: Zero-friction onboarding for judges and users via Google, Twitter/X, or Farcaster with no browser extension required.
   - **Strict Session Signer Policies**: Scoped explicitly to Monad Testnet (`10143`), target contract (`DuelArena.sol`), approved selectors (`joinDuel`, `commitOutcome`, `placePrediction`), and a max spend allowance with emergency revocation.
   - **Cross-Identity Linking**: Linking Web2 social graphs (Twitter/X handle & avatar) to onchain Monad player profiles.

---

## 🏛️ System Architecture & Trust Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     DUELIO WEB APP (Mobile-First Shell)                 │
│                                                                         │
│  ┌─────────────────────────┐    ┌────────────────────────────────────┐  │
│  │   Privy Layer           │    │   Arena & Spectator Engine         │  │
│  │   - Embedded Wallets    │    │   - Clash Royale Viewport          │  │
│  │   - Scoped Session Key  │    │   - PnL Health Bars (Framer Motion)│  │
│  │   - Emergency Revoke    │    │   - Dynamic Odds & Live Taunts     │  │
│  └────────────┬────────────┘    └─────────────────┬──────────────────┘  │
│               │                                   │                     │
└───────────────┼───────────────────────────────────┼─────────────────────┘
                │ (Scoped Session Signer Intents)   │ (Read-Only GraphQL)
                ▼                                   ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────┐
│     MONAD TESTNET (10143)     │   │          ENVIO HYPERINDEX           │
│  DuelArena.sol                │──▶│  schema.graphql & EventHandlers.ts  │
│  - Single Source of Truth     │   │  - Real-time ELO calculations       │
│  - Escrow Stakes & Payouts    │   │  - _meta indexer sync monitoring    │
│  - Spectator Prediction Pool  │   │  - Historical Trader Stats          │
└───────────────────────────────┘   └─────────────────────────────────────┘
```

### Claridad en los Límites de Confianza (Trust Boundaries):
- **Onchain (`DuelArena.sol`)**: La única autoridad para balances, custodia de stakes en testnet $MON, reglas de tiempo, validación de firmas y distribución de pagos.
- **Offchain (Game Loop)**: Las fluctuaciones de portafolio y tácticas de 60 segundos se calculan offchain; se genera un `stateHash` verificable firmado por los participantes o el árbitro para liquidar en el contrato.
- **Indexador (`Envio HyperIndex`)**: Fuente de solo lectura para historiales y rankings agregados. **Nunca** interviene en el consenso ni en la autorización de fondos.

---

## 🛡️ Reglas de Seguridad y Anti-Abuso

1. **Anti-Frontrunning en Predicciones**: Las predicciones de los espectadores se congelan automáticamente al cumplirse el **50% de la duración del duelo** (segundo 30 de 60).
2. **Anti-Self-Betting**: Los jugadores del duelo (`playerA` y `playerB`) tienen prohibido participar en el pool de predicciones de su propio combate.
3. **Privy Security Policy**:
   - Red objetivo: Únicamente Monad Testnet (Chain ID `10143`).
   - Contrato autorizado: Únicamente `DuelArena.sol`.
   - Métodos permitidos: `joinDuel`, `commitOutcome`, `placePrediction`.
   - Límite de gasto: 0.5 testnet MON por sesión.
   - Botón visible de **Emergency Revoke** en el perfil del usuario.

---

## 🎬 Guía de Demo para los Jueces (90 Segundos)

1. **Onboarding Instantáneo**: Ingresa a la app y haz clic en **"Login (Privy)"** para autenticarte con un clic mediante Google o Twitter (se genera tu embedded wallet en Monad sin necesidad de MetaMask).
2. **Entrar a la Arena**: Ve a la pestaña **Arena**; observarás el duelo activo entre *MonadWhale* y *CryptoKnight*.
3. **Interacción Táctica**: Toca las cartas de activos (**MON**, **BTC**, **ETH**, **SOL**) para rebalancear el portafolio en tiempo real mientras las barras de vida de PnL fluctúan.
4. **Predicciones de Espectadores**: Cambia a la pestaña **Spectate**; observa la barra de cuotas dinámicas y realiza una predicción con testnet $MON antes de que se cierre la ventana de tiempo.
5. **Liquidación en Monad**: Haz clic en **"COMMIT & SETTLE DUEL"**; el resultado se evalúa, se genera el hash de estado y se liquida onchain.
6. **Verificación en Envio**: Ve a la pestaña **Rank**; verás el leaderboard impulsado por Envio con el bloque sincronizado (`_meta`).

---

## 📦 Estructura del Repositorio

```text
Duelio/
├── contracts/               # Smart Contracts en Solidity
│   ├── interfaces/
│   │   └── IDuelArena.sol   # Máquina de estados y eventos canónicos
│   ├── DuelArena.sol        # Contrato principal unificado
│   └── test/
│       └── DuelArena.t.sol  # Tests de ciclo de vida
├── indexer/                 # Pipeline de Envio HyperIndex
│   ├── config.yaml          # Configuración para Monad Testnet (10143)
│   ├── schema.graphql       # Esquema para Traders, Duels y Predictions
│   ├── src/
│   │   └── EventHandlers.ts # Manejadores de eventos y cálculo de ELO
│   └── tests/
│       └── EventHandlers.test.ts # Tests de idempotencia
├── src/
│   ├── domain/              # Entidades puras (Duel, Trader, Prediction)
│   ├── application/         # Servicios de aplicación y orquestación
│   ├── infrastructure/      # Viem, Monad Chain, Privy Policies, Envio Client
│   ├── presentation/        # Componentes mobile-first estilo Clash Royale
│   └── app/                 # Next.js 15 App Router
├── .env.example             # Variables de entorno requeridas
└── README.md
```

---

## 🚀 Instalación y Ejecución Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/gabriela611/Duelio.git
cd Duelio

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local

# 4. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
