import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateElo,
  calculateDrawElo,
  createInitialIndexerState,
  handlers,
} from "../src/EventHandlers.ts";

describe("Envio HyperIndex Event Handlers (B4)", () => {
  it("should correctly update ELO on settlement", () => {
    const winnerElo = 1200;
    const loserElo = 1200;

    const { newWinnerElo, newLoserElo } = calculateElo(winnerElo, loserElo, 32);

    assert.strictEqual(newWinnerElo, 1216);
    assert.strictEqual(newLoserElo, 1184);
  });

  it("should track duel state transition from CREATED to JOINED to SETTLED", () => {
    const state = createInitialIndexerState();

    handlers.handleDuelCreated(
      {
        params: { duelId: 1n, creator: "0xAAA", stake: 1000n, duration: 60n, rulesHash: "0x123" },
        block: { number: 100, timestamp: 1000 },
      },
      state
    );

    assert.strictEqual(state.duels["1"].state, "CREATED");

    handlers.handleDuelJoined(
      {
        params: { duelId: 1n, opponent: "0xBBB" },
        block: { number: 101, timestamp: 1010 },
      },
      state
    );

    assert.strictEqual(state.duels["1"].state, "JOINED");
    assert.strictEqual(state.duels["1"].playerB_id, "0xbbb");

    handlers.handleDuelSettled(
      {
        params: { duelId: 1n, winner: "0xAAA", traderPayout: 1960n },
        block: { number: 120, timestamp: 1070 },
      },
      state
    );

    assert.strictEqual(state.duels["1"].state, "SETTLED");
    assert.strictEqual(state.traders["0xaaa"].wins, 1);
    assert.strictEqual(state.traders["0xbbb"].losses, 1);
    assert.ok(state.traders["0xaaa"].elo > 1200);
    assert.ok(state.traders["0xbbb"].elo < 1200);
  });

  it("should deterministically reconstruct duel history and leaderboard from clean restart", () => {
    const state = createInitialIndexerState();

    // Event 1: Duel 1 created by Trader A with 0.5 MON (500000000000000000n)
    handlers.handleDuelCreated(
      {
        params: {
          duelId: 1n,
          creator: "0x1111111111111111111111111111111111111111",
          stake: 500000000000000000n,
          duration: 30n,
          rulesHash: "0xaaa",
        },
        block: { number: 100, timestamp: 1000 },
      },
      state
    );

    // Event 2: Trader B joins Duel 1
    handlers.handleDuelJoined(
      {
        params: {
          duelId: 1n,
          opponent: "0x2222222222222222222222222222222222222222",
        },
        block: { number: 101, timestamp: 1005 },
      },
      state
    );

    // Event 3: Duel 1 starts
    handlers.handleDuelStarted(
      {
        params: {
          duelId: 1n,
          startTime: 1010n,
          endTime: 1040n,
        },
        block: { number: 102, timestamp: 1010 },
      },
      state
    );

    // Event 4: Spectator S places prediction on Trader A
    handlers.handlePredictionPlaced(
      {
        params: {
          duelId: 1n,
          predictor: "0x3333333333333333333333333333333333333333",
          predictedWinner: "0x1111111111111111111111111111111111111111",
          amount: 100000000000000000n,
        },
        block: { number: 103, timestamp: 1015 },
      },
      state
    );

    // Event 5: Outcome committed (Trader A wins)
    handlers.handleOutcomeCommitted(
      {
        params: {
          duelId: 1n,
          winner: "0x1111111111111111111111111111111111111111",
          stateHash: "0x999",
          priceStart: 95000n,
          priceEnd: 96000n,
        },
        block: { number: 110, timestamp: 1045 },
      },
      state
    );

    // Event 6: Duel settled
    handlers.handleDuelSettled(
      {
        params: {
          duelId: 1n,
          winner: "0x1111111111111111111111111111111111111111",
          traderPayout: 980000000000000000n,
          spectatorPoolPayout: 100000000000000000n,
        },
        block: { number: 111, timestamp: 1046 },
      },
      state
    );

    // Event 7: Reward claimed
    handlers.handleRewardClaimed(
      {
        params: {
          duelId: 1n,
          claimant: "0x1111111111111111111111111111111111111111",
          amount: 980000000000000000n,
        },
        block: { number: 112, timestamp: 1050 },
      },
      state
    );

    // Assertions on reconstructed state
    const duel1 = state.duels["1"];
    assert.strictEqual(duel1.state, "SETTLED");
    assert.strictEqual(duel1.traderRewardsClaimed, true);
    assert.strictEqual(duel1.totalPredictionPoolA, 100000000000000000n);

    const traderA = state.traders["0x1111111111111111111111111111111111111111"];
    const traderB = state.traders["0x2222222222222222222222222222222222222222"];

    assert.strictEqual(traderA.wins, 1);
    assert.strictEqual(traderA.winStreak, 1);
    assert.strictEqual(traderA.totalMonWon, 980000000000000000n);
    assert.strictEqual(traderA.elo, 1216);

    assert.strictEqual(traderB.losses, 1);
    assert.strictEqual(traderB.winStreak, 0);
    assert.strictEqual(traderB.elo, 1184);

    // Global volume and counters
    assert.strictEqual(state.globalStats.totalDuelsCreated, 1);
    assert.strictEqual(state.globalStats.totalDuelsSettled, 1);
    assert.strictEqual(state.globalStats.totalVolumeMon, 1000000000000000000n);
    assert.strictEqual(state.globalStats.totalPredictionsPlaced, 1);
  });

  it("should handle DRAW settlement and update draw stats and neutral ELO", () => {
    const state = createInitialIndexerState();

    handlers.handleDuelCreated(
      {
        params: { duelId: 2n, creator: "0xAAA", stake: 500n, duration: 30n, rulesHash: "0x" },
        block: { number: 200, timestamp: 2000 },
      },
      state
    );

    handlers.handleDuelJoined(
      {
        params: { duelId: 2n, opponent: "0xBBB" },
        block: { number: 201, timestamp: 2010 },
      },
      state
    );

    // Settled with winner = address(0) (DRAW)
    handlers.handleDuelSettled(
      {
        params: {
          duelId: 2n,
          winner: "0x0000000000000000000000000000000000000000",
          traderPayout: 0n,
          spectatorPoolPayout: 0n,
        },
        block: { number: 210, timestamp: 2040 },
      },
      state
    );

    const traderA = state.traders["0xaaa"];
    const traderB = state.traders["0xbbb"];

    assert.strictEqual(traderA.draws, 1);
    assert.strictEqual(traderB.draws, 1);
    assert.strictEqual(traderA.wins, 0);
    assert.strictEqual(traderA.losses, 0);
    assert.strictEqual(traderA.totalDuels, 1);
    // ELO between equals on draw stays 1200
    assert.strictEqual(traderA.elo, 1200);
    assert.strictEqual(traderB.elo, 1200);
  });

  it("should handle duel cancellation", () => {
    const state = createInitialIndexerState();

    handlers.handleDuelCreated(
      {
        params: { duelId: 3n, creator: "0xCCC", stake: 500n, duration: 30n, rulesHash: "0x" },
        block: { number: 300, timestamp: 3000 },
      },
      state
    );

    assert.strictEqual(state.duels["3"].state, "CREATED");

    handlers.handleDuelCancelled(
      {
        params: { duelId: 3n, reason: "Abandoned" },
        block: { number: 301, timestamp: 3010 },
      },
      state
    );

    assert.strictEqual(state.duels["3"].state, "CANCELLED");
  });
});
