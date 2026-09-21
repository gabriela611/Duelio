/**
 * Envio HyperIndex Event Handlers for Duelio on Monad Testnet (10143)
 * Provides real-time indexed data for leaderboards, duels, spectator prediction analytics, and global statistics.
 */

export function calculateElo(
  winnerElo: number,
  loserElo: number,
  kFactor = 32
): { newWinnerElo: number; newLoserElo: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

  const newWinnerElo = Math.round(winnerElo + kFactor * (1 - expectedWinner));
  const newLoserElo = Math.round(loserElo + kFactor * (0 - expectedLoser));

  return { newWinnerElo, newLoserElo: Math.max(100, newLoserElo) };
}

export function calculateDrawElo(
  eloA: number,
  eloB: number,
  kFactor = 32
): { newEloA: number; newEloB: number } {
  const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (eloA - eloB) / 400));

  const newEloA = Math.round(eloA + kFactor * (0.5 - expectedA));
  const newEloB = Math.round(eloB + kFactor * (0.5 - expectedB));

  return { newEloA: Math.max(100, newEloA), newEloB: Math.max(100, newEloB) };
}

export interface IndexerState {
  duels: Record<string, any>;
  traders: Record<string, any>;
  predictions: Record<string, any>;
  globalStats: {
    id: string;
    totalDuelsCreated: number;
    totalDuelsSettled: number;
    totalVolumeMon: bigint;
    totalPredictionsPlaced: number;
    totalPredictionsVolumeMon: bigint;
  };
}

export function createInitialIndexerState(): IndexerState {
  return {
    duels: {},
    traders: {},
    predictions: {},
    globalStats: {
      id: "global",
      totalDuelsCreated: 0,
      totalDuelsSettled: 0,
      totalVolumeMon: 0n,
      totalPredictionsPlaced: 0,
      totalPredictionsVolumeMon: 0n,
    },
  };
}

function ensureTrader(address: string, state: IndexerState) {
  const addr = address.toLowerCase();
  if (!state.traders[addr]) {
    state.traders[addr] = {
      id: addr,
      address: addr,
      totalDuels: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      winStreak: 0,
      bestStreak: 0,
      elo: 1200,
      totalMonWon: 0n,
    };
  }
  return state.traders[addr];
}

export const handlers = {
  handleDuelCreated: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const creator = event.params.creator.toLowerCase();
    const stake = BigInt(event.params.stake);
    const duration = BigInt(event.params.duration);

    ensureTrader(creator, state);

    state.duels[duelId] = {
      id: duelId,
      duelId: BigInt(duelId),
      creator,
      playerA_id: creator,
      playerB_id: null,
      entryStake: stake,
      duration,
      startTime: null,
      endTime: null,
      rulesHash: event.params.rulesHash,
      finalStateHash: null,
      state: "CREATED",
      winner_id: null,
      traderPayout: 0n,
      totalPredictionPoolA: 0n,
      totalPredictionPoolB: 0n,
      traderRewardsClaimed: false,
      createdBlockNumber: event.block?.number || 0,
      createdTimestamp: BigInt(event.block?.timestamp || 0),
    };

    state.globalStats.totalDuelsCreated += 1;
    state.globalStats.totalVolumeMon += stake;
  },

  handleDuelJoined: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const opponent = event.params.opponent.toLowerCase();

    ensureTrader(opponent, state);

    const duel = state.duels[duelId];
    if (duel) {
      duel.playerB_id = opponent;
      duel.state = "JOINED";
      state.globalStats.totalVolumeMon += duel.entryStake;
    }
  },

  handleDuelStarted: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const duel = state.duels[duelId];
    if (duel) {
      duel.startTime = BigInt(event.params.startTime);
      duel.endTime = BigInt(event.params.endTime);
      duel.state = "ACTIVE";
    }
  },

  handlePredictionPlaced: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const predictor = event.params.predictor.toLowerCase();
    const predictedWinner = event.params.predictedWinner.toLowerCase();
    const amount = BigInt(event.params.amount);

    ensureTrader(predictor, state);

    const predictionId = `${duelId}-${predictor}`;
    state.predictions[predictionId] = {
      id: predictionId,
      duel_id: duelId,
      predictor_id: predictor,
      predictedWinner,
      amount,
      claimed: false,
      payout: 0n,
      timestamp: BigInt(event.block?.timestamp || 0),
    };

    const duel = state.duels[duelId];
    if (duel) {
      if (predictedWinner === duel.playerA_id) {
        duel.totalPredictionPoolA += amount;
      } else {
        duel.totalPredictionPoolB += amount;
      }
    }

    state.globalStats.totalPredictionsPlaced += 1;
    state.globalStats.totalPredictionsVolumeMon += amount;
  },

  handlePredictionPoolClosed: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const duel = state.duels[duelId];
    if (duel) {
      duel.totalPredictionPoolA = BigInt(event.params.totalPoolA);
      duel.totalPredictionPoolB = BigInt(event.params.totalPoolB);
    }
  },

  handleOutcomeCommitted: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const duel = state.duels[duelId];
    if (duel) {
      duel.winner_id = event.params.winner.toLowerCase();
      duel.finalStateHash = event.params.stateHash;
      duel.state = "COMMITTED";
    }
  },

  handleDuelSettled: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const winner = event.params.winner.toLowerCase();
    const traderPayout = BigInt(event.params.traderPayout);

    const duel = state.duels[duelId];
    if (!duel) return;

    duel.state = "SETTLED";
    duel.winner_id = winner;
    duel.traderPayout = traderPayout;

    const playerA = state.traders[duel.playerA_id];
    const playerB = state.traders[duel.playerB_id];

    if (playerA && playerB) {
      playerA.totalDuels += 1;
      playerB.totalDuels += 1;

      const isDraw = winner === "0x0000000000000000000000000000000000000000";

      if (isDraw) {
        playerA.draws = (playerA.draws || 0) + 1;
        playerB.draws = (playerB.draws || 0) + 1;

        const { newEloA, newEloB } = calculateDrawElo(playerA.elo, playerB.elo);
        playerA.elo = newEloA;
        playerB.elo = newEloB;
      } else {
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

        const { newWinnerElo, newLoserElo } = calculateElo(
          winnerTrader.elo,
          loserTrader.elo
        );
        winnerTrader.elo = newWinnerElo;
        loserTrader.elo = newLoserElo;
      }

      playerA.winRate = playerA.wins / playerA.totalDuels;
      playerB.winRate = playerB.wins / playerB.totalDuels;
    }

    state.globalStats.totalDuelsSettled += 1;
  },

  handleRewardClaimed: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const duel = state.duels[duelId];
    if (duel) {
      duel.traderRewardsClaimed = true;
    }
  },

  handlePredictionClaimed: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const predictor = event.params.predictor.toLowerCase();
    const payout = BigInt(event.params.payout);

    const predictionId = `${duelId}-${predictor}`;
    const prediction = state.predictions[predictionId];
    if (prediction) {
      prediction.claimed = true;
      prediction.payout = payout;
    }
  },

  handleDuelCancelled: (event: any, state: IndexerState) => {
    const duelId = event.params.duelId.toString();
    const duel = state.duels[duelId];
    if (duel) {
      duel.state = "CANCELLED";
    }
  },
};
