"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Sparkles, Activity } from "lucide-react";
import { calculateOdds } from "@/domain/prediction/Prediction";

export const SpectatorWidget: React.FC = () => {
  const [poolA, setPoolA] = useState("12.50");
  const [poolB, setPoolB] = useState("8.20");
  const [selectedTrader, setSelectedTrader] = useState<"A" | "B">("A");
  const [stakedAmount, setStakedAmount] = useState("0.50");
  const [placed, setPlaced] = useState(false);

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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
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

      <div className="rounded-3xl bg-surface border border-border p-6 shadow-card space-y-5">
        {/* Matchup */}
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-monad-600 animate-pulse"></span>
            <span className="font-bold text-text-primary">
              MonadWhale (A)
            </span>
          </div>
          <span className="text-text-tertiary font-bold text-xs uppercase tracking-wider bg-surface-secondary px-2.5 py-0.5 rounded-full">
            VS
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-primary">
              CryptoKnight (B)
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-800"></span>
          </div>
        </div>

        {/* Odds Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-5 bg-surface-secondary rounded-full overflow-hidden flex border border-border">
            <div
              className="h-full bg-monad-600 transition-all duration-300 flex items-center justify-start pl-3 text-xs font-bold text-white font-mono"
              style={{ width: `${odds.percentA}%` }}
            >
              {odds.percentA}%
            </div>
            <div
              className="h-full bg-slate-900 transition-all duration-300 flex items-center justify-end pr-3 text-xs font-bold text-white font-mono"
              style={{ width: `${odds.percentB}%` }}
            >
              {odds.percentB}%
            </div>
          </div>

          <div className="flex justify-between text-xs font-mono font-semibold text-text-secondary px-1">
            <span>
              Pool A: {poolA} MON ({odds.multiplierA}x)
            </span>
            <span>
              Pool B: {poolB} MON ({odds.multiplierB}x)
            </span>
          </div>
        </div>

        {/* Prediction Selector */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => setSelectedTrader("A")}
            className={`p-4 rounded-2xl text-sm font-bold transition-all duration-100 active:scale-95 ${
              selectedTrader === "A"
                ? "bg-text-primary text-white shadow-2xs"
                : "bg-surface-secondary text-text-primary border border-border hover:bg-surface-tertiary"
            }`}
          >
            <div className="font-bold">Back MonadWhale</div>
            <div className="text-xs font-mono text-positive mt-1">
              {odds.multiplierA}x Payout
            </div>
          </button>
          <button
            onClick={() => setSelectedTrader("B")}
            className={`p-4 rounded-2xl text-sm font-bold transition-all duration-100 active:scale-95 ${
              selectedTrader === "B"
                ? "bg-text-primary text-white shadow-2xs"
                : "bg-surface-secondary text-text-primary border border-border hover:bg-surface-tertiary"
            }`}
          >
            <div className="font-bold">Back CryptoKnight</div>
            <div className="text-xs font-mono text-positive mt-1">
              {odds.multiplierB}x Payout
            </div>
          </button>
        </div>

        {/* Stake Amounts */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-text-secondary tracking-wider">
            Stake Amount (MON)
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {["0.25", "0.50", "1.00"].map((amt) => (
              <button
                key={amt}
                onClick={() => setStakedAmount(amt)}
                className={`py-2.5 rounded-xl text-sm font-bold font-mono transition-all duration-100 active:scale-95 ${
                  stakedAmount === amt
                    ? "bg-monad-600 text-white shadow-2xs"
                    : "bg-surface-secondary text-text-primary border border-border hover:bg-surface-tertiary"
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
          className="w-full py-4 rounded-2xl bg-text-primary hover:bg-text-primary/90 text-white text-xs font-bold tracking-wider uppercase shadow-2xs flex items-center justify-center gap-2 active:scale-95 transition-all duration-100"
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
