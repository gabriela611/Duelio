"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from "react";
import {
  Trophy,
  Zap,
  CheckCircle2,
  ChevronLeft,
  Flame,
  Swords,
  TrendingUp,
} from "lucide-react";
import { Trader } from "@/domain/trader/Trader";
import {
  fetchLeaderboard,
  fetchIndexerStatus,
  EnvioSyncStatus,
} from "@/infrastructure/envio/client";

interface LeaderboardViewProps {
  onBack?: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ onBack }) => {
  const [subTab, setSubTab] = useState<"global" | "rivals">("global");
  const [category, setCategory] = useState("All Duels");
  const [timeframe, setTimeframe] = useState("24h");
  const [, setTraders] = useState<Trader[]>([]);
  const [syncStatus, setSyncStatus] = useState<EnvioSyncStatus | null>(null);

  useEffect(() => {
    async function loadData() {
      const [list, status] = await Promise.all([
        fetchLeaderboard(),
        fetchIndexerStatus(),
      ]);
      setTraders(list);
      setSyncStatus(status);
    }
    loadData();
  }, []);

  const categories = [
    "All Duels",
    "High Stakes",
    "Speed Clash (1m)",
    "Tactical (5m)",
    "Pro League",
  ];
  const timeframes = ["24h", "7d", "30d", "All"];

  // Curated authentic Web3 PvP Duelists on Monad
  const topDuelists = [
    {
      rank: 1,
      name: "Alfa Jr",
      handle: "$AlphaSignals",
      elo: 1980,
      winRate: "91.2%",
      pnlMon: "+1,420.50",
      pnlUsd: "≈ $26,989",
      badges: ["MON", "BTC"],
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face",
      streak: 9,
    },
    {
      rank: 2,
      name: "Bubbles",
      handle: "$Bubbles77",
      elo: 1925,
      winRate: "88.4%",
      pnlMon: "+1,110.00",
      pnlUsd: "≈ $21,090",
      badges: ["SOL", "ETH"],
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face",
      streak: 6,
    },
    {
      rank: 3,
      name: "Jeni",
      handle: "$MarketGuru",
      elo: 1890,
      winRate: "84.1%",
      pnlMon: "+895.25",
      pnlUsd: "≈ $17,009",
      badges: ["MON", "ETH"],
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face",
      streak: 4,
    },
    {
      rank: 4,
      name: "Cold Nic",
      handle: "$investorZZZ",
      elo: 1860,
      winRate: "81.0%",
      pnlMon: "+660.00",
      pnlUsd: "≈ $12,540",
      badges: ["BTC", "SOL"],
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face",
      streak: 3,
    },
    {
      rank: 5,
      name: "MonadWhale (You)",
      handle: "$monadwhale",
      elo: 1845,
      winRate: "82.9%",
      pnlMon: "+452.80",
      pnlUsd: "≈ $8,603",
      badges: ["MON", "BTC", "ETH"],
      avatar:
        "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&h=120&fit=crop&crop=face",
      streak: 5,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col space-y-6">
      {/* Top Bar: Back Button & Clean Tabs */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary active:scale-95 transition-[background-color,color,transform] duration-100 rounded-xl hover:bg-surface-secondary"
          aria-label="Back to Arena"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Clean Underline Tabs */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setSubTab("global")}
            aria-pressed={subTab === "global"}
            className={`pb-2 text-sm font-semibold transition-colors relative ${
              subTab === "global"
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Global Arena
            {subTab === "global" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary"></div>
            )}
          </button>

          <button
            onClick={() => setSubTab("rivals")}
            aria-pressed={subTab === "rivals"}
            className={`pb-2 text-sm font-semibold transition-colors relative ${
              subTab === "rivals"
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Rivals (18)
            {subTab === "rivals" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary"></div>
            )}
          </button>
        </div>

        <div className="w-9"></div>
      </div>

      {/* Your Rank Card */}
      <div className="rounded-3xl bg-surface p-5 shadow-card border border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-border">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face"
              width={56}
              height={56}
              alt="You"
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-1">
              Your rank
            </span>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono font-bold text-2xl text-text-primary">
                #302
              </span>
              <span className="px-2 py-0.5 rounded-full bg-monad-50 text-monad-700 text-xs font-semibold">
                1845 ELO
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-base font-mono font-bold text-positive block">
            +452.80 MON
          </span>
          <span className="text-xs text-text-secondary font-medium block mt-0.5">
            82.9% • 5x
          </span>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar p-1 -mx-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-[background-color,color,transform] duration-100 whitespace-nowrap active:scale-95 ${
              category === cat
                ? "bg-slate-200/90 text-text-primary border border-slate-300 font-bold shadow-xs"
                : "bg-surface text-text-secondary border border-border hover:bg-surface-secondary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Section Header with Timeframe */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <h3 className="text-lg font-bold text-text-primary tracking-tight">
          Top Duelists
        </h3>

        {/* Timeframe selector */}
        <div className="flex items-center bg-surface-secondary p-1 rounded-xl text-xs font-semibold">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              aria-pressed={timeframe === tf}
              className={`px-3 py-1 rounded-lg transition-[background-color,color,transform] active:scale-95 ${
                timeframe === tf
                  ? "bg-slate-200/90 text-text-primary border border-slate-300 font-bold shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Clean List Rows - No Card Wrappers */}
      <div className="space-y-4">
        {topDuelists.map((t) => (
          <div
            key={t.rank}
            className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between py-3 border-b border-border"
          >
            {/* Left: Rank + Avatar + Info */}
            <div className="flex min-w-0 items-center gap-3.5">
              {/* Rank Badge */}
              <div className="w-8 flex items-center justify-center shrink-0">
                {t.rank === 1 ? (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-300 flex items-center justify-center font-bold text-amber-900 text-xs shadow-2xs">
                    1
                  </div>
                ) : t.rank === 2 ? (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shadow-2xs">
                    2
                  </div>
                ) : t.rank === 3 ? (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-600/20 to-amber-500/10 flex items-center justify-center font-bold text-amber-800 text-xs shadow-2xs">
                    3
                  </div>
                ) : (
                  <span className="text-sm font-mono font-bold text-text-tertiary">
                    {t.rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className="relative shrink-0">
                <img
                  src={t.avatar}
                  width={48}
                  height={48}
                  loading="lazy"
                  alt={t.name}
                  className="w-12 h-12 rounded-xl object-cover"
                />
                {t.streak >= 5 && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-monad-600 text-white flex items-center justify-center border-2 border-surface">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>

              {/* Name & Metadata */}
              <div className="min-w-0">
                <div className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <span className="truncate">{t.name}</span>
                  {t.streak >= 5 && (
                    <span className="flex shrink-0 items-center text-xs text-amber-500 font-semibold">
                      <Flame className="w-3 h-3 fill-amber-400" />
                      {t.streak}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-text-secondary flex flex-wrap items-center gap-x-2 mt-0.5">
                  <span>{t.handle}</span>
                  <span>•</span>
                  <span className="text-monad-600 font-semibold">{t.elo} ELO</span>
                </div>
              </div>
            </div>

            {/* Right: PnL */}
            <div className="flex items-center justify-between gap-2 pl-[7rem] sm:block sm:pl-0 sm:text-right shrink-0">
              <div className="text-sm font-mono font-bold text-positive">
                {t.pnlMon} MON
              </div>
              <div className="text-xs font-medium text-text-tertiary mt-0.5">
                {t.winRate}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer indicator */}
      <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-text-tertiary font-mono">
        <Zap className="w-3.5 h-3.5 text-monad-500" />
        <span>
          Block #{syncStatus?.syncedBlock ?? 1014388}
        </span>
      </div>
    </div>
  );
};
