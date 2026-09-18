"use client";

import React, { useState } from "react";
import { Eye, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { calculateOdds } from "@/domain/prediction/Prediction";

export const SpectatorWidget: React.FC = () => {
  const [poolA, setPoolA] = useState("0.85");
  const [poolB, setPoolB] = useState("0.55");
  const [selectedTrader, setSelectedTrader] = useState<"A" | "B">("A");
  const [stakedAmount, setStakedAmount] = useState("0.1");
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
    <div className="p-4 space-y-4">
      {/* Title & Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-duel-cyan" />
          <h2 className="text-base font-black text-white">SPECTATOR PREDICTIONS</h2>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          Testnet $MON Only
        </span>
      </div>

      <div className="p-3 bg-duel-surface border border-duel-border rounded-2xl space-y-3">
        {/* Matchup Header */}
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-monad-300">MonadWhale (A)</span>
          <span className="text-slate-500 font-bold">VS</span>
          <span className="font-bold text-duel-red">CryptoKnight (B)</span>
        </div>

        {/* Dynamic Odds Ratio Bar */}
        <div className="space-y-1">
          <div className="w-full h-4 bg-duel-card rounded-full overflow-hidden flex border border-duel-border">
            <div
              className="h-full bg-gradient-to-r from-monad-600 to-monad-400 transition-all duration-300 flex items-center justify-start pl-2 text-[10px] font-bold text-white"
              style={{ width: `${odds.percentA}%` }}
            >
              {odds.percentA}%
            </div>
            <div
              className="h-full bg-gradient-to-r from-duel-red to-amber-600 transition-all duration-300 flex items-center justify-end pr-2 text-[10px] font-bold text-white"
              style={{ width: `${odds.percentB}%` }}
            >
              {odds.percentB}%
            </div>
          </div>

          <div className="flex justify-between text-[11px] font-mono text-slate-400 px-1">
            <span>Pool: {poolA} MON ({odds.multiplierA}x)</span>
            <span>Pool: {poolB} MON ({odds.multiplierB}x)</span>
          </div>
        </div>

        {/* Prediction Selector */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setSelectedTrader("A")}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
              selectedTrader === "A"
                ? "bg-monad-500/20 border-monad-400 text-white shadow-glow-monad"
                : "bg-duel-card border-duel-border text-slate-400"
            }`}
          >
            Back MonadWhale ({odds.multiplierA}x)
          </button>
          <button
            onClick={() => setSelectedTrader("B")}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
              selectedTrader === "B"
                ? "bg-duel-red/20 border-duel-red text-white shadow-glow-red"
                : "bg-duel-card border-duel-border text-slate-400"
            }`}
          >
            Back CryptoKnight ({odds.multiplierB}x)
          </button>
        </div>

        {/* Stake Amounts */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Select Testnet Stake</label>
          <div className="grid grid-cols-3 gap-2">
            {["0.05", "0.10", "0.25"].map((amt) => (
              <button
                key={amt}
                onClick={() => setStakedAmount(amt)}
                className={`py-1.5 rounded-lg border text-xs font-bold font-mono transition-all ${
                  stakedAmount === amt
                    ? "bg-duel-cyan/20 border-duel-cyan text-white shadow-glow-cyan"
                    : "bg-duel-card border-duel-border text-slate-400"
                }`}
              >
                {amt} MON
              </button>
            ))}
          </div>
        </div>

        {/* Submit Prediction Button */}
        <button
          onClick={handlePlacePrediction}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-duel-cyan to-monad-500 text-white text-xs font-black tracking-wide shadow-glow-cyan flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          {placed ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>PREDICTION RECORDED ON MONAD</span>
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" />
              <span>
                PREDICT & WIN ~
                {(
                  parseFloat(stakedAmount) *
                  (selectedTrader === "A" ? odds.multiplierA : odds.multiplierB)
                ).toFixed(2)}{" "}
                MON
              </span>
            </>
          )}
        </button>

        {/* Anti-frontrunning note */}
        <div className="flex items-start gap-1.5 p-2 rounded-xl bg-duel-card/70 border border-duel-border text-[10px] text-slate-400">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Predictions automatically lock at 50% match duration to prevent front-running. Payouts are distributed onchain via DuelArena.sol.
          </span>
        </div>
      </div>
    </div>
  );
};
