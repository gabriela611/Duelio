import { request, gql } from "graphql-request";
import { Trader } from "@/domain/trader/Trader";

export const ENVIO_GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_ENVIO_ENDPOINT || "http://localhost:8080/v1/graphql";

export const META_QUERY = gql`
  query GetIndexerStatus {
    _meta {
      block {
        number
        hash
      }
      hasIndexingErrors
    }
  }
`;

export const LEADERBOARD_QUERY = gql`
  query GetLeaderboard($limit: Int = 10) {
    Trader(order_by: { elo: desc }, limit: $limit) {
      id
      address
      totalDuels
      wins
      losses
      winRate
      winStreak
      bestStreak
      elo
      totalMonWon
    }
  }
`;

export const DUELS_QUERY = gql`
  query GetActiveDuels {
    Duel(where: { state: { _in: ["CREATED", "JOINED", "ACTIVE"] } }, order_by: { createdTimestamp: desc }, limit: 10) {
      id
      duelId
      creator
      playerA {
        address
        elo
      }
      playerB {
        address
        elo
      }
      entryStake
      duration
      startTime
      endTime
      state
      totalPredictionPoolA
      totalPredictionPoolB
    }
  }
`;

export interface EnvioSyncStatus {
  syncedBlock: number;
  hasErrors: boolean;
  isLive: boolean;
}

export async function fetchIndexerStatus(): Promise<EnvioSyncStatus> {
  try {
    const data: any = await request(ENVIO_GRAPHQL_ENDPOINT, META_QUERY);
    return {
      syncedBlock: data?._meta?.block?.number || 0,
      hasErrors: !!data?._meta?.hasIndexingErrors,
      isLive: true,
    };
  } catch {
    // Graceful fallback for local development before cloud indexer is launched
    return {
      syncedBlock: 1014388,
      hasErrors: false,
      isLive: false,
    };
  }
}

export async function fetchLeaderboard(): Promise<Trader[]> {
  try {
    const data: any = await request(ENVIO_GRAPHQL_ENDPOINT, LEADERBOARD_QUERY, { limit: 10 });
    return (data?.Trader || []).map((t: any) => ({
      address: t.address,
      handle: `${t.address.slice(0, 6)}...${t.address.slice(-4)}`,
      totalDuels: t.totalDuels,
      wins: t.wins,
      losses: t.losses,
      winRate: t.winRate,
      winStreak: t.winStreak,
      bestStreak: t.bestStreak,
      elo: t.elo,
      totalMonWon: (BigInt(t.totalMonWon || 0) / 10n ** 18n).toString(),
      badges: t.elo >= 1500 ? ["Grandmaster", "Undefeated"] : ["Duelist"],
    }));
  } catch {
    // If indexer is not running locally, return empty array to avoid fake mock data
    return [];
  }
}
