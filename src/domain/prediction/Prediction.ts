export interface Prediction {
  id: string;
  duelId: string;
  predictorAddress: string;
  predictedWinnerAddress: string;
  amountMon: string;
  claimed: boolean;
  payoutMon?: string;
  timestamp: number;
}

export interface PredictionOdds {
  poolA: string;
  poolB: string;
  ratioA: number; // e.g. 1.8x
  ratioB: number; // e.g. 2.2x
  percentA: number; // e.g. 55%
  percentB: number; // e.g. 45%
  windowOpen: boolean;
  remainingSecondsForPredictions: number;
}

export function calculateOdds(poolAStr: string, poolBStr: string): { percentA: number; percentB: number; multiplierA: number; multiplierB: number } {
  const a = parseFloat(poolAStr) || 0;
  const b = parseFloat(poolBStr) || 0;
  const total = a + b;

  if (total === 0) {
    return { percentA: 50, percentB: 50, multiplierA: 2.0, multiplierB: 2.0 };
  }

  const percentA = Math.round((a / total) * 100);
  const percentB = 100 - percentA;

  const multiplierA = a > 0 ? Number((total / a).toFixed(2)) : 2.0;
  const multiplierB = b > 0 ? Number((total / b).toFixed(2)) : 2.0;

  return { percentA, percentB, multiplierA, multiplierB };
}
