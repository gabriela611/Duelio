"use client";

import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  Flame,
  CheckCircle2,
  RefreshCw,
  Trophy,
  Swords,
} from "lucide-react";
import { Trader } from "@/domain/trader/Trader";
import { fetchLeaderboard } from "@/infrastructure/envio/client";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import { normalizeAddress } from "@/domain/social/identity";
import { getLocalTraders, getPlayerStats } from "@/domain/duel/duelHistory";

interface LeaderboardViewProps {
  userAddress?: string;
  onBack?: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ userAddress, onBack }) => {
  const [subTab, setSubTab] = useState<"global" | "rivals">("global");
  const [category, setCategory] = useState("All Duels");
  const [timeframe, setTimeframe] = useState("24h");
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);

  const normalizedUser = normalizeAddress(userAddress);
  const userStats = getPlayerStats(userAddress);

  const loadData = async () => {
    setLoading(true);
    try {
      const remote = await fetchLeaderboard();
      const local = getLocalTraders();

      // Merge on-chain indexer records and local match records
      const combinedMap = new Map<string, Trader>();
      for (const t of remote) {
        const addr = normalizeAddress(t.address) || t.address;
        combinedMap.set(addr, t);
      }
      for (const t of local) {
        const addr = normalizeAddress(t.address) || t.address;
        const existing = combinedMap.get(addr);
        if (!existing || t.elo >= existing.elo) {
          combinedMap.set(addr, t);
        }
      }

      const list = Array.from(combinedMap.values()).sort((a, b) => b.elo - a.elo);
      setTraders(list);
    } catch {
      setTraders(getLocalTraders());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userAddress]);

  const categories = [
    "All Duels",
    "10s Speed Clash",
    "High Stakes",
    "Pro League",
  ];
  const timeframes = ["24h", "7d", "30d", "All"];

  // Find user's actual position in traders if recorded
  const userTrader = traders.find(
    (t) => normalizeAddress(t.address) === normalizedUser
  );
  const userRank = userTrader ? traders.indexOf(userTrader) + 1 : null;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-5 pb-8">
      {/* Top Bar: Back Button & Textual Tabs with Thin Underline */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary active:scale-95 transition-all rounded-xl hover:bg-surface-secondary"
          aria-label="Back to Arena"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Textual Tabs with Underline per design.md Section 13 */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => setSubTab("global")}
            aria-pressed={subTab === "global"}
            className={`pb-2 text-sm font-semibold transition-colors relative ${
              subTab === "global"
                ? "text-text-primary font-bold"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Global Arena
            {subTab === "global" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-monad-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setSubTab("rivals")}
            aria-pressed={subTab === "rivals"}
            className={`pb-2 text-sm font-semibold transition-colors relative ${
              subTab === "rivals"
                ? "text-text-primary font-bold"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Active Rivals
            {subTab === "rivals" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-monad-600 rounded-full" />
            )}
          </button>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 -mr-2 text-text-secondary hover:text-text-primary active:scale-95 transition-all rounded-xl hover:bg-surface-secondary disabled:opacity-40"
          aria-label="Refresh rankings"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Prominent Real Summary Card: Your Rank per design.md Section 3.1 */}
      <section
        className="rounded-3xl bg-surface p-5 sm:p-6 shadow-soft border border-border flex flex-wrap items-center justify-between gap-4"
        aria-label="Your ranking summary"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center p-2 shadow-soft">
            <AssetLogo symbol="MON" size={28} />
          </div>

          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">
              {normalizedUser ? "Your Duelist Rank" : "Duelist Identity"}
            </span>
            <div className="flex flex-wrap items-baseline gap-2.5 mt-0.5">
              <span className="font-mono font-bold text-2xl text-text-primary tabular-nums">
                {userRank ? `#${userRank}` : normalizedUser ? (userStats.totalDuels > 0 ? "Ranked" : "Unranked") : "Guest Mode"}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-secondary text-text-primary text-xs font-semibold font-mono border border-border">
                {normalizedUser ? `${userStats.elo} ELO` : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-base font-mono font-bold text-positive flex items-center justify-start sm:justify-end gap-1">
            <AssetLogo symbol="MON" size={16} />
            <span>+{userStats.totalMonWon.toFixed(2)} MON</span>
          </span>
          <span className="text-xs text-text-secondary font-medium block mt-0.5">
            {userStats.totalDuels > 0
              ? `${(userStats.winRate * 100).toFixed(0)}% Win Rate (${userStats.wins}W · ${userStats.losses}L)`
              : normalizedUser
              ? "0 duels · Enter Arena to rank"
              : "Connect wallet to join"}
          </span>
        </div>
      </section>

      {/* Category Filter Pills: design.md Section 14 */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
        {categories.map((cat) => {
          const isActive = category === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              aria-pressed={isActive}
              className={`h-8 sm:h-9 px-3.5 sm:px-4 rounded-full text-xs font-semibold transition-all duration-120 whitespace-nowrap active:scale-95 ${
                isActive
                  ? "bg-monad-600 text-white font-bold shadow-soft"
                  : "bg-surface text-text-secondary border border-border hover:text-text-primary hover:bg-surface-secondary"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Section Header with Segmented Timeframe Control: design.md Section 15 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <h3 className="text-base sm:text-lg font-bold text-text-primary tracking-tight">
          Duelist Leaderboard
        </h3>

        <div className="flex items-center bg-surface-secondary p-1 rounded-xl border border-border text-xs font-semibold">
          {timeframes.map((tf) => {
            const isSelected = timeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                aria-pressed={isSelected}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all duration-120 active:scale-95 text-[11px] sm:text-xs ${
                  isSelected
                    ? "bg-surface text-text-primary font-bold shadow-soft"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clean List Rows — Living Directly on the Page Surface per design.md Section 3.1 & 17 */}
      <div className="divide-y divide-border border-t border-b border-border">
        {traders.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto text-text-tertiary">
              <Trophy className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-text-primary">
              No On-chain Rankings Yet
            </h4>
            <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
              No duels have settled on Monad Testnet yet. Complete a 10-second clash in the Arena to claim the #1 spot on the leaderboard.
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-monad-600 hover:bg-monad-700 text-white text-xs font-semibold shadow-soft active:scale-95 transition-all"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Enter Arena</span>
              </button>
            )}
          </div>
        ) : (
          traders.map((trader, idx) => {
            const rank = idx + 1;
            const isCurrentUser = normalizeAddress(trader.address) === normalizedUser;

            return (
              <div
                key={trader.address}
                className={`flex items-center justify-between py-3 px-2 sm:px-3 gap-3 transition-colors ${
                  isCurrentUser ? "bg-monad-50/70 border border-monad-200/60 rounded-xl" : "hover:bg-surface/50"
                }`}
              >
                {/* Left: [#] [avatar] Primary name & Secondary metadata (Single responsive row) */}
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  {/* Rank indicator */}
                  <div className="w-6 text-center shrink-0 font-mono font-bold text-xs sm:text-sm text-text-tertiary">
                    {rank === 1 ? (
                      <span className="inline-flex w-5 h-5 sm:w-6 sm:h-6 items-center justify-center rounded-full bg-monad-600 text-white text-[11px] sm:text-xs font-bold">
                        1
                      </span>
                    ) : rank === 2 ? (
                      <span className="inline-flex w-5 h-5 sm:w-6 sm:h-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-800 text-[11px] sm:text-xs font-bold">
                        2
                      </span>
                    ) : rank === 3 ? (
                      <span className="inline-flex w-5 h-5 sm:w-6 sm:h-6 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 text-[11px] sm:text-xs font-bold border border-border">
                        3
                      </span>
                    ) : (
                      rank
                    )}
                  </div>

                  {/* Square Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-secondary border border-border flex items-center justify-center font-bold font-mono text-xs text-text-primary">
                      {(trader.handle || trader.address.slice(2, 4)).slice(0, 2).toUpperCase()}
                    </div>
                    {trader.winStreak >= 3 && (
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-positive text-white flex items-center justify-center border-2 border-surface">
                        <CheckCircle2 className="w-2 h-2" />
                      </div>
                    )}
                  </div>

                  {/* Primary name & Secondary metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-semibold text-text-primary flex items-center gap-1.5 truncate">
                      <span className="truncate">{trader.handle || `${trader.address.slice(0, 6)}…${trader.address.slice(-4)}`}</span>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.2 rounded bg-monad-100 text-[9px] font-bold text-monad-700 border border-monad-200 shrink-0">
                          YOU
                        </span>
                      )}
                      {trader.winStreak >= 3 && (
                        <span className="inline-flex items-center text-[10px] text-amber-600 font-semibold gap-0.5 shrink-0">
                          <Flame className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                          <span>{trader.winStreak}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-text-secondary flex items-center gap-1.5 mt-0.5 truncate">
                      <span className="font-semibold text-text-primary">{trader.elo} ELO</span>
                      <span>•</span>
                      <span>{trader.wins}W / {trader.losses}L</span>
                    </div>
                  </div>
                </div>

                {/* Right: Green Financial Value Aligned Right per design.md Section 3.1 */}
                <div className="text-right shrink-0">
                  <div className="text-xs sm:text-sm font-mono font-bold text-positive tabular-nums">
                    +{Number(trader.totalMonWon).toFixed(2)} MON
                  </div>
                  <div className="text-[10px] sm:text-xs font-medium text-text-tertiary mt-0.5">
                    {(trader.winRate * 100).toFixed(0)}% win rate
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
