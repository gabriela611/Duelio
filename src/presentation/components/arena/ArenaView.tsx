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
          <div className="w-12 h-12 shrink-0 rounded-xl bg-monad-600 flex items-center justify-center text-white font-bold text-lg">
            MW
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
              <div className="flex items-baseline text-text-primary font-bold tracking-tight">
                <span className="text-4xl sm:text-5xl font-mono">128.50</span>
                <span className="text-xl font-semibold text-monad-600 ml-2">MON</span>
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

          {/* Opponent */}
          <div className="p-3.5 rounded-2xl bg-surface-secondary space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                  B
                </div>
                <div>
                  <div className="text-sm font-bold text-text-primary">CryptoKnight</div>
                  <div className="text-xs text-text-secondary font-medium">1620 ELO</div>
                </div>
              </div>
              <span className={`text-sm font-bold font-mono ${pnlB >= 0 ? "text-positive" : "text-negative"}`}>
                {pnlB >= 0 ? `+${pnlB}%` : `${pnlB}%`}
              </span>
            </div>

            {/* Health */}
            <div className="w-full h-2 bg-white rounded-full overflow-hidden">
              <div
                className={`h-full origin-left transition-transform duration-300 ${
                  pnlB >= pnlA ? "bg-negative" : "bg-slate-400"
                }`}
                style={{ transform: `scaleX(${Math.min(100, Math.max(10, 50 + pnlB * 8)) / 100})` }}
              ></div>
            </div>
          </div>

          {/* You */}
          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-monad-600 text-white font-bold text-xs flex items-center justify-center">
                  YOU
                </div>
                <div>
                  <div className="text-sm font-bold text-text-primary">MonadWhale</div>
                  <div className="text-xs text-monad-700 font-medium">1845 ELO</div>
                </div>
              </div>
              <span className={`text-sm font-bold font-mono ${pnlA >= 0 ? "text-positive" : "text-negative"}`}>
                {pnlA >= 0 ? `+${pnlA}%` : `${pnlA}%`}
              </span>
            </div>

            {/* Health */}
            <div className="w-full h-2 bg-purple-200 rounded-full overflow-hidden">
              <div
                className="h-full origin-left bg-monad-600 transition-transform duration-300"
                style={{ transform: `scaleX(${Math.min(100, Math.max(10, 50 + pnlA * 8)) / 100})` }}
              ></div>
            </div>
          </div>

          {/* Real-time Price Chart */}
          <PriceSparkline asset={selectedAsset} />

          {/* Asset Deck */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-bold uppercase text-text-tertiary px-1">
              <span>ALLOCATION</span>
              <span className="text-monad-600">SELECT</span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {(["MON", "BTC", "ETH", "SOL"] as const).map((asset) => (
                <button
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
                  aria-pressed={selectedAsset === asset}
                  className={`min-w-0 p-2 sm:p-3 rounded-xl flex flex-col items-center gap-0.5 transition-[background-color,color,transform] duration-100 active:scale-95 ${
                    selectedAsset === asset
                      ? "bg-text-primary text-white shadow-2xs"
                      : "bg-surface-secondary text-text-primary hover:bg-surface-tertiary"
                  }`}
                >
                  <span className="font-bold text-xs">{asset}</span>
                  <span className="text-xs opacity-80 font-mono">
                    {asset === "MON" ? "2x" : "1x"}
                  </span>
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
                className="w-full py-4 rounded-2xl bg-text-primary hover:bg-text-primary/90 active:scale-[0.98] transition-[background-color,color,transform] duration-100 text-white font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-2xs"
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
