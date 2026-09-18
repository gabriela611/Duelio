/**
 * Envio HyperIndex Event Handlers for Duelio on Monad Testnet (10143)
 * Provides real-time indexed data for leaderboards, duels, and spectator prediction analytics.
 */

export function calculateElo(winnerElo: number, loserElo: number, kFactor = 32): { newWinnerElo: number; newLoserElo: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

  const newWinnerElo = Math.round(winnerElo + kFactor * (1 - expectedWinner));
  const newLoserElo = Math.round(loserElo + kFactor * (0 - expectedLoser));

  return { newWinnerElo, newLoserElo: Math.max(100, newLoserElo) };
}

// In Envio, handlers are registered using `DuelArena.DuelCreated.handler(async ({ event, context }) => ...)`
// Here we define the canonical handler logic functions for testing and production indexing.

export const handlers = {
  handleDuelCreated: (event: any, state: any) => {
    const duelId = event.params.duelId.toString();
    const creator = event.params.creator.toLowerCase();

    // Ensure trader exists
    if (!state.traders[creator]) {
      state.traders[creator] = {
        id: creator,
        address: creator,
        totalDuels: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        winStreak: 0,
        bestStreak: 0,
        elo: 1200,
        totalMonWon: 0n,
      };
    }

    state.duels[duelId] = {
      id: duelId,
      duelId: BigInt(duelId),
      creator,
      playerA_id: creator,
      playerB_id: null,
      entryStake: BigInt(event.params.stake),
      duration: BigInt(event.params.duration),
      state: "CREATED",
      totalPredictionPoolA: 0n,
      totalPredictionPoolB: 0n,
      createdBlockNumber: event.block.number,
      createdTimestamp: BigInt(event.block.timestamp),
    };
  },

  handleDuelJoined: (event: any, state: any) => {
    const duelId = event.params.duelId.toString();
    const opponent = event.params.opponent.toLowerCase();

    if (!state.traders[opponent]) {
      state.traders[opponent] = {
        id: opponent,
        address: opponent,
        totalDuels: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        winStreak: 0,
        bestStreak: 0,
        elo: 1200,
        totalMonWon: 0n,
      };
    }

    if (state.duels[duelId]) {
      state.duels[duelId].playerB_id = opponent;
      state.duels[duelId].state = "JOINED";
    }
  },

  handlePredictionPlaced: (event: any, state: any) => {
    const duelId = event.params.duelId.toString();
    const predictor = event.params.predictor.toLowerCase();
    const predictedWinner = event.params.predictedWinner.toLowerCase();
    const amount = BigInt(event.params.amount);

    const predictionId = `${duelId}-${predictor}`;
    state.predictions[predictionId] = {
      id: predictionId,
      duel_id: duelId,
      predictor_id: predictor,
      predictedWinner,
      amount,
      claimed: false,
      timestamp: BigInt(event.block.timestamp),
    };

    const duel = state.duels[duelId];
    if (duel) {
      if (predictedWinner === duel.playerA_id) {
        duel.totalPredictionPoolA += amount;
      } else {
        duel.totalPredictionPoolB += amount;
      }
    }
  },

  handleDuelSettled: (event: any, state: any) => {
    const duelId = event.params.duelId.toString();
    const winner = event.params.winner.toLowerCase();
    const traderPayout = BigInt(event.params.traderPayout);

    const duel = state.duels[duelId];
    if (duel) {
      duel.state = "SETTLED";
      duel.winner_id = winner;
      duel.traderPayout = traderPayout;

      const playerA = state.traders[duel.playerA_id];
      const playerB = state.traders[duel.playerB_id];

      if (playerA && playerB) {
        playerA.totalDuels += 1;
        playerB.totalDuels += 1;

        const isWinnerA = winner === duel.playerA_id;
        const winnerTrader = isWinnerA ? playerA : playerB;
        const loserTrader = isWinnerA ? playerB : playerA;

        winnerTrader.wins += 1;
        winnerTrader.winStreak += 1;
        if (winnerTrader.winStreak > winnerTrader.bestStreak) {
          winnerTrader.bestStreak = winnerTrader.winStreak;
        }
        winnerTrader.totalMonWon += traderPayout;

        loserTrader.losses += 1;
        loserTrader.winStreak = 0;

        winnerTrader.winRate = winnerTrader.wins / winnerTrader.totalDuels;
        loserTrader.winRate = loserTrader.wins / loserTrader.totalDuels;

        // ELO Update
        const { newWinnerElo, newLoserElo } = calculateElo(winnerTrader.elo, loserTrader.elo);
        winnerTrader.elo = newWinnerElo;
        loserTrader.elo = newLoserElo;
      }
    }
  },
};
