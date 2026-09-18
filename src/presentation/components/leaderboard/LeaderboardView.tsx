"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Zap, Shield, Flame } from "lucide-react";
import { Trader, getRankBadge } from "@/domain/trader/Trader";
import { fetchLeaderboard, fetchIndexerStatus, EnvioSyncStatus } from "@/infrastructure/envio/client";

export const LeaderboardView: React.FC = () => {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [syncStatus, setSyncStatus] = useState<EnvioSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [list, status] = await Promise.all([fetchLeaderboard(), fetchIndexerStatus()]);
      setTraders(list);
      setSyncStatus(status);
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="p-4 space-y-4">
      {/* Header with Envio Meta Tag */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-duel-gold" />
          <h2 className="text-base font-black text-white">MONAD ELO RANKINGS</h2>
        </div>

        {/* Envio _meta indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-duel-surface border border-duel-border text-[10px]">
          <Zap className="w-3 h-3 text-monad-400" />
          <span className="text-slate-300 font-mono">
            Envio {syncStatus ? `Block #${syncStatus.syncedBlock}` : "Syncing..."}
          </span>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="space-y-2">
        {traders.map((trader, idx) => {
          const badge = getRankBadge(trader.elo);
          return (
            <div
              key={trader.address}
              className={`p-3 rounded-2xl bg-duel-surface border transition-all flex items-center justify-between ${
                idx === 0
                  ? "border-duel-gold/50 shadow-glow-gold bg-gradient-to-r from-duel-surface via-amber-950/20 to-duel-surface"
                  : idx === 1
                  ? "border-purple-500/30"
                  : "border-duel-border"
              }`}
            >
              {/* Left: Rank & Trader Info */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                    idx === 0
                      ? "bg-duel-gold text-black"
                      : idx === 1
                      ? "bg-slate-300 text-black"
                      : idx === 2
                      ? "bg-amber-700 text-white"
                      : "bg-duel-card text-slate-400 border border-duel-border"
                  }`}
                >
                  #{idx + 1}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{trader.handle}</span>
                    <span className={`text-[9px] font-black uppercase ${badge.color}`}>
                      {badge.tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{trader.wins}W - {trader.losses}L</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">
                      {(trader.winRate * 100).toFixed(0)}% Winrate
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: ELO & Streak */}
              <div className="text-right">
                <div className="text-xs font-black text-monad-300 font-mono">
                  {trader.elo} ELO
                </div>
                {trader.winStreak > 1 && (
                  <div className="flex items-center justify-end gap-0.5 text-[9px] font-bold text-amber-400">
                    <Flame className="w-2.5 h-2.5" />
                    <span>{trader.winStreak} Streak</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
