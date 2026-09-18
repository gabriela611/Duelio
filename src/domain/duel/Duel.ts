export type DuelState = "CREATED" | "JOINED" | "ACTIVE" | "COMMITTED" | "SETTLED" | "CANCELLED";

export interface AssetAllocation {
  symbol: "MON" | "ETH" | "BTC" | "SOL";
  weightBps: number; // e.g. 5000 = 50%
  leverage: 1 | 2 | 3;
}

export interface PlayerStrategy {
  playerAddress: string;
  allocations: AssetAllocation[];
  committedTimestamp: number;
}

export interface Duel {
  id: string;
  creator: string;
  playerA: string;
  playerB?: string;
  entryStakeMon: string; // Human-readable e.g. "0.1"
  durationSeconds: number;
  startTime?: number;
  endTime?: number;
  state: DuelState;
  winner?: string;
  finalStateHash?: string;
  traderPayoutMon?: string;
  totalPredictionPoolA: string;
  totalPredictionPoolB: string;
  strategyA?: PlayerStrategy;
  strategyB?: PlayerStrategy;
}

export interface DuelIntent {
  duelId: string;
  playerAddress: string;
  action: "REBALANCE" | "SPELL_SHIELD" | "SPELL_DOUBLE_DOWN";
  payload: Record<string, unknown>;
  nonce: number;
  signature: string;
}
