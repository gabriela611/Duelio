"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Timer,
  Flame,
  Plus,
  RefreshCw,
  Trophy,
  Swords,
  Radio,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import { PriceSparkline } from "./PriceSparkline";
import { SupportedAsset, usePriceStream } from "@/infrastructure/price-feed/usePriceStream";
import { getPriceSourceLabel } from "@/infrastructure/price-feed/priceSource";
import { useNativeBalance } from "@/presentation/hooks/useNativeBalance";
import { formatNativeBalance } from "@/domain/social/identity";
import { recordDuel, getPlayerStats } from "@/domain/duel/duelHistory";

interface ArenaViewProps {
  userAddress?: string;
  onConnect?: () => void;
}

type DuelRoundState = "IDLE" | "COUNTDOWN" | "SETTLED";
type Direction = "HIGHER" | "LOWER";

export const ArenaView: React.FC<ArenaViewProps> = ({ userAddress, onConnect }) => {
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("BTC");
  const { currentPrice, isLive, source } = usePriceStream(selectedAsset);
  const nativeBalance = useNativeBalance(userAddress);
  const isWalletConnected = Boolean(userAddress);

  // Gamified 10-second Duel State
  const [roundState, setRoundState] = useState<DuelRoundState>("IDLE");
  const [playerPrediction, setPlayerPrediction] = useState<Direction | null>(null);
  const [opponentPrediction, setOpponentPrediction] = useState<Direction | null>(null);
  const [strikePrice, setStrikePrice] = useState<number>(0);
  const [settledPrice, setSettledPrice] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(10);

  // Player Stats & Session State - Loaded from persistent records
  const [elo, setElo] = useState<number>(() => getPlayerStats(userAddress, "practice").elo);
  const [streak, setStreak] = useState<number>(() => getPlayerStats(userAddress, "practice").streak);

  useEffect(() => {
    const stats = getPlayerStats(userAddress, "practice");
    setElo(stats.elo);
    setStreak(stats.streak);
  }, [userAddress]);

  // Round resolution data
  const [roundWinner, setRoundWinner] = useState<"PLAYER" | "OPPONENT" | "DRAW" | null>(null);

  const displayBalance =
    isWalletConnected && nativeBalance.status === "ready" && nativeBalance.value !== undefined
      ? formatNativeBalance(nativeBalance.value)
      : isWalletConnected && nativeBalance.status === "loading"
      ? "Checking…"
      : isWalletConnected && nativeBalance.status === "error"
      ? "Unavailable"
      : null;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isBenchmark = source === "benchmark";

  // Current difference during the active round
  const currentDelta = strikePrice > 0 ? currentPrice - strikePrice : 0;
  const currentDeltaPercent = strikePrice > 0 ? (currentDelta / strikePrice) * 100 : 0;
  const isWinningLive =
    playerPrediction === "HIGHER" ? currentDelta > 0 : currentDelta < 0;

  // Practice rounds are intentionally local and never submit a wallet transaction.
  const handleStartRound = (direction: Direction) => {
    if (roundState !== "IDLE" || currentPrice <= 0) return;

    const oppDir: Direction = direction === "HIGHER" ? "LOWER" : "HIGHER";
    setPlayerPrediction(direction);
    setOpponentPrediction(oppDir);
    setStrikePrice(currentPrice);
    setTimeLeft(10);
    setRoundState("COUNTDOWN");
    setRoundWinner(null);
  };

  // 10-second Countdown Loop
  useEffect(() => {
    if (roundState !== "COUNTDOWN") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roundState]);

  // Settle Round at t = 0
  useEffect(() => {
    if (roundState === "COUNTDOWN" && timeLeft === 0) {
      const finalPrice = currentPrice;
      setSettledPrice(finalPrice);
      setRoundState("SETTLED");

      const delta = finalPrice - strikePrice;
      let winner: "PLAYER" | "OPPONENT" | "DRAW" = "DRAW";
      let eloDelta = 0;
      let outcome: "WIN" | "LOSS" | "DRAW" = "DRAW";

      if (delta === 0) {
        winner = "DRAW";
        outcome = "DRAW";
      } else if (
        (playerPrediction === "HIGHER" && delta > 0) ||
        (playerPrediction === "LOWER" && delta < 0)
      ) {
        winner = "PLAYER";
        outcome = "WIN";
        eloDelta = 18;
        setStreak((prev) => prev + 1);
        setElo((prev) => prev + 18);
      } else {
        winner = "OPPONENT";
        outcome = "LOSS";
        eloDelta = -12;
        setStreak(0);
        setElo((prev) => Math.max(1000, prev - 12));
      }

      setRoundWinner(winner);

      recordDuel({
        playerAddress: userAddress || "0x0000000000000000000000000000000000000000",
        asset: selectedAsset,
        strikePrice,
        settledPrice: finalPrice,
        direction: playerPrediction || "HIGHER",
        outcome,
        stake: 0,
        payout: 0,
        eloDelta,
        mode: "practice",
      });
    }
  }, [timeLeft, roundState, currentPrice, strikePrice, playerPrediction, selectedAsset, userAddress]);

  const handleReset = () => {
    setRoundState("IDLE");
    setPlayerPrediction(null);
    setOpponentPrediction(null);
    setStrikePrice(0);
    setSettledPrice(0);
    setTimeLeft(10);
    setRoundWinner(null);
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-5 pb-6">
      {/* Practice Balance & User Card */}
      <section
        className="rounded-3xl bg-surface p-4 sm:p-6 border border-border shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        aria-label="Duelist Status"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center relative p-2 shadow-soft">
            <AssetLogo symbol="MON" size={30} />
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-positive border-2 border-surface" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-text-primary">
                {isWalletConnected ? `${userAddress!.slice(0, 6)}…${userAddress!.slice(-4)}` : "Guest Duelist"}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-surface-secondary text-text-primary text-xs font-semibold font-mono border border-border">
                {elo} Practice ELO
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold font-mono flex items-center gap-1 border border-amber-200">
                <Flame className="w-3 h-3 text-amber-500" />
                <span>{streak} Practice Streak</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-monad-50 text-monad-700 text-[10px] font-semibold font-mono border border-monad-200">
                Practice Mode
              </span>
            </div>
            <p className="break-all text-xs text-text-secondary font-mono mt-0.5">
              {isWalletConnected ? userAddress : "No wallet required for practice"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-left sm:text-right">
            {isWalletConnected ? (
              <div>
                <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">
                  Monad Balance
                </span>
                <span className="text-lg font-bold font-mono text-text-primary tabular-nums">
                  {displayBalance} MON
                </span>
              </div>
            ) : (
              <div>
                <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">
                  Wallet Status
                </span>
                <span className="text-sm font-semibold text-text-secondary">
                  Not Connected
                </span>
              </div>
            )}
            {isWalletConnected && (
              <button
                onClick={nativeBalance.refresh}
                disabled={nativeBalance.status === "loading"}
                title="Refresh balance"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-secondary active:scale-95 transition-all disabled:opacity-40"
              >
                <RefreshCw size={13} className={nativeBalance.status === "loading" ? "animate-spin" : ""} />
              </button>
            )}
          </div>

          {isWalletConnected ? (
            <a
              href="https://testnet.monad.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-monad-600 hover:bg-monad-700 active:scale-95 transition-all text-xs font-semibold text-white flex items-center gap-1 shadow-soft"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Get Testnet MON</span>
            </a>
          ) : (
            <button
              onClick={onConnect}
              className="px-3.5 py-2 rounded-xl bg-monad-600 hover:bg-monad-700 active:scale-95 transition-all text-xs font-semibold text-white flex items-center gap-1 shadow-soft"
            >
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </section>

      {/* Main 10-Second Duel Arena Card */}
      <section
        className="rounded-3xl bg-surface p-5 sm:p-7 border border-border shadow-soft space-y-6"
        aria-label="Speed Clash Battle"
      >
        {/* Top Controls: Asset Selector & Oracle Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Asset Segmented Control */}
          <div
            className="inline-flex items-center bg-surface-secondary p-1 rounded-2xl border border-border"
            role="tablist"
            aria-label="Select duel currency"
          >
            {(["BTC", "ETH", "SOL", "MON"] as const).map((asset) => (
              <button
                key={asset}
                role="tab"
                aria-selected={selectedAsset === asset}
                disabled={roundState === "COUNTDOWN"}
                onClick={() => setSelectedAsset(asset)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 active:scale-95 ${
                  selectedAsset === asset
                    ? "bg-surface text-text-primary shadow-soft font-bold"
                    : "text-text-secondary hover:text-text-primary"
                } disabled:opacity-60`}
              >
                <AssetLogo symbol={asset} size={15} />
                <span>{asset}</span>
              </button>
            ))}
          </div>

          {/* Oracle Status Badge */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-text-secondary">
            <Radio
              className={`w-3.5 h-3.5 ${
                isLive
                  ? "text-positive animate-pulse"
                  : isBenchmark
                  ? "text-amber-500"
                  : "text-text-tertiary"
              }`}
            />
            <span className="font-medium">
              {getPriceSourceLabel(source)}
            </span>
            <span className="text-[10px] text-text-tertiary">
              · {isLive ? "Live" : "Not live"} · 10s Round
            </span>
          </div>
        </div>

        {/* Asset sparkline with an explicit source label */}
        <PriceSparkline asset={selectedAsset} />

        {/* BATTLE CANVAS */}
        <div className="rounded-2xl bg-surface-secondary/70 border border-border p-5 space-y-5">
          {/* Header: Duel Info & Opponent */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isLive
                    ? "bg-positive animate-pulse"
                    : isBenchmark
                    ? "bg-amber-500"
                    : "bg-text-tertiary"
                }`}
              />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                10-Second Battle Arena
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Swords className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="font-semibold text-text-primary">Practice bot: CryptoKnight</span>
              <span className="font-mono text-text-tertiary">(1820 ELO)</span>
            </div>
          </div>

          {/* CLASH STATE: 1. COUNTDOWN IN PROGRESS */}
          {roundState === "COUNTDOWN" && (
            <div className="space-y-4 py-2">
              {/* Timer Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1 text-text-primary">
                    <Timer className="w-4 h-4 text-text-primary" />
                    <span>Time Remaining:</span>
                  </span>
                  <span className="font-mono text-base font-bold text-text-primary tabular-nums">
                    {timeLeft}s
                  </span>
                </div>

                {/* Clean Progress Bar */}
                <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-text-primary transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(timeLeft / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Price Delta & Live Momentum */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-surface border border-border space-y-1">
                  <span className="text-[11px] font-semibold text-text-tertiary uppercase block">
                    Strike Price
                  </span>
                  <span className="text-base font-bold font-mono text-text-primary tabular-nums">
                    ${strikePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-text-secondary block">
                    You chose: <strong className="text-text-primary">{playerPrediction}</strong>
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface border border-border space-y-1">
                  <span className="text-[11px] font-semibold text-text-tertiary uppercase block">
                    {isBenchmark ? "Simulated Delta" : "Live Delta"}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-base font-bold font-mono tabular-nums ${
                        currentDelta >= 0 ? "text-positive" : "text-negative"
                      }`}
                    >
                      {currentDelta >= 0 ? `+$${currentDelta.toFixed(2)}` : `-$${Math.abs(currentDelta).toFixed(2)}`}
                    </span>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        currentDelta >= 0 ? "text-positive" : "text-negative"
                      }`}
                    >
                      ({currentDeltaPercent >= 0 ? `+${currentDeltaPercent.toFixed(3)}%` : `${currentDeltaPercent.toFixed(3)}%`})
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold">
                    {isWinningLive ? (
                      <span className="text-positive font-bold">▲ You are winning</span>
                    ) : (
                      <span className="text-negative font-bold">▼ Opponent leading</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* CLASH STATE: 2. SETTLED RESULT */}
          {roundState === "SETTLED" && (
            <div
              className={`p-4 sm:p-5 rounded-2xl border ${
                roundWinner === "PLAYER"
                  ? "bg-surface border-positive/40"
                  : roundWinner === "OPPONENT"
                  ? "bg-surface border-negative/40"
                  : "bg-surface border-border"
              } space-y-3 animate-fade-in`}
              role="alert"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {roundWinner === "PLAYER" ? (
                    <CheckCircle2 className="w-5 h-5 text-positive" />
                  ) : (
                    <XCircle className="w-5 h-5 text-negative" />
                  )}
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                    {roundWinner === "PLAYER"
                      ? "VICTORY! YOU WON"
                      : roundWinner === "OPPONENT"
                      ? "DEFEAT! OPPONENT WON"
                      : "ROUND DRAW"}
                  </h3>
                </div>

                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${
                    roundWinner === "PLAYER"
                      ? "bg-positive/10 text-positive"
                      : "bg-negative/10 text-negative"
                  }`}
                >
                  {roundWinner === "PLAYER"
                    ? "+18 practice ELO"
                    : roundWinner === "OPPONENT"
                    ? "-12 practice ELO"
                    : "No ELO change"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 text-text-secondary">
                <div>
                  Strike Price:{" "}
                  <span className="text-text-primary font-bold">
                    ${strikePrice.toFixed(2)}
                  </span>
                </div>
                <div>
                  Final Price:{" "}
                  <span className="text-text-primary font-bold">
                    ${settledPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-border text-[11px] font-mono text-center text-text-secondary">
                Practice only · no MON sent · no payout or on-chain settlement
              </div>

              <button
                onClick={handleReset}
                className="w-full h-12 mt-2 rounded-xl bg-monad-600 hover:bg-monad-700 active:scale-95 transition-all text-xs font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2 shadow-soft"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Next Duel (10s)</span>
              </button>
            </div>
          )}

          {/* CLASH STATE: 3. IDLE / READY (TWO TACTILE BUTTONS) */}
          {roundState === "IDLE" && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-monad-50 border border-monad-200 text-monad-800 text-xs text-center">
                Practice mode uses {isBenchmark ? "simulated benchmark" : "live market"} prices but never requests a wallet signature or sends MON.
              </div>

              <p className="text-xs text-text-secondary leading-relaxed text-center">
                Will {selectedAsset} be higher or lower in 10 seconds? Pick your side:
              </p>

              {/* TWO LARGE NATIVE-STYLE ACTION BUTTONS: HIGHER & LOWER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* HIGHER BUTTON */}
                <button
                  onClick={() => handleStartRound("HIGHER")}
                  disabled={currentPrice <= 0}
                  className="group relative h-14 sm:h-16 rounded-2xl bg-surface border-2 border-positive/30 hover:border-positive hover:bg-positive/5 active:scale-[0.97] transition-all flex items-center justify-between px-5 shadow-soft disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-positive/10 text-positive flex items-center justify-center group-hover:scale-105 transition-transform">
                      <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <span className="text-base font-bold text-text-primary block leading-tight">
                        HIGHER
                      </span>
                      <span className="text-[11px] font-semibold text-positive block leading-tight mt-0.5">
                        Price rises in 10s
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-positive bg-positive/10 px-2 py-1 rounded-lg">
                    Practice
                  </span>
                </button>

                {/* LOWER BUTTON */}
                <button
                  onClick={() => handleStartRound("LOWER")}
                  disabled={currentPrice <= 0}
                  className="group relative h-14 sm:h-16 rounded-2xl bg-surface border-2 border-negative/30 hover:border-negative hover:bg-negative/5 active:scale-[0.97] transition-all flex items-center justify-between px-5 shadow-soft disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-negative/10 text-negative flex items-center justify-center group-hover:scale-105 transition-transform">
                      <TrendingDown className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <span className="text-base font-bold text-text-primary block leading-tight">
                        LOWER
                      </span>
                      <span className="text-[11px] font-semibold text-negative block leading-tight mt-0.5">
                        Price drops in 10s
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-negative bg-negative/10 px-2 py-1 rounded-lg">
                    Practice
                  </span>
                </button>
              </div>

              <div className="pt-2 text-center text-[11px] font-mono text-text-tertiary">
                Financial duels remain disabled until the DuelArena lifecycle is connected.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
