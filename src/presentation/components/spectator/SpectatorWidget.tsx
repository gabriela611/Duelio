"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Sparkles, Activity } from "lucide-react";
import { calculateOdds } from "@/domain/prediction/Prediction";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

interface ActiveDuelMatch {
  id: string;
  title: string;
  category: string;
  duelistA: { name: string; initials: string; elo: number; symbol: string };
  duelistB: { name: string; initials: string; elo: number; symbol: string };
  defaultPoolA: string;
  defaultPoolB: string;
}

const ACTIVE_MATCHES: ActiveDuelMatch[] = [
  {
    id: "juan-pepe",
    title: "Juan vs Pepe",
    category: "60s Speed Rematch",
    duelistA: { name: "Juan", initials: "JU", elo: 1890, symbol: "MON" },
    duelistB: { name: "Pepe", initials: "PE", elo: 1820, symbol: "SOL" },
    defaultPoolA: "14.50",
    defaultPoolB: "10.20",
  },
  {
    id: "whale-knight",
    title: "MonadWhale vs CryptoKnight",
    category: "High Stakes Allocation",
    duelistA: { name: "MonadWhale", initials: "MW", elo: 1845, symbol: "MON" },
    duelistB: { name: "CryptoKnight", initials: "CK", elo: 1620, symbol: "ETH" },
    defaultPoolA: "12.50",
    defaultPoolB: "8.20",
  },
];

export const SpectatorWidget: React.FC = () => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>("juan-pepe");
  const currentMatch = ACTIVE_MATCHES.find((m) => m.id === selectedMatchId) ?? ACTIVE_MATCHES[0];

  const [poolA, setPoolA] = useState(currentMatch.defaultPoolA);
  const [poolB, setPoolB] = useState(currentMatch.defaultPoolB);
  const [selectedTrader, setSelectedTrader] = useState<"A" | "B">("A");
  const [stakedAmount, setStakedAmount] = useState("0.50");
  const [placed, setPlaced] = useState(false);

  const handleSelectMatch = (match: ActiveDuelMatch) => {
    setSelectedMatchId(match.id);
    setPoolA(match.defaultPoolA);
    setPoolB(match.defaultPoolB);
    setSelectedTrader("A");
  };

  const odds = calculateOdds(poolA, poolB);

  const handlePlacePrediction = () => {
    if (selectedTrader === "A") {
      setPoolA((p) => (parseFloat(p) + parseFloat(stakedAmount)).toFixed(2));
    } else {
      setPoolB((p) => (parseFloat(p) + parseFloat(stakedAmount)).toFixed(2));
    }
    setPlaced(true);
    setTimeout(() => setPlaced(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex min-w-0 items-center gap-2">
            <Activity className="w-5 h-5 text-monad-600" />
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Prediction Pools
            </h2>
          </div>
          <p className="text-sm text-text-secondary font-medium mt-0.5">
            Stake on active duels via DuelArena escrow
          </p>
        </div>
        <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700">
          Live
        </span>
      </div>

      <div className="rounded-3xl bg-surface border border-border p-4 sm:p-6 shadow-card space-y-5">
        {/* Match Selector Segmented Control */}
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-surface-secondary border border-border">
          {ACTIVE_MATCHES.map((match) => (
            <button
              key={match.id}
              onClick={() => handleSelectMatch(match)}
              aria-pressed={selectedMatchId === match.id}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95 text-center truncate ${
                selectedMatchId === match.id
                  ? "bg-slate-200/90 text-text-primary border border-slate-300 font-bold shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <span>{match.title}</span>
            </button>
          ))}
        </div>

        {/* Matchup */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs sm:text-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <AssetLogo symbol={currentMatch.duelistA.symbol} size={22} />
            <div className="min-w-0">
              <span className="break-words min-w-0 font-bold text-text-primary block truncate">
                {currentMatch.duelistA.name}
              </span>
              <span className="text-[11px] text-text-tertiary font-mono">
                {currentMatch.duelistA.elo} ELO
              </span>
            </div>
          </div>
          <span className="text-text-tertiary font-bold text-xs uppercase tracking-wider bg-surface-secondary px-2.5 py-0.5 rounded-full">
            VS
          </span>
          <div className="flex min-w-0 items-center justify-end gap-2.5 text-right">
            <div className="min-w-0">
              <span className="break-words min-w-0 font-bold text-text-primary block truncate">
                {currentMatch.duelistB.name}
              </span>
              <span className="text-[11px] text-text-tertiary font-mono">
                {currentMatch.duelistB.elo} ELO
              </span>
            </div>
            <AssetLogo symbol={currentMatch.duelistB.symbol} size={22} />
          </div>
        </div>

        {/* Odds Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-5 bg-surface-secondary rounded-full overflow-hidden flex border border-border">
            <div
              className="h-full bg-monad-600 flex items-center justify-start pl-3 text-xs font-bold text-white font-mono transition-all duration-300"
              style={{ width: `${odds.percentA}%` }}
            >
              {odds.percentA}%
            </div>
            <div
              className="h-full bg-slate-900 flex items-center justify-end pr-3 text-xs font-bold text-white font-mono transition-all duration-300"
              style={{ width: `${odds.percentB}%` }}
            >
              {odds.percentB}%
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between text-xs font-mono font-semibold text-text-secondary px-1">
            <span className="flex items-center gap-1">
              <AssetLogo symbol="MON" size={13} />
              {currentMatch.duelistA.name}: {poolA} MON ({odds.multiplierA}x)
            </span>
            <span className="flex items-center gap-1 sm:justify-end">
              <AssetLogo symbol="MON" size={13} />
              {currentMatch.duelistB.name}: {poolB} MON ({odds.multiplierB}x)
            </span>
          </div>
        </div>

        {/* Prediction Selector */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => setSelectedTrader("A")}
            aria-pressed={selectedTrader === "A"}
            className={`min-w-0 break-words p-3 sm:p-4 rounded-2xl text-sm font-bold transition-[background-color,color,transform] duration-100 active:scale-95 ${
              selectedTrader === "A"
                ? "bg-slate-200/90 text-text-primary border-2 border-slate-400 font-bold shadow-xs"
                : "bg-surface-secondary text-text-primary border-2 border-transparent hover:bg-surface-tertiary"
            }`}
          >
            <div className="font-bold">Back {currentMatch.duelistA.name}</div>
            <div className="text-xs font-mono text-positive mt-1">
              {odds.multiplierA}x Payout
            </div>
          </button>
          <button
            onClick={() => setSelectedTrader("B")}
            aria-pressed={selectedTrader === "B"}
            className={`min-w-0 break-words p-3 sm:p-4 rounded-2xl text-sm font-bold transition-[background-color,color,transform] duration-100 active:scale-95 ${
              selectedTrader === "B"
                ? "bg-slate-200/90 text-text-primary border-2 border-slate-400 font-bold shadow-xs"
                : "bg-surface-secondary text-text-primary border-2 border-transparent hover:bg-surface-tertiary"
            }`}
          >
            <div className="font-bold">Back {currentMatch.duelistB.name}</div>
            <div className="text-xs font-mono text-positive mt-1">
              {odds.multiplierB}x Payout
            </div>
          </button>
        </div>

        {/* Stake Amounts */}
        <div className="space-y-2">
          <p id="stake-amount-label" className="text-xs font-bold uppercase text-text-secondary tracking-wider flex items-center gap-1.5">
            <AssetLogo symbol="MON" size={14} />
            <span>Stake Amount (MON)</span>
          </p>
          <div role="group" aria-labelledby="stake-amount-label" className="grid grid-cols-3 gap-2.5">
            {["0.25", "0.50", "1.00"].map((amt) => (
              <button
                key={amt}
                onClick={() => setStakedAmount(amt)}
                aria-pressed={stakedAmount === amt}
                className={`py-2.5 rounded-xl text-sm font-bold font-mono transition-[background-color,color,transform] duration-100 active:scale-95 ${
                  stakedAmount === amt
                    ? "bg-slate-200/90 text-text-primary border-2 border-slate-400 font-bold shadow-xs"
                    : "bg-surface-secondary text-text-primary border-2 border-transparent hover:bg-surface-tertiary"
                }`}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handlePlacePrediction}
          aria-live="polite"
          className="w-full py-4 rounded-2xl bg-monad-600 hover:bg-monad-700 text-white text-xs font-bold tracking-wider uppercase shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-[background-color,color,transform] duration-100"
        >
          {placed ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-positive" />
              <span>STAKE CONFIRMED</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>
                CONFIRM STAKE • WIN ~
                {(
                  parseFloat(stakedAmount) *
                  (selectedTrader === "A" ? odds.multiplierA : odds.multiplierB)
                ).toFixed(2)}{" "}
                MON
              </span>
            </>
          )}
        </button>

        {/* Info */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-surface-secondary text-sm text-text-secondary font-medium">
          <AlertCircle className="w-4 h-4 text-monad-600 shrink-0 mt-0.5" />
          <span>
            Predictions lock at 50% match duration to prevent front-running.
          </span>
        </div>
      </div>
    </div>
  );
};
