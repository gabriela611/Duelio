import { calculateElo, handlers } from "../src/EventHandlers";

/**
 * Verification test for Envio HyperIndex logic
 */
describe("Envio HyperIndex Event Handlers", () => {
  it("should correctly update ELO on settlement", () => {
    const winnerElo = 1200;
    const loserElo = 1200;

    const { newWinnerElo, newLoserElo } = calculateElo(winnerElo, loserElo, 32);

    expect(newWinnerElo).toBe(1216);
    expect(newLoserElo).toBe(1184);
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

    expect(state.duels["1"].state).toBe("CREATED");

    handlers.handleDuelJoined(
      {
        params: { duelId: 1n, opponent: "0xBBB" },
        block: { number: 101, timestamp: 1010 },
      },
      state
    );

    expect(state.duels["1"].state).toBe("JOINED");
    expect(state.duels["1"].playerB_id).toBe("0xbbb");

    handlers.handleDuelSettled(
      {
        params: { duelId: 1n, winner: "0xAAA", traderPayout: 1960n },
        block: { number: 120, timestamp: 1070 },
      },
      state
    );

    expect(state.duels["1"].state).toBe("SETTLED");
    expect(state.traders["0xaaa"].wins).toBe(1);
    expect(state.traders["0xbbb"].losses).toBe(1);
    expect(state.traders["0xaaa"].elo).toBeGreaterThan(1200);
    expect(state.traders["0xbbb"].elo).toBeLessThan(1200);
  });
});
