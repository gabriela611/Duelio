import { normalizeAddress } from "@/domain/social/identity";
import { Trader } from "@/domain/trader/Trader";

export interface DuelRecord {
  id: string;
  timestamp: number;
  playerAddress: string;
  asset: string;
  strikePrice: number;
  settledPrice: number;
  direction: "HIGHER" | "LOWER";
  outcome: "WIN" | "LOSS" | "DRAW";
  stake: number;
  payout: number;
  eloDelta: number;
}

export interface PlayerStats {
  address: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  totalMonWon: number;
  totalDuels: number;
  winRate: number;
}

const STORAGE_KEY_DUELS = "duelio_duel_records_v1";

export function getDuelHistory(playerAddress?: string): DuelRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DUELS);
    if (!raw) return [];
    const all: DuelRecord[] = JSON.parse(raw);
    if (!playerAddress) return all;
    const target = normalizeAddress(playerAddress);
    return all.filter((d) => normalizeAddress(d.playerAddress) === target);
  } catch {
    return [];
  }
}

export function recordDuel(
  entry: Omit<DuelRecord, "id" | "timestamp">
): DuelRecord {
  const newRecord: DuelRecord = {
    ...entry,
    id: `duel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getDuelHistory();
      const updated = [newRecord, ...existing].slice(0, 100);
      localStorage.setItem(STORAGE_KEY_DUELS, JSON.stringify(updated));
    } catch {
      // Storage full or restricted
    }
  }

  return newRecord;
}

export function getPlayerStats(playerAddress?: string): PlayerStats {
  const normalized = normalizeAddress(playerAddress) || "0x0000000000000000000000000000000000000000";
  const history = getDuelHistory(playerAddress);

  if (history.length === 0) {
    return {
      address: normalized,
      elo: 1200,
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,
      bestStreak: 0,
      totalMonWon: 0,
      totalDuels: 0,
      winRate: 0,
    };
  }

  let elo = 1200;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let streak = 0;
  let bestStreak = 0;
  let totalMonWon = 0;

  // History is ordered newest-first, so reverse to calculate cumulative elo
  const chronological = [...history].reverse();
  for (const duel of chronological) {
    elo = Math.max(1000, elo + duel.eloDelta);
    if (duel.outcome === "WIN") {
      wins++;
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      totalMonWon += duel.payout - duel.stake;
    } else if (duel.outcome === "LOSS") {
      losses++;
      streak = 0;
    } else {
      draws++;
    }
  }

  const totalDuels = wins + losses + draws;
  const winRate = totalDuels > 0 ? wins / totalDuels : 0;

  return {
    address: normalized,
    elo,
    wins,
    losses,
    draws,
    streak,
    bestStreak,
    totalMonWon: Number(Math.max(0, totalMonWon).toFixed(4)),
    totalDuels,
    winRate,
  };
}

export function getLocalTraders(): Trader[] {
  const history = getDuelHistory();
  if (history.length === 0) return [];

  const addressMap = new Map<string, DuelRecord[]>();
  for (const duel of history) {
    const addr = normalizeAddress(duel.playerAddress) || duel.playerAddress;
    const list = addressMap.get(addr) || [];
    list.push(duel);
    addressMap.set(addr, list);
  }

  const traders: Trader[] = [];
  for (const [address] of addressMap) {
    const stats = getPlayerStats(address);
    traders.push({
      address: stats.address,
      handle: `${stats.address.slice(0, 6)}…${stats.address.slice(-4)}`,
      totalDuels: stats.totalDuels,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.winRate,
      winStreak: stats.streak,
      bestStreak: stats.bestStreak,
      elo: stats.elo,
      totalMonWon: stats.totalMonWon.toString(),
      badges: stats.elo >= 1500 ? ["Grandmaster"] : ["Duelist"],
    });
  }

  return traders.sort((a, b) => b.elo - a.elo);
}
