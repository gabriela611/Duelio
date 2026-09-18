import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from "viem";
import { AssetAllocation } from "@/domain/duel/Duel";

export interface PriceSnapshot {
  MON: number;
  ETH: number;
  BTC: number;
  SOL: number;
  timestamp: number;
}

export interface DuelRoundResult {
  duelId: string;
  winnerAddress: string;
  pnlA: number; // percentage e.g. +4.2%
  pnlB: number; // percentage e.g. -1.5%
  startPrices: PriceSnapshot;
  endPrices: PriceSnapshot;
  stateHash: `0x${string}`;
}

export class OffchainGameEngine {
  /**
   * Generates a baseline synthetic price snapshot with realistic asset valuations
   */
  static generatePriceSnapshot(baseTime = Date.now()): PriceSnapshot {
    return {
      MON: 1.25,
      ETH: 2650.0,
      BTC: 64200.0,
      SOL: 148.5,
      timestamp: baseTime,
    };
  }

  /**
   * Calculates total portfolio PnL given start and end prices and asset weights
   */
  static calculatePortfolioPnL(
    allocations: AssetAllocation[],
    start: PriceSnapshot,
    end: PriceSnapshot
  ): number {
    let totalPnL = 0;

    for (const item of allocations) {
      const pStart = start[item.symbol];
      const pEnd = end[item.symbol];
      if (pStart > 0) {
        const delta = (pEnd - pStart) / pStart;
        const weightedDelta = delta * (item.weightBps / 10000) * item.leverage;
        totalPnL += weightedDelta;
      }
    }

    return totalPnL * 100; // in %
  }

  /**
   * Evaluates a completed match offchain and computes the verifiable stateHash
   */
  static evaluateMatch(
    duelId: string,
    playerA: string,
    playerB: string,
    allocationsA: AssetAllocation[],
    allocationsB: AssetAllocation[],
    startPrices: PriceSnapshot,
    endPrices: PriceSnapshot
  ): DuelRoundResult {
    const pnlA = this.calculatePortfolioPnL(allocationsA, startPrices, endPrices);
    const pnlB = this.calculatePortfolioPnL(allocationsB, startPrices, endPrices);

    const winnerAddress = pnlA >= pnlB ? playerA : playerB;

    // Deterministic state hash for commitOutcome on Monad
    const encodedData = encodeAbiParameters(
      parseAbiParameters("uint256, address, int256, int256, uint256, uint256"),
      [
        BigInt(duelId),
        winnerAddress as `0x${string}`,
        BigInt(Math.round(pnlA * 100)),
        BigInt(Math.round(pnlB * 100)),
        BigInt(Math.round(startPrices.MON * 100)),
        BigInt(Math.round(endPrices.MON * 100)),
      ]
    );

    const stateHash = keccak256(encodedData);

    return {
      duelId,
      winnerAddress,
      pnlA,
      pnlB,
      startPrices,
      endPrices,
      stateHash,
    };
  }
}
