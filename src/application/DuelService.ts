import { Duel, DuelState, AssetAllocation } from "@/domain/duel/Duel";
import { OffchainGameEngine, DuelRoundResult } from "@/infrastructure/game-engine/Engine";

export class DuelService {
  /**
   * Generates a sample live duel for instant interactive play and testing
   */
  static getSampleActiveDuel(): Duel {
    return {
      id: "101",
      creator: "0x836EF90000000000000000000000000000000001",
      playerA: "0x836EF90000000000000000000000000000000001",
      playerB: "0x836EF90000000000000000000000000000000002",
      entryStakeMon: "0.1",
      durationSeconds: 60,
      startTime: Date.now(),
      endTime: Date.now() + 60000,
      state: "ACTIVE" as DuelState,
      totalPredictionPoolA: "0.45",
      totalPredictionPoolB: "0.30",
      strategyA: {
        playerAddress: "0x836EF90000000000000000000000000000000001",
        allocations: [
          { symbol: "MON", weightBps: 5000, leverage: 2 },
          { symbol: "BTC", weightBps: 3000, leverage: 1 },
          { symbol: "ETH", weightBps: 2000, leverage: 1 },
        ],
        committedTimestamp: Date.now() - 5000,
      },
      strategyB: {
        playerAddress: "0x836EF90000000000000000000000000000000002",
        allocations: [
          { symbol: "SOL", weightBps: 6000, leverage: 2 },
          { symbol: "ETH", weightBps: 4000, leverage: 1 },
        ],
        committedTimestamp: Date.now() - 4000,
      },
    };
  }

  /**
   * Resolves a duel round and generates onchain-ready settlement proof
   */
  static resolveDuel(
    duel: Duel,
    allocA: AssetAllocation[],
    allocB: AssetAllocation[]
  ): DuelRoundResult {
    const start = OffchainGameEngine.generatePriceSnapshot();
    // Simulate real market volatility during the 60s
    const end = {
      MON: start.MON * (1 + (Math.random() * 0.04 - 0.015)), // MON outperforming
      ETH: start.ETH * (1 + (Math.random() * 0.02 - 0.01)),
      BTC: start.BTC * (1 + (Math.random() * 0.015 - 0.007)),
      SOL: start.SOL * (1 + (Math.random() * 0.03 - 0.02)),
      timestamp: Date.now(),
    };

    return OffchainGameEngine.evaluateMatch(
      duel.id,
      duel.playerA,
      duel.playerB || "0x0",
      allocA,
      allocB,
      start,
      end
    );
  }
}
