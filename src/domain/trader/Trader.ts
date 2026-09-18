export interface Trader {
  address: string;
  handle?: string;
  avatarUrl?: string;
  twitterHandle?: string;
  totalDuels: number;
  wins: number;
  losses: number;
  winRate: number; // 0 to 1
  winStreak: number;
  bestStreak: number;
  elo: number;
  totalMonWon: string;
  badges: string[];
}

export function getRankBadge(elo: number): { title: string; color: string; tier: string } {
  if (elo >= 1800) return { title: "Monad Grandmaster", color: "text-amber-400", tier: "CHAMPION" };
  if (elo >= 1500) return { title: "Alpha Liquidator", color: "text-purple-400", tier: "MASTER" };
  if (elo >= 1350) return { title: "Degen Strategist", color: "text-cyan-400", tier: "DIAMOND" };
  if (elo >= 1200) return { title: "Arena Contender", color: "text-emerald-400", tier: "GOLD" };
  return { title: "Recruit Trader", color: "text-slate-400", tier: "BRONZE" };
}
