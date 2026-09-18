"use client";

import React, { useState, useEffect } from "react";
import { Timer, Zap, Flame, ShieldAlert, Award, Swords, RefreshCw } from "lucide-react";
import confetti from "canvas-confetti";
import { Duel, AssetAllocation } from "@/domain/duel/Duel";
import { DuelService } from "@/application/DuelService";
import { DuelRoundResult } from "@/infrastructure/game-engine/Engine";

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

  // Deck of assets player can tactically adjust
  const [selectedAsset, setSelectedAsset] = useState<"MON" | "BTC" | "ETH" | "SOL">("MON");

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
        // Micro-price fluctuations simulated
        setPnlA((p) => Number((p + (Math.random() * 0.4 - 0.18)).toFixed(2)));
        setPnlB((p) => Number((p + (Math.random() * 0.4 - 0.22)).toFixed(2)));
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, roundResult]);

  const handleTriggerSettlement = () => {
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
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#836EF9", "#00F0FF", "#FFD700"],
        });
      }

      onSettleSuccess?.(result);
    }, 800); // Prototype transition delay; chain confirmation is asynchronous.
  };

  const isPlayerWinning = pnlA >= pnlB;

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Duel Header Info */}
      <div className="flex items-center justify-between bg-duel-surface/70 border border-duel-border p-2.5 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Duel #{duel.id}</span>
          <span className="px-2 py-0.5 rounded-full bg-monad-500/20 text-monad-300 text-[10px] font-bold border border-monad-500/30">
            Stake: {duel.entryStakeMon} MON
          </span>
        </div>

        {/* Center Timer */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-duel-card border border-duel-border">
          <Timer className={`w-4 h-4 ${timeLeft < 15 ? "text-duel-red animate-bounce" : "text-duel-cyan"}`} />
          <span className={`text-sm font-black ${timeLeft < 15 ? "text-duel-red font-mono" : "text-white font-mono"}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Opponent Card (Top) */}
      <div className="p-3.5 rounded-2xl bg-duel-surface border border-duel-border/70 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-duel-red/20 border border-duel-red/40 flex items-center justify-center font-bold text-xs text-duel-red">
              B
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">CryptoKnight (Opponent)</div>
              <div className="text-[10px] text-slate-400">ELO 1620 • 60% SOL / 40% ETH</div>
            </div>
          </div>
          <div className={`text-sm font-black font-mono ${pnlB >= 0 ? "text-emerald-400" : "text-duel-red"}`}>
            {pnlB >= 0 ? `+${pnlB}%` : `${pnlB}%`}
          </div>
        </div>

        {/* Health Bar (PnL Progress) */}
        <div className="w-full h-3 bg-duel-card rounded-full overflow-hidden border border-duel-border/50">
          <div
            className={`h-full transition-all duration-500 ${
              pnlB >= pnlA ? "bg-gradient-to-r from-duel-red to-amber-500 shadow-glow-red" : "bg-slate-600"
            }`}
            style={{ width: `${Math.min(100, Math.max(10, 50 + pnlB * 8))}%` }}
          ></div>
        </div>
      </div>

      {/* Arena Battlefield / Clash Arena Center */}
      <div className="flex-1 min-h-[160px] rounded-2xl bg-gradient-to-b from-duel-surface/40 via-monad-950/30 to-duel-surface/40 border border-duel-border/40 p-4 flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(131,110,249,0.15)_0,transparent_70%)] pointer-events-none"></div>

        {roundResult ? (
          <div className="text-center z-10 animate-fade-in">
            <div className="inline-flex p-3 rounded-2xl bg-duel-gold/20 border border-duel-gold/40 text-duel-gold mb-2 shadow-glow-gold">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider">
              {roundResult.winnerAddress === duel.playerA ? "VICTORY!" : "DEFEAT"}
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              {roundResult.winnerAddress === duel.playerA ? "You outplayed your opponent's allocation!" : "Opponent yielded higher PnL"}
            </p>
            <div className="mt-3 text-[10px] font-mono text-slate-400 bg-duel-card px-3 py-1 rounded-full border border-duel-border inline-block">
              State Hash: {roundResult.stateHash.slice(0, 10)}...{roundResult.stateHash.slice(-6)}
            </div>
          </div>
        ) : (
          <div className="text-center z-10 space-y-2">
            <div className="flex items-center justify-center gap-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isPlayerWinning ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"}`}>
                {isPlayerWinning ? "Dominating Arena" : "Trailing behind"}
              </span>
            </div>

            <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <Flame className="w-3.5 h-3.5 text-monad-400" />
              <span>Real-time Monad state delta: </span>
              <span className="font-bold text-white font-mono">{Number((pnlA - pnlB).toFixed(2))}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Player Card (Bottom) */}
      <div className="p-3.5 rounded-2xl bg-duel-surface border border-monad-500/40 relative overflow-hidden shadow-glow-monad">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-monad-500/20 border border-monad-500 flex items-center justify-center font-bold text-xs text-monad-300">
              YOU
            </div>
            <div>
              <div className="text-xs font-bold text-white">MonadWhale (You)</div>
              <div className="text-[10px] text-monad-300">ELO 1845 • 50% MON (2x) / 30% BTC</div>
            </div>
          </div>
          <div className={`text-sm font-black font-mono ${pnlA >= 0 ? "text-emerald-400" : "text-duel-red"}`}>
            {pnlA >= 0 ? `+${pnlA}%` : `${pnlA}%`}
          </div>
        </div>

        {/* Player Health Bar */}
        <div className="w-full h-3 bg-duel-card rounded-full overflow-hidden border border-duel-border/50">
          <div
            className={`h-full transition-all duration-500 ${
              pnlA >= pnlB ? "bg-gradient-to-r from-monad-500 via-duel-cyan to-emerald-400 shadow-glow-cyan" : "bg-slate-600"
            }`}
            style={{ width: `${Math.min(100, Math.max(10, 50 + pnlA * 8))}%` }}
          ></div>
        </div>
      </div>

      {/* Clash Royale Tactical Asset Deck (Cards) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1">
          <span>TACTICAL CARDS (TAP TO REBALANCE)</span>
          <span className="text-monad-300">Monad Session Active</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(["MON", "BTC", "ETH", "SOL"] as const).map((asset) => (
            <button
              key={asset}
              onClick={() => setSelectedAsset(asset)}
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all active:scale-95 ${
                selectedAsset === asset
                  ? "bg-monad-500/20 border-monad-400 text-white shadow-glow-monad scale-105"
                  : "bg-duel-card/80 border-duel-border text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="font-black text-xs">{asset}</span>
              <span className="text-[10px] text-monad-300 font-semibold">{asset === "MON" ? "2x LEV" : "1x LEV"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Action Button */}
      <div className="pt-1">
        {roundResult ? (
          <button
            onClick={() => {
              setRoundResult(null);
              setTimeLeft(60);
              setPnlA(1.2);
              setPnlB(0.5);
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-monad-600 to-monad-500 text-white font-black text-sm tracking-wide shadow-glow-monad flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>PLAY AGAIN (NEW DUEL)</span>
          </button>
        ) : (
          <button
            onClick={handleTriggerSettlement}
            disabled={isSettling}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-monad-600 to-duel-cyan text-white font-black text-sm tracking-wide shadow-glow-monad flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50"
          >
            {isSettling ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>CONFIRMING SETTLEMENT...</span>
              </>
            ) : (
              <>
                <Swords className="w-4 h-4" />
                <span>COMMIT & SETTLE DUEL</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
