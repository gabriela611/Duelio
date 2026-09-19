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
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useWallets } from "@privy-io/react-auth";
import { parseEther } from "viem";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import { PriceSparkline } from "./PriceSparkline";
import { SupportedAsset, usePriceStream } from "@/infrastructure/price-feed/usePriceStream";
import { useNativeBalance } from "@/presentation/hooks/useNativeBalance";
import { formatNativeBalance } from "@/domain/social/identity";
import { DUEL_ARENA_CONTRACT_ADDRESS, HOUSE_TREASURY_ADDRESS, monadTestnet } from "@/infrastructure/web3/monadChain";
import { recordDuel, getPlayerStats } from "@/domain/duel/duelHistory";
import { sendStakeToHouse } from "@/infrastructure/web3/sendStakeTransaction";

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
  const refreshBalance = nativeBalance.refresh;
  const isWalletConnected = Boolean(userAddress);

  // Gamified 10-second Duel State
  const [roundState, setRoundState] = useState<DuelRoundState>("IDLE");
  const [playerPrediction, setPlayerPrediction] = useState<Direction | null>(null);
  const [opponentPrediction, setOpponentPrediction] = useState<Direction | null>(null);
  const [strikePrice, setStrikePrice] = useState<number>(0);
  const [settledPrice, setSettledPrice] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(10);

  // On-chain transaction state
  const { wallets } = useWallets();
  const activeWallet =
    wallets?.find((w) => w.address.toLowerCase() === userAddress?.toLowerCase()) ||
    wallets?.[0];

  const [isSubmittingTx, setIsSubmittingTx] = useState<boolean>(false);
  const [entryTxHash, setEntryTxHash] = useState<string | null>(null);
  const [payoutTxHash, setPayoutTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Player Stats & Session State - Loaded from persistent records
  const [elo, setElo] = useState<number>(() => getPlayerStats(userAddress).elo);
  const [streak, setStreak] = useState<number>(() => getPlayerStats(userAddress).streak);
  const [selectedStake, setSelectedStake] = useState<number>(0.1);

  useEffect(() => {
    const stats = getPlayerStats(userAddress);
    setElo(stats.elo);
    setStreak(stats.streak);
  }, [userAddress]);

  // Round resolution data
  const [roundWinner, setRoundWinner] = useState<"PLAYER" | "OPPONENT" | "DRAW" | null>(null);

  const isContractDeployed =
    DUEL_ARENA_CONTRACT_ADDRESS &&
    DUEL_ARENA_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const displayBalance =
    isWalletConnected && nativeBalance.status === "ready" && nativeBalance.value !== undefined
      ? formatNativeBalance(nativeBalance.value)
      : isWalletConnected && nativeBalance.status === "loading"
      ? "Checking…"
      : isWalletConnected && nativeBalance.status === "error"
      ? "Unavailable"
      : null;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Live difference during the active round
  const currentDelta = strikePrice > 0 ? currentPrice - strikePrice : 0;
  const currentDeltaPercent = strikePrice > 0 ? (currentDelta / strikePrice) * 100 : 0;
  const isWinningLive =
    playerPrediction === "HIGHER" ? currentDelta > 0 : currentDelta < 0;

  // Start 10s Speed Clash with REAL on-chain stake
  const handleStartRound = async (direction: Direction) => {
    if (roundState !== "IDLE" || currentPrice <= 0 || isSubmittingTx) return;

    if (!isWalletConnected || !activeWallet) {
      onConnect?.();
      return;
    }

    setTxError(null);
    setIsSubmittingTx(true);

    try {
      // Execute real on-chain stake to the House Treasury on Monad Testnet (Universal for all wallets)
      const { txHash } = await sendStakeToHouse(activeWallet, selectedStake);
      setEntryTxHash(txHash);

      const oppDir: Direction = direction === "HIGHER" ? "LOWER" : "HIGHER";
      setPlayerPrediction(direction);
      setOpponentPrediction(oppDir);
      setStrikePrice(currentPrice);
      setTimeLeft(10);
      setRoundState("COUNTDOWN");
      setRoundWinner(null);
      refreshBalance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction was rejected";
      console.warn("Duel stake transaction rejected or failed:", msg);
      setTxError(
        msg.includes("User rejected") || msg.includes("denied")
          ? "Transaction was rejected in wallet"
          : msg
      );
    } finally {
      setIsSubmittingTx(false);
    }
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
      let payout = 0;

      if (delta === 0) {
        winner = "DRAW";
        outcome = "DRAW";
        payout = selectedStake;
      } else if (
        (playerPrediction === "HIGHER" && delta > 0) ||
        (playerPrediction === "LOWER" && delta < 0)
      ) {
        winner = "PLAYER";
        outcome = "WIN";
        eloDelta = 18;
        // 1.96x return (2% house fee subtracted)
        payout = Number((selectedStake * 1.96).toFixed(4));
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
        stake: selectedStake,
        payout,
        eloDelta,
      });

      // On-chain settlement dispatch:
      if (winner === "PLAYER" && payout > 0 && entryTxHash) {
        fetch("/api/clash/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAddress,
            outcome: "WIN",
            entryTxHash,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.payoutTxHash) {
              setPayoutTxHash(data.payoutTxHash);
            }
            refreshBalance();
          })
          .catch((err) => console.error("Settlement payout failed:", err));
      } else if (winner === "DRAW" && entryTxHash) {
        fetch("/api/clash/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAddress,
            outcome: "DRAW",
            entryTxHash,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.payoutTxHash) {
              setPayoutTxHash(data.payoutTxHash);
            }
            refreshBalance();
          })
          .catch((err) => console.error("Draw refund failed:", err));
      } else {
        // Outcome is LOSS: The funds were already deposited to House Treasury on Monad Testnet!
        refreshBalance();
      }
    }
  }, [timeLeft, roundState, currentPrice, strikePrice, playerPrediction, selectedStake, selectedAsset, userAddress, entryTxHash, refreshBalance]);

  const handleReset = () => {
    setRoundState("IDLE");
    setPlayerPrediction(null);
    setOpponentPrediction(null);
    setStrikePrice(0);
    setSettledPrice(0);
    setTimeLeft(10);
    setRoundWinner(null);
    setEntryTxHash(null);
    setPayoutTxHash(null);
    setTxError(null);
    refreshBalance();
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
                {elo} ELO
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold font-mono flex items-center gap-1 border border-amber-200">
                <Flame className="w-3 h-3 text-amber-500" />
                <span>{streak} Streak</span>
              </span>
              {isContractDeployed ? (
                <span className="px-2 py-0.5 rounded-full bg-positive/10 text-positive text-[10px] font-semibold font-mono">
                  On-chain Escrow Live
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-monad-50 text-monad-700 text-[10px] font-mono border border-monad-200">
                  Monad Testnet
                </span>
              )}
            </div>
            <p className="break-all text-xs text-text-secondary font-mono mt-0.5">
              {isWalletConnected ? userAddress : "Connect wallet to duel with real testnet MON"}
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
            <Radio className="w-3.5 h-3.5 text-positive animate-pulse" />
            <span className="font-medium">
              {source === "pyth" ? "Pyth Hermes Oracle" : "Live Price Stream"}
            </span>
            <span className="text-[10px] text-text-tertiary">· 10s Round</span>
          </div>
        </div>

        {/* Live Asset Sparkline with Real Prices */}
        <PriceSparkline asset={selectedAsset} />

        {/* BATTLE CANVAS */}
        <div className="rounded-2xl bg-surface-secondary/70 border border-border p-5 space-y-5">
          {/* Header: Duel Info & Opponent */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-positive animate-pulse" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                10-Second Battle Arena
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Swords className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="font-semibold text-text-primary">Rival: CryptoKnight</span>
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
                    Live Delta
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
                    ? `+${(selectedStake * 0.96).toFixed(2)} MON · +18 ELO`
                    : `-${selectedStake.toFixed(2)} MON · -12 ELO`}
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

              {/* On-Chain Transaction Receipts on Monad Testnet */}
              <div className="pt-2 border-t border-border space-y-1.5 text-[11px] font-mono">
                {entryTxHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">Stake Escrow Tx:</span>
                    <a
                      href={`https://testnet.monadscan.com/tx/${entryTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-monad-600 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      <span>{entryTxHash.slice(0, 8)}…{entryTxHash.slice(-6)}</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}

                {payoutTxHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-positive font-semibold">House Payout Tx:</span>
                    <a
                      href={`https://testnet.monadscan.com/tx/${payoutTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-positive hover:underline inline-flex items-center gap-1 font-bold"
                    >
                      <span>{payoutTxHash.slice(0, 8)}…{payoutTxHash.slice(-6)}</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}

                {roundWinner === "OPPONENT" && (
                  <div className="p-2.5 rounded-xl bg-negative/10 border border-negative/20 text-negative text-xs text-center font-medium">
                    Stake of {selectedStake} MON deducted and collected by House Treasury (
                    <a
                      href={`https://testnet.monadscan.com/address/${HOUSE_TREASURY_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold"
                    >
                      {HOUSE_TREASURY_ADDRESS.slice(0, 6)}…{HOUSE_TREASURY_ADDRESS.slice(-4)}
                    </a>
                    ).
                  </div>
                )}
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
              {/* Transaction error alert */}
              {txError && (
                <div className="p-3 rounded-2xl bg-negative/10 border border-negative/20 text-negative text-xs flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{txError}</span>
                </div>
              )}

              {/* Transaction signing state */}
              {isSubmittingTx && (
                <div className="p-4 rounded-2xl bg-monad-50 border border-monad-200 text-monad-800 text-xs flex items-center justify-center gap-3 animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin text-monad-600" />
                  <span className="font-semibold">
                    Submitting {selectedStake} MON stake to Monad Testnet… Check your wallet
                  </span>
                </div>
              )}

              {/* Stake Selector */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-semibold text-text-secondary">
                  Round Stake:
                </span>
                <div className="inline-flex items-center gap-1.5">
                  {[0.05, 0.1, 0.25, 0.5].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setSelectedStake(amt)}
                      disabled={isSubmittingTx}
                      className={`px-3 py-1 rounded-xl text-xs font-mono font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                        selectedStake === amt
                          ? "bg-text-primary text-white shadow-soft"
                          : "bg-surface text-text-secondary hover:text-text-primary border border-border"
                      }`}
                    >
                      {amt} MON
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed text-center">
                Will {selectedAsset} be higher or lower in 10 seconds? Pick your side:
              </p>

              {/* TWO LARGE NATIVE-STYLE ACTION BUTTONS: HIGHER & LOWER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* HIGHER BUTTON */}
                <button
                  onClick={() => handleStartRound("HIGHER")}
                  disabled={isSubmittingTx || currentPrice <= 0}
                  className="group relative h-14 sm:h-16 rounded-2xl bg-surface border-2 border-positive/30 hover:border-positive hover:bg-positive/5 active:scale-[0.97] transition-all flex items-center justify-between px-5 shadow-soft disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-positive/10 text-positive flex items-center justify-center group-hover:scale-105 transition-transform">
                      {isSubmittingTx ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                      )}
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
                    1.96x
                  </span>
                </button>

                {/* LOWER BUTTON */}
                <button
                  onClick={() => handleStartRound("LOWER")}
                  disabled={isSubmittingTx || currentPrice <= 0}
                  className="group relative h-14 sm:h-16 rounded-2xl bg-surface border-2 border-negative/30 hover:border-negative hover:bg-negative/5 active:scale-[0.97] transition-all flex items-center justify-between px-5 shadow-soft disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-negative/10 text-negative flex items-center justify-center group-hover:scale-105 transition-transform">
                      {isSubmittingTx ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <TrendingDown className="w-5 h-5 stroke-[2.5]" />
                      )}
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
                    1.96x
                  </span>
                </button>
              </div>

              {/* House Treasury on-chain badge */}
              <div className="pt-2 text-center text-[11px] font-mono text-text-tertiary flex items-center justify-center gap-1.5">
                <span>⚡ Escrow On-Chain: fondos enrutados a la Casa</span>
                <a
                  href={`https://testnet.monadscan.com/address/${HOUSE_TREASURY_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-monad-600 hover:underline font-semibold inline-flex items-center gap-0.5"
                >
                  <span>({HOUSE_TREASURY_ADDRESS.slice(0, 6)}…{HOUSE_TREASURY_ADDRESS.slice(-4)})</span>
                  <ExternalLink size={9} />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
