import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateElo, handlers } from "../src/EventHandlers.ts";

/**
 * Verification test for Envio HyperIndex logic
 */
describe("Envio HyperIndex Event Handlers", () => {
  it("should correctly update ELO on settlement", () => {
    const winnerElo = 1200;
    const loserElo = 1200;

    const { newWinnerElo, newLoserElo } = calculateElo(winnerElo, loserElo, 32);

    assert.strictEqual(newWinnerElo, 1216);
    assert.strictEqual(newLoserElo, 1184);
  });

  it("should track duel state transition from CREATED to JOINED to SETTLED", () => {
    const state: any = {
      duels: {},
      traders: {},
      predictions: {},
    };

    handlers.handleDuelCreated(
      {
        params: { duelId: 1n, creator: "0xAAA", stake: 1000n, duration: 60n },
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
});
