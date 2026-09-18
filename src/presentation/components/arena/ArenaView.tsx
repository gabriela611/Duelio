"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Timer,
  Info,
  Flame,
  Award,
  Swords,
  RefreshCw,
  TrendingUp,
  Zap,
  Plus,
  Shield,
  Layers,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Duel, AssetAllocation } from "@/domain/duel/Duel";
import { DuelService } from "@/application/DuelService";
import { DuelRoundResult } from "@/infrastructure/game-engine/Engine";
import { PriceSparkline } from "./PriceSparkline";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

interface ArenaViewProps {
  userAddress?: string;
  onSettleSuccess?: (result: DuelRoundResult) => void;
}

export const ArenaView: React.FC<ArenaViewProps> = ({ userAddress, onSettleSuccess }) => {
  const [duel, setDuel] = useState<Duel>(() => DuelService.getSampleActiveDuel());
  const [timeLeft, setTimeLeft] = useState(48);
  const [pnlA, setPnlA] = useState(3.4); // Player A PnL %
  const [pnlB, setPnlB] = useState(-1.8); // Player B PnL %
  const [roundResult, setRoundResult] = useState<DuelRoundResult | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [faucetSuccess, setFaucetSuccess] = useState(false);

  // Deck of assets player can tactically adjust
  const [selectedAsset, setSelectedAsset] = useState<"MON" | "BTC" | "ETH" | "SOL">("MON");

  const handleTriggerSettlement = useCallback(() => {
    setIsSettling(true);
    setTimeout(() => {
      const allocA: AssetAllocation[] = [
        { symbol: "MON", weightBps: 5000, leverage: 2 },
        { symbol: "BTC", weightBps: 3000, leverage: 1 },
        { symbol: "ETH", weightBps: 2000, leverage: 1 },
      ];
      const allocB: AssetAllocation[] = [
        { symbol: "SOL", weightBps: 6000, leverage: 2 },
        { symbol: "ETH", weightBps: 4000, leverage: 1 },
      ];

      const result = DuelService.resolveDuel(duel, allocA, allocB);
      setRoundResult(result);
      setIsSettling(false);

      if (result.winnerAddress === duel.playerA) {
        confetti({
          disableForReducedMotion: true,
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ["#836EF9", "#34C759", "#007AFF"],
        });
      }

      onSettleSuccess?.(result);
    }, 700);
  }, [duel, onSettleSuccess]);

  // Game loop countdown
  useEffect(() => {
    if (timeLeft <= 0 || roundResult) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTriggerSettlement();
          return 0;
        }
        setPnlA((p) => Number((p + (Math.random() * 0.4 - 0.18)).toFixed(2)));
        setPnlB((p) => Number((p + (Math.random() * 0.4 - 0.22)).toFixed(2)));
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, roundResult, handleTriggerSettlement]);

  const isPlayerWinning = pnlA >= pnlB;

  return (
    <div className="flex flex-col space-y-6">

      {/* Clean User Session Banner */}
      <div className="rounded-3xl bg-surface p-5 sm:p-6 border border-border shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-monad-600/10 border border-monad-500/20 flex items-center justify-center relative p-2 shadow-2xs">
            <AssetLogo symbol="MON" size={32} />
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-positive border-2 border-surface" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-text-primary">
                MonadWhale
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-monad-50 text-monad-700 text-xs font-semibold">
                1845 ELO
              </span>
            </div>
            <p className="break-all text-xs text-text-secondary font-mono mt-0.5">
              {userAddress ? userAddress : "0x836E...0001"}
            </p>
          </div>
        </div>

        {/* Session Status & Faucet */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-positive animate-pulse"></span>
            <span>Session Active</span>
          </div>
          <button
            onClick={() => {
              setFaucetSuccess(true);
              setTimeout(() => setFaucetSuccess(false), 2500);
            }}
            className="px-3.5 py-1.5 rounded-full bg-text-primary hover:bg-text-primary/90 active:scale-95 transition-[background-color,color,transform] duration-100 text-xs font-semibold text-white flex items-center gap-1 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+10 MON</span>
          </button>
        </div>
      </div>

      {faucetSuccess && (
        <div role="status" className="rounded-2xl bg-green-50 border border-green-200 p-3 text-xs font-semibold text-green-800 text-center animate-fade-in">
          ✓ Received 10 MON from faucet
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Stats */}
        <div className="order-2 min-w-0 lg:order-1 lg:col-span-5 space-y-6">

          {/* Balance Card */}
          <div className="rounded-3xl bg-surface p-6 shadow-card border border-border space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-text-secondary uppercase tracking-wide">
              <span>Staking Escrow</span>
              <span className="text-monad-600 font-mono">DuelArena</span>
            </div>

            <div>
              <div className="flex items-center text-text-primary font-bold tracking-tight">
                <span className="text-4xl sm:text-5xl font-mono">128.50</span>
                <span className="flex items-center gap-1.5 text-xl font-semibold text-monad-600 ml-2.5">
                  <AssetLogo symbol="MON" size={22} />
                  <span>MON</span>
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                ≈ $2,450 USD • Ready for matchmaking
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-border">
              <div className="p-2.5 rounded-xl bg-surface-secondary text-center">
                <span className="text-xs text-text-secondary font-semibold uppercase block">Win %</span>
                <span className="text-sm font-bold text-positive font-mono">85%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-secondary text-center">
                <span className="text-xs text-text-secondary font-semibold uppercase block">Streak</span>
                <span className="text-sm font-bold text-amber-500 font-mono flex items-center justify-center gap-0.5">
                  <Flame className="w-3 h-3" />
                  <span>5</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-secondary text-center">
                <span className="text-xs text-text-secondary font-semibold uppercase block">Duel</span>
                <span className="text-sm font-bold text-monad-600 font-mono">#{duel.id}</span>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="rounded-3xl bg-surface p-6 shadow-card border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-monad-600" />
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                Fair Settlement
              </h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Duel settlement is deterministic on Monad with cryptographic state hashes.
            </p>
            <div className="flex items-center justify-between text-xs font-mono text-text-tertiary pt-1 border-t border-border">
              <span>Target: &lt;1000ms</span>
              <span>Indexed</span>
            </div>
          </div>
        </div>

        {/* Right: Arena */}
        <div className="order-1 min-w-0 lg:order-2 lg:col-span-7 rounded-3xl bg-surface p-4 sm:p-7 shadow-card border border-border space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-primary">
                  Duel #{duel.id}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">
                  {duel.entryStakeMon} MON
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">60s Allocation Clash</p>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-secondary text-text-primary">
              <Timer className={`w-4 h-4 ${timeLeft < 15 ? "text-negative animate-bounce" : "text-monad-600"}`} />
              <span className={`text-sm font-mono font-bold ${timeLeft < 15 ? "text-negative" : "text-text-primary"}`}>
                {timeLeft}s
              </span>
            </div>
          </div>

          {/* Dual-Sided Clash Momentum Gauge */}
          <div className="p-4 sm:p-5 rounded-3xl bg-surface-secondary border border-border space-y-4">
            {/* Duelists Head-to-Head */}
            <div className="grid grid-cols-12 items-center gap-2">
              {/* Player 1 (You) */}
              <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-monad-600 to-monad-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    <AssetLogo symbol="MON" size={24} />
                  </div>
                  <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded bg-monad-700 text-[9px] font-bold text-white tracking-wider">
                    YOU
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-text-primary truncate">
                    MonadWhale
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-text-tertiary">1845 ELO</span>
                    <span className={`text-xs font-bold font-mono ${pnlA >= 0 ? "text-positive" : "text-negative"}`}>
                      {pnlA >= 0 ? `+${pnlA}%` : `${pnlA}%`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Center VS & Advantage Badge */}
              <div className="col-span-2 flex flex-col items-center justify-center text-center">
                <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center shadow-xs">
                  <Swords className="w-3.5 h-3.5 text-text-secondary" />
                </div>
                <span className={`text-[10px] font-bold font-mono mt-1 ${
                  pnlA > pnlB ? "text-positive" : pnlA < pnlB ? "text-negative" : "text-text-tertiary"
                }`}>
                  {pnlA > pnlB ? `+${(pnlA - pnlB).toFixed(1)}%` : pnlA < pnlB ? `${(pnlA - pnlB).toFixed(1)}%` : "EVEN"}
                </span>
              </div>

              {/* Player 2 (Opponent) */}
              <div className="col-span-5 flex items-center justify-end gap-2.5 min-w-0 text-right">
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-text-primary truncate">
                    CryptoKnight
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={`text-xs font-bold font-mono ${pnlB >= 0 ? "text-positive" : "text-negative"}`}>
                      {pnlB >= 0 ? `+${pnlB}%` : `${pnlB}%`}
                    </span>
                    <span className="text-[11px] font-medium text-text-tertiary">1620 ELO</span>
                  </div>
                </div>
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    <Shield className="w-5 h-5 text-slate-300" />
                  </div>
                  <span className="absolute -bottom-1 -left-1 px-1 py-0.2 rounded bg-slate-800 text-[9px] font-bold text-slate-300 tracking-wider">
                    OPP
                  </span>
                </div>
              </div>
            </div>

            {/* Continuous Momentum Gauge */}
            <div className="space-y-1.5 pt-1">
              <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                {/* Center marker line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/80 z-10 -translate-x-1/2" />
                
                {/* MonadWhale Momentum (Left side) */}
                <div
                  className="h-full bg-gradient-to-r from-monad-500 to-monad-600 transition-all duration-500 rounded-l-full"
                  style={{
                    width: `${Math.min(85, Math.max(15, 50 + (pnlA - pnlB) * 4))}%`,
                  }}
                />
                
                {/* CryptoKnight Momentum (Right side) */}
                <div
                  className="h-full bg-slate-400 transition-all duration-500 flex-1 rounded-r-full"
                />
              </div>

              {/* Advantage Subtext */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-text-tertiary px-0.5">
                <span className={pnlA >= pnlB ? "text-monad-600 font-bold" : ""}>
                  {pnlA >= pnlB ? "▲ Leading Momentum" : "Tactical Deficit"}
                </span>
                <span className="font-mono text-[10px] uppercase">
                  {Math.min(85, Math.max(15, 50 + (pnlA - pnlB) * 4)).toFixed(0)}% / {(100 - Math.min(85, Math.max(15, 50 + (pnlA - pnlB) * 4))).toFixed(0)}% DOMINANCE
                </span>
                <span className={pnlB > pnlA ? "text-negative font-bold" : ""}>
                  {pnlB > pnlA ? "▲ Opponent Surge" : "Challenging"}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Price Chart */}
          <PriceSparkline asset={selectedAsset} />

          {/* Asset Deck */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-bold uppercase text-text-tertiary px-1">
              <span>TACTICAL ALLOCATION DECK</span>
              <span className="text-monad-600">LEVERAGE TARGET</span>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
              {(["MON", "BTC", "ETH", "SOL"] as const).map((asset) => (
                <button
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
                  aria-pressed={selectedAsset === asset}
                  className={`min-w-0 p-2.5 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 border ${
                    selectedAsset === asset
                      ? "bg-slate-200/90 text-text-primary border-slate-400 font-bold shadow-xs scale-[1.02]"
                      : "bg-surface-secondary text-text-primary border-transparent hover:bg-surface-tertiary"
                  }`}
                >
                  <AssetLogo symbol={asset} size={28} />
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-xs tracking-tight">{asset}</span>
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${
                      asset === "MON" 
                        ? "bg-monad-100 text-monad-700" 
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {asset === "MON" ? "2x Long" : "1x Spot"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          {roundResult && (
            <div role="status" className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-1.5 animate-fade-in">
              <div className="inline-flex p-2 rounded-full bg-amber-200/60 text-amber-900">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                {roundResult.winnerAddress === duel.playerA ? "VICTORY" : "DEFEAT"}
              </h4>
              <p className="text-xs text-text-secondary">
                Hash: {roundResult.stateHash.slice(0, 8)}...{roundResult.stateHash.slice(-6)}
              </p>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            {roundResult ? (
              <button
                onClick={() => {
                  setRoundResult(null);
                  setTimeLeft(60);
                  setPnlA(1.5);
                  setPnlB(0.8);
                }}
                className="w-full py-4 rounded-2xl bg-monad-600 hover:bg-monad-700 active:scale-[0.98] transition-[background-color,color,transform] duration-100 text-white font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>NEXT DUEL</span>
              </button>
            ) : (
              <button
                onClick={handleTriggerSettlement}
                disabled={isSettling}
                className="w-full py-4 rounded-2xl bg-monad-600 hover:bg-monad-700 active:scale-[0.98] transition-[background-color,color,transform] duration-100 text-white font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
              >
                {isSettling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>SETTLING…</span>
                  </>
                ) : (
                  <>
                    <Swords className="w-4 h-4" />
                    <span>COMMIT & SETTLE</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
