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
  ShieldCheck,
  Zap,
} from "lucide-react";
import confetti from "canvas-confetti";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import { PriceSparkline } from "./PriceSparkline";
import { SupportedAsset, usePriceStream } from "@/infrastructure/price-feed/usePriceStream";
import { getPriceSourceLabel } from "@/infrastructure/price-feed/priceSource";
import { useNativeBalance } from "@/presentation/hooks/useNativeBalance";
import { formatNativeBalance } from "@/domain/social/identity";
import { recordDuel } from "@/domain/duel/duelHistory";
import { useDuelWalletClient } from "@/presentation/hooks/useDuelWalletClient";
import {
  createDuelOnChain,
  joinDuelOnChain,
  startDuelOnChain,
  cancelDuelOnChain,
  commitOutcomeOnChain,
  settleAndClaimOnChain,
  fetchDuelDetails,
  fetchOpenDuels,
  type OnChainDuel,
} from "@/infrastructure/web3/duelArenaClient";
import {
  DUEL_ARENA_CONTRACT_ADDRESS,
  monadTestnet,
} from "@/infrastructure/web3/monadChain";
import { keccak256, toHex, type Address, type Hex } from "viem";

interface ArenaViewProps {
  userAddress?: string;
  onConnect?: () => void;
  initialDuelId?: string | bigint;
}

type Direction = "HIGHER" | "LOWER";

const QUICK_STAKES = ["0.05", "0.1", "0.25", "0.5"];

export const ArenaView: React.FC<ArenaViewProps> = ({ userAddress, onConnect, initialDuelId }) => {
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("BTC");
  const { currentPrice, isLive, source } = usePriceStream(selectedAsset);
  const nativeBalance = useNativeBalance(userAddress);
  const { getClient } = useDuelWalletClient();
  const isWalletConnected = Boolean(userAddress);

  // Active Duel & Lobby States
  const [activeDuel, setActiveDuel] = useState<OnChainDuel | null>(null);
  const [openDuels, setOpenDuels] = useState<OnChainDuel[]>([]);
  const [loadingOpenDuels, setLoadingOpenDuels] = useState(false);
  const [activeTab, setActiveTab] = useState<"ARENA" | "OPEN_DUELS">("ARENA");

  // Duel Creation Form
  const [stakeAmount, setStakeAmount] = useState<string>("0.1");
  const [matchDuration, setMatchDuration] = useState<number>(30);
  const [initialDirection, setInitialDirection] = useState<Direction>("HIGHER");
  const [joinDuelInput, setJoinDuelInput] = useState<string>(initialDuelId ? String(initialDuelId) : "");

  // Auto-load initial duel from challenge if provided
  useEffect(() => {
    if (initialDuelId) {
      setJoinDuelInput(String(initialDuelId));
      try {
        const idBig = BigInt(initialDuelId);
        fetchDuelDetails(idBig).then((d) => {
          if (d) {
            setActiveDuel(d);
            setActiveTab("ARENA");
          }
        });
      } catch (err) {
        console.warn("Invalid initialDuelId:", initialDuelId, err);
      }
    }
  }, [initialDuelId]);

  // Transaction & Match Progress
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [txMessage, setTxMessage] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [strikePrice, setStrikePrice] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [matchWinner, setMatchWinner] = useState<"ME" | "OPPONENT" | "DRAW" | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const displayBalance =
    isWalletConnected && nativeBalance.status === "ready" && nativeBalance.value !== undefined
      ? formatNativeBalance(nativeBalance.value)
      : isWalletConnected && nativeBalance.status === "loading"
      ? "Checking…"
      : isWalletConnected && nativeBalance.status === "error"
      ? "Unavailable"
      : null;

  // Load Open Duels from Contract
  const loadOpenDuels = async () => {
    setLoadingOpenDuels(true);
    try {
      const duels = await fetchOpenDuels(undefined, 8);
      setOpenDuels(duels);
    } catch (err) {
      console.error("Failed to load open duels:", err);
    } finally {
      setLoadingOpenDuels(false);
    }
  };

  useEffect(() => {
    loadOpenDuels();
  }, []);

  // Poll Open Duels Lobby when on the lobby tab
  useEffect(() => {
    if (activeTab !== "OPEN_DUELS") return;

    const interval = setInterval(() => {
      loadOpenDuels();
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab]);

  // Poll Active Duel State when waiting or active
  useEffect(() => {
    if (!activeDuel || activeDuel.state === "SETTLED" || activeDuel.state === "CANCELLED") return;

    const interval = setInterval(async () => {
      const updated = await fetchDuelDetails(activeDuel.id);
      if (updated) {
        setActiveDuel(updated);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeDuel]);

  // Active Duel Countdown Loop
  useEffect(() => {
    if (!activeDuel || activeDuel.state !== "ACTIVE") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (strikePrice === 0 && currentPrice > 0) {
      setStrikePrice(currentPrice);
    }

    const now = Math.floor(Date.now() / 1000);
    const end = Number(activeDuel.endTime);
    const remaining = Math.max(0, end - now);
    setTimeLeft(remaining);

    timerRef.current = setInterval(() => {
      const currentNow = Math.floor(Date.now() / 1000);
      const diff = Math.max(0, end - currentNow);
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeDuel, currentPrice, strikePrice]);

  // Delta during active round
  const currentDelta = strikePrice > 0 ? currentPrice - strikePrice : 0;
  const currentDeltaPercent = strikePrice > 0 ? (currentDelta / strikePrice) * 100 : 0;
  const isWinningLive =
    initialDirection === "HIGHER" ? currentDelta > 0 : currentDelta < 0;

  // Action: Create Duel on Chain
  const handleCreateDuel = async () => {
    if (!userAddress) {
      onConnect?.();
      return;
    }

    setIsProcessingTx(true);
    setTxMessage("Preparing createDuel transaction on Monad Testnet...");
    setLastTxHash(null);

    try {
      const walletClient = await getClient();
      if (!walletClient) throw new Error("Wallet provider not connected");

      const rulesHash = keccak256(toHex(`${selectedAsset}_${matchDuration}S_${initialDirection}`));
      setTxMessage("Confirm transaction in your wallet...");

      const { txHash, duelId } = await createDuelOnChain(
        walletClient,
        userAddress as Address,
        matchDuration,
        rulesHash,
        stakeAmount
      );

      setLastTxHash(txHash);
      setTxMessage(`Duel created on Monad Testnet! Tx: ${txHash.slice(0, 10)}…`);

      if (duelId) {
        const createdDuel = await fetchDuelDetails(duelId);
        if (createdDuel) {
          setActiveDuel(createdDuel);
        }
      }
      nativeBalance.refresh();
      loadOpenDuels();
    } catch (err: any) {
      console.error("Create duel error:", err);
      setTxMessage(`Failed to create duel: ${err.shortMessage || err.message}`);
    } finally {
      setIsProcessingTx(false);
    }
  };

  // Action: Join an Existing Duel
  const handleJoinDuel = async (duelToJoin: OnChainDuel) => {
    if (!userAddress) {
      onConnect?.();
      return;
    }

    if (duelToJoin.playerA.toLowerCase() === userAddress.toLowerCase()) {
      setTxMessage("You cannot duel yourself! Please choose an opponent's duel.");
      return;
    }

    setIsProcessingTx(true);
    setTxMessage(`Joining Duel #${duelToJoin.id} with ${duelToJoin.entryStakeMon} MON...`);
    setLastTxHash(null);

    try {
      const walletClient = await getClient();
      if (!walletClient) throw new Error("Wallet provider not connected");

      setTxMessage("Confirm transaction in your wallet...");
      const txHash = await joinDuelOnChain(
        walletClient,
        userAddress as Address,
        duelToJoin.id,
        duelToJoin.entryStakeMon
      );

      setLastTxHash(txHash);
      setTxMessage(`Joined Duel #${duelToJoin.id}! Waiting for match start.`);

      const updated = await fetchDuelDetails(duelToJoin.id);
      if (updated) {
        setActiveDuel(updated);
        setActiveTab("ARENA");
      }
      nativeBalance.refresh();
      loadOpenDuels();
    } catch (err: any) {
      console.error("Join duel error:", err);
      setTxMessage(`Failed to join duel: ${err.shortMessage || err.message}`);
    } finally {
      setIsProcessingTx(false);
    }
  };

  // Action: Cancel Duel and Refund Stake
  const handleCancelDuel = async (duelId: bigint) => {
    if (!userAddress) {
      onConnect?.();
      return;
    }

    setIsProcessingTx(true);
    setTxMessage(`Cancelling Duel #${duelId} and refunding stake on Monad Testnet...`);
    setLastTxHash(null);

    try {
      const walletClient = await getClient();
      if (!walletClient) throw new Error("Wallet provider not connected");

      setTxMessage("Confirm cancellation in your wallet...");
      const txHash = await cancelDuelOnChain(
        walletClient,
        userAddress as Address,
        duelId
      );

      setLastTxHash(txHash);
      setTxMessage(`Duel #${duelId} cancelled! Escrow stake refunded to your wallet.`);

      const updated = await fetchDuelDetails(duelId);
      if (updated && activeDuel && activeDuel.id === duelId) {
        setActiveDuel(updated);
      }

      nativeBalance.refresh();
      await loadOpenDuels();
    } catch (err: any) {
      console.error("Cancel duel error:", err);
      setTxMessage(`Failed to cancel duel: ${err.shortMessage || err.message}`);
    } finally {
      setIsProcessingTx(false);
    }
  };

  // Action: Start Duel Timer
  const handleStartDuel = async () => {
    if (!activeDuel || !userAddress) return;

    setIsProcessingTx(true);
    setTxMessage("Starting match countdown on-chain...");
    setLastTxHash(null);

    try {
      const walletClient = await getClient();
      if (!walletClient) throw new Error("Wallet provider not connected");

      const txHash = await startDuelOnChain(walletClient, userAddress as Address, activeDuel.id);
      setLastTxHash(txHash);
      setStrikePrice(currentPrice);

      const updated = await fetchDuelDetails(activeDuel.id);
      if (updated) {
        setActiveDuel(updated);
      }
    } catch (err: any) {
      console.error("Start duel error:", err);
      setTxMessage(`Failed to start duel: ${err.shortMessage || err.message}`);
    } finally {
      setIsProcessingTx(false);
    }
  };

  // Action: Commit Outcome & Claim Purse
  const handleCommitAndClaim = async () => {
    if (!activeDuel || !userAddress) return;

    setIsProcessingTx(true);
    setTxMessage("Requesting authoritative EIP-712 outcome evidence from referee...");
    setLastTxHash(null);

    try {
      const walletClient = await getClient();
      if (!walletClient) throw new Error("Wallet provider not connected");

      // Determine winner based on strike vs settled price
      const delta = currentPrice - strikePrice;
      let declaredWinner: Address = "0x0000000000000000000000000000000000000000";

      if (delta !== 0) {
        // Player A selected initialDirection
        const playerAWon = initialDirection === "HIGHER" ? delta > 0 : delta < 0;
        declaredWinner = playerAWon ? activeDuel.playerA : activeDuel.playerB;
      }

      const stateHash = keccak256(toHex(`DUEL_${activeDuel.id}_${currentPrice}`));
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // 1. Fetch EIP-712 signature from referee
      const refResponse = await fetch("/api/clash/referee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duelId: activeDuel.id.toString(),
          winner: declaredWinner,
          stateHash,
          priceStart: Math.round(strikePrice * 100),
          priceEnd: Math.round(currentPrice * 100),
          deadline,
        }),
      });

      if (!refResponse.ok) {
        const errData = await refResponse.json();
        throw new Error(errData.message || "Referee rejected outcome evidence");
      }

      const { signature: refereeSig } = await refResponse.json();

      setTxMessage("Committing verified outcome to DuelArena on Monad Testnet...");
      const commitTx = await commitOutcomeOnChain(walletClient, userAddress as Address, {
        duelId: activeDuel.id,
        winner: declaredWinner,
        stateHash,
        priceStart: BigInt(Math.round(strikePrice * 100)),
        priceEnd: BigInt(Math.round(currentPrice * 100)),
        deadline: BigInt(deadline),
        sigA: refereeSig,
        sigB: refereeSig,
      });

      setTxMessage("Outcome committed! Settle and claim purse on-chain...");

      const claimTx = await settleAndClaimOnChain(
        walletClient,
        userAddress as Address,
        activeDuel.id
      );

      setLastTxHash(claimTx);

      if (declaredWinner.toLowerCase() === userAddress.toLowerCase()) {
        setMatchWinner("ME");
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        setTxMessage("🎉 VICTORY! Purse claimed directly to your wallet!");
      } else if (declaredWinner === "0x0000000000000000000000000000000000000000") {
        setMatchWinner("DRAW");
        setTxMessage("Match ended in a DRAW. Escrow stake refunded.");
      } else {
        setMatchWinner("OPPONENT");
        setTxMessage("Match settled. Opponent claimed the purse.");
      }

      // Record verified on-chain duel result into persistent history
      const outcomeVal = declaredWinner.toLowerCase() === userAddress.toLowerCase()
        ? "WIN"
        : declaredWinner === "0x0000000000000000000000000000000000000000"
        ? "DRAW"
        : "LOSS";
      const stakeNum = Number(activeDuel.entryStakeMon);
      const payoutNum = outcomeVal === "WIN" ? Number((stakeNum * 1.96).toFixed(4)) : outcomeVal === "DRAW" ? stakeNum : 0;
      const eloDelta = outcomeVal === "WIN" ? 16 : outcomeVal === "LOSS" ? -16 : 0;

      recordDuel({
        playerAddress: userAddress,
        asset: selectedAsset,
        strikePrice,
        settledPrice: currentPrice,
        direction: initialDirection,
        outcome: outcomeVal,
        stake: stakeNum,
        payout: payoutNum,
        eloDelta,
        mode: "onchain",
        onChainDuelId: activeDuel.id.toString(),
      });

      const updated = await fetchDuelDetails(activeDuel.id);
      if (updated) {
        setActiveDuel(updated);
      }
      nativeBalance.refresh();
    } catch (err: any) {
      console.error("Commit and claim error:", err);
      setTxMessage(`Error resolving duel: ${err.shortMessage || err.message}`);
    } finally {
      setIsProcessingTx(false);
    }
  };

  const isBenchmark = source === "benchmark";

  return (
    <div className="max-w-4xl mx-auto w-full space-y-5 pb-6">
      {/* Status & Wallet Balance Card */}
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
              <span className="px-2 py-0.5 rounded-full bg-monad-50 text-monad-700 text-xs font-semibold font-mono border border-monad-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-monad-600" />
                <span>Monad Testnet 10143</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-secondary text-text-secondary text-[11px] font-mono border border-border">
                DuelArena Escrow
              </span>
            </div>
            <p className="break-all text-xs text-text-secondary font-mono mt-0.5">
              {isWalletConnected ? userAddress : "Connect your wallet to join or create real on-chain clashes"}
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
              <span>Get Faucet MON</span>
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

      {/* Navigation Tabs: Arena vs Open Duels Board */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="inline-flex rounded-2xl bg-surface-secondary p-1 border border-border">
          <button
            onClick={() => setActiveTab("ARENA")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "ARENA"
                ? "bg-surface text-text-primary shadow-soft"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Live Arena
          </button>
          <button
            onClick={() => {
              setActiveTab("OPEN_DUELS");
              loadOpenDuels();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "OPEN_DUELS"
                ? "bg-surface text-text-primary shadow-soft"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <span>Open Match Lobby</span>
            {openDuels.length > 0 && (
              <span className="px-1.5 py-0.2 bg-monad-600 text-white rounded-full text-[10px]">
                {openDuels.length}
              </span>
            )}
          </button>
        </div>

        {activeDuel && (
          <div className="text-xs font-mono text-monad-700 font-bold flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Active Duel #{activeDuel.id.toString()} ({activeDuel.state})</span>
          </div>
        )}
      </div>

      {/* VIEW 1: OPEN DUELS LOBBY */}
      {activeTab === "OPEN_DUELS" && (
        <section className="rounded-3xl bg-surface p-5 sm:p-7 border border-border shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-text-primary">Open On-Chain Matches</h3>
              <p className="text-xs text-text-secondary">
                Matches created by other traders waiting on Monad Testnet. Accept challenge to enter escrow.
              </p>
            </div>
            <button
              onClick={loadOpenDuels}
              disabled={loadingOpenDuels}
              className="p-2 rounded-xl border border-border hover:bg-surface-secondary text-text-secondary active:scale-95 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loadingOpenDuels ? "animate-spin" : ""}`} />
            </button>
          </div>

          {openDuels.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Swords className="w-8 h-8 text-text-tertiary mx-auto" />
              <p className="text-sm font-semibold text-text-secondary">No open duels waiting right now.</p>
              <button
                onClick={() => setActiveTab("ARENA")}
                className="px-4 py-2 rounded-xl bg-monad-600 text-white text-xs font-bold"
              >
                Create First Match
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {openDuels.map((duel) => {
                const isCreator = Boolean(
                  userAddress && duel.playerA.toLowerCase() === userAddress.toLowerCase()
                );

                return (
                  <div
                    key={duel.id.toString()}
                    className={`p-4 rounded-2xl border space-y-3 ${
                      isCreator
                        ? "bg-monad-50/20 border-monad-200"
                        : "bg-surface-secondary/70 border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-text-primary">
                          Duel #{duel.id.toString()}
                        </span>
                        {isCreator && (
                          <span className="px-2 py-0.5 rounded-full bg-monad-100 text-monad-800 text-[10px] font-mono font-bold border border-monad-300">
                            YOUR DUEL
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-mono font-bold">
                        WAITING
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-text-tertiary block text-[10px]">Creator</span>
                        <span className="text-text-primary font-bold">
                          {isCreator ? "You" : `${duel.playerA.slice(0, 6)}…${duel.playerA.slice(-4)}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-tertiary block text-[10px]">Stake Escrow</span>
                        <span className="text-monad-700 font-bold">
                          {duel.entryStakeMon} MON
                        </span>
                      </div>
                    </div>

                    {isCreator ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCancelDuel(duel.id)}
                            disabled={isProcessingTx}
                            className="flex-1 py-2.5 rounded-xl bg-negative/10 hover:bg-negative text-negative hover:text-white border border-negative/30 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-soft disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel & Refund Stake</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveDuel(duel);
                              setActiveTab("ARENA");
                            }}
                            className="px-3.5 py-2.5 rounded-xl bg-surface hover:bg-surface-secondary border border-border text-xs font-bold text-text-primary active:scale-95 transition-all"
                            title="Open in Arena"
                          >
                            Open
                          </button>
                        </div>
                        <span className="text-[10px] text-text-tertiary block text-center">
                          Cancel anytime to refund {duel.entryStakeMon} MON to your wallet.
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleJoinDuel(duel)}
                        disabled={isProcessingTx}
                        className="w-full py-2.5 rounded-xl bg-monad-600 hover:bg-monad-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-soft disabled:opacity-50"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Accept Challenge ({duel.entryStakeMon} MON)</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* VIEW 2: MAIN ARENA BATTLE CANVAS */}
      {activeTab === "ARENA" && (
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
                  disabled={activeDuel?.state === "ACTIVE"}
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
                · {isLive ? "Pyth Hermes Live" : "Simulated"}
              </span>
            </div>
          </div>

          {/* Asset sparkline with live pricing */}
          <PriceSparkline asset={selectedAsset} />

          {/* Feedback & Transaction Banner */}
          {txMessage && (
            <div className="p-3.5 rounded-2xl bg-surface-secondary border border-border text-xs flex items-center justify-between gap-2 animate-fade-in">
              <span className="font-mono text-text-primary">{txMessage}</span>
              {lastTxHash && (
                <a
                  href={`https://testnet.monadscan.com/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-monad-600 hover:text-monad-700 font-bold flex items-center gap-1 text-xs shrink-0"
                >
                  <span>Monadscan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* MATCH STATE 1: ACTIVE DUEL IN PROGRESS */}
          {activeDuel && activeDuel.state === "ACTIVE" && (
            <div className="rounded-2xl bg-surface-secondary/70 border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary uppercase tracking-wide flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-positive animate-pulse" />
                  Live On-Chain Duel #{activeDuel.id.toString()}
                </span>
                <span className="text-xs font-mono font-bold text-monad-700">
                  Purse: {(Number(activeDuel.entryStakeMon) * 2).toFixed(2)} MON
                </span>
              </div>

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
                <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-monad-600 transition-all duration-1000 ease-linear rounded-full"
                    style={{
                      width: `${(timeLeft / Number(activeDuel.duration || 30)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Live Prices and Momentum */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-surface border border-border space-y-1">
                  <span className="text-[11px] font-semibold text-text-tertiary uppercase block">
                    Strike Price
                  </span>
                  <span className="text-base font-bold font-mono text-text-primary tabular-nums">
                    ${strikePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-text-secondary block">
                    Your position: <strong className="text-text-primary">{initialDirection}</strong>
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
                      <span className="text-positive font-bold">▲ You are in the lead!</span>
                    ) : (
                      <span className="text-negative font-bold">▼ Opponent currently leading</span>
                    )}
                  </span>
                </div>
              </div>

              {timeLeft === 0 && (
                <button
                  onClick={handleCommitAndClaim}
                  disabled={isProcessingTx}
                  className="w-full py-3.5 rounded-xl bg-monad-600 hover:bg-monad-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-soft"
                >
                  <Trophy className="w-4 h-4" />
                  <span>Verify & Settle Match On-Chain</span>
                </button>
              )}
            </div>
          )}

          {/* MATCH STATE 2: WAITING FOR OPPONENT OR READY TO START */}
          {activeDuel && (activeDuel.state === "CREATED" || activeDuel.state === "JOINED") && (
            <div className="rounded-2xl bg-surface-secondary/70 border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-text-primary">
                  Duel #{activeDuel.id.toString()}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                    activeDuel.state === "CREATED"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-positive/10 text-positive border-positive/30"
                  }`}
                >
                  {activeDuel.state === "CREATED" ? "WAITING FOR OPPONENT" : "OPPONENT JOINED"}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-border space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Player A (Creator):</span>
                  <span className="font-bold text-text-primary">
                    {activeDuel.playerA.slice(0, 8)}…{activeDuel.playerA.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Player B (Challenger):</span>
                  <span className="font-bold text-text-primary">
                    {activeDuel.playerB !== "0x0000000000000000000000000000000000000000"
                      ? `${activeDuel.playerB.slice(0, 8)}…${activeDuel.playerB.slice(-6)}`
                      : "Waiting for opponent to join…"}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="text-text-tertiary">Total Escrow Purse:</span>
                  <span className="font-bold text-monad-700">
                    {(Number(activeDuel.entryStakeMon) * 2).toFixed(2)} MON
                  </span>
                </div>
              </div>

              {activeDuel.state === "JOINED" ? (
                <div className="space-y-2">
                  <button
                    onClick={handleStartDuel}
                    disabled={isProcessingTx}
                    className="w-full py-3.5 rounded-xl bg-monad-600 hover:bg-monad-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-soft disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Start Match Countdown (On-Chain)</span>
                  </button>
                  <button
                    onClick={() => handleCancelDuel(activeDuel.id)}
                    disabled={isProcessingTx}
                    className="w-full py-2.5 rounded-xl bg-surface-secondary hover:bg-negative/10 text-text-secondary hover:text-negative border border-border hover:border-negative/30 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Abort Match & Refund Escrows</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-text-secondary text-center space-y-1">
                    <p>Share Duel ID <strong className="text-text-primary">#{activeDuel.id.toString()}</strong> with a challenger.</p>
                    <p className="text-[11px] text-text-tertiary">Your {activeDuel.entryStakeMon} MON escrow is safely held in DuelArena contract.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      onClick={() => handleCancelDuel(activeDuel.id)}
                      disabled={isProcessingTx}
                      className="flex-1 py-3 rounded-xl bg-negative/10 hover:bg-negative text-negative hover:text-white border border-negative/30 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-soft disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel Duel & Refund Stake ({activeDuel.entryStakeMon} MON)</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("OPEN_DUELS");
                        loadOpenDuels();
                      }}
                      className="px-4 py-3 rounded-xl bg-surface-secondary hover:bg-surface border border-border text-xs font-bold text-text-secondary hover:text-text-primary active:scale-95 transition-all"
                    >
                      Open Match Lobby
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MATCH STATE 3: SETTLED RESULT */}
          {activeDuel && (activeDuel.state === "SETTLED" || activeDuel.state === "COMMITTED") && (
            <div className="rounded-2xl bg-surface border border-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-positive" />
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                    Duel #{activeDuel.id.toString()} Completed
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-positive bg-positive/10 px-2 py-0.5 rounded-full">
                  SETTLED
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-secondary text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Winner:</span>
                  <span className="font-bold text-text-primary">
                    {activeDuel.winner !== "0x0000000000000000000000000000000000000000"
                      ? `${activeDuel.winner.slice(0, 8)}…${activeDuel.winner.slice(-6)}`
                      : "DRAW (Refunds Issued)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Purse Claimed:</span>
                  <span className="font-bold text-monad-700">
                    {(Number(activeDuel.entryStakeMon) * 1.96).toFixed(3)} MON (2% fee deducted)
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveDuel(null);
                  setStrikePrice(0);
                  setTxMessage(null);
                }}
                className="w-full py-3 rounded-xl bg-monad-600 hover:bg-monad-700 text-white text-xs font-bold uppercase tracking-wider"
              >
                Create or Join Next Match
              </button>
            </div>
          )}

          {/* MATCH STATE 4: CANCELLED RESULT */}
          {activeDuel && activeDuel.state === "CANCELLED" && (
            <div className="rounded-2xl bg-surface border border-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-text-tertiary" />
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                    Duel #{activeDuel.id.toString()} Cancelled
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-text-secondary bg-surface-secondary px-2 py-0.5 rounded-full border border-border">
                  CANCELLED
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-secondary/70 border border-border text-xs space-y-1">
                <p className="font-semibold text-text-primary">
                  This duel was successfully cancelled on Monad Testnet.
                </p>
                <p className="text-text-secondary">
                  The {activeDuel.entryStakeMon} MON escrow was refunded directly to your wallet.
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveDuel(null);
                  setStrikePrice(0);
                  setTxMessage(null);
                }}
                className="w-full py-3 rounded-xl bg-monad-600 hover:bg-monad-700 text-white text-xs font-bold uppercase tracking-wider"
              >
                Create or Join Next Match
              </button>
            </div>
          )}

          {/* MATCH STATE 5: NO ACTIVE DUEL -> CREATE OR JOIN */}
          {!activeDuel && (
            <div className="space-y-5">
              {/* Stake & Duration Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary block">
                    Select MON Stake (Escrow per player)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_STAKES.map((stake) => (
                      <button
                        key={stake}
                        onClick={() => setStakeAmount(stake)}
                        className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                          stakeAmount === stake
                            ? "bg-monad-600 text-white border-monad-600 shadow-soft"
                            : "bg-surface-secondary border-border text-text-primary hover:border-text-secondary"
                        }`}
                      >
                        {stake}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary block">
                    Match Duration
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMatchDuration(30)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                        matchDuration === 30
                          ? "bg-monad-600 text-white border-monad-600 shadow-soft"
                          : "bg-surface-secondary border-border text-text-primary hover:border-text-secondary"
                      }`}
                    >
                      30s Blitz
                    </button>
                    <button
                      onClick={() => setMatchDuration(60)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                        matchDuration === 60
                          ? "bg-monad-600 text-white border-monad-600 shadow-soft"
                          : "bg-surface-secondary border-border text-text-primary hover:border-text-secondary"
                      }`}
                    >
                      60s Standard
                    </button>
                  </div>
                </div>
              </div>

              {/* PREDICT INITIAL DIRECTION & CREATE DUEL */}
              <div className="space-y-3">
                <p className="text-xs text-text-secondary text-center">
                  Predict direction for {selectedAsset} to deploy on-chain escrow duel:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    onClick={() => {
                      setInitialDirection("HIGHER");
                      handleCreateDuel();
                    }}
                    disabled={isProcessingTx || currentPrice <= 0}
                    className="h-16 rounded-2xl bg-surface border-2 border-positive/30 hover:border-positive hover:bg-positive/5 active:scale-[0.98] transition-all flex items-center justify-between px-5 shadow-soft disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-positive/10 text-positive flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-text-primary block leading-tight">
                          HIGHER
                        </span>
                        <span className="text-[11px] font-semibold text-positive block leading-tight mt-0.5">
                          Deposit {stakeAmount} MON Escrow
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-positive bg-positive/10 px-2 py-1 rounded-lg">
                      Create Duel
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setInitialDirection("LOWER");
                      handleCreateDuel();
                    }}
                    disabled={isProcessingTx || currentPrice <= 0}
                    className="h-16 rounded-2xl bg-surface border-2 border-negative/30 hover:border-negative hover:bg-negative/5 active:scale-[0.98] transition-all flex items-center justify-between px-5 shadow-soft disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-negative/10 text-negative flex items-center justify-center">
                        <TrendingDown className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <span className="text-base font-bold text-text-primary block leading-tight">
                          LOWER
                        </span>
                        <span className="text-[11px] font-semibold text-negative block leading-tight mt-0.5">
                          Deposit {stakeAmount} MON Escrow
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-negative bg-negative/10 px-2 py-1 rounded-lg">
                      Create Duel
                    </span>
                  </button>
                </div>
              </div>

              {/* JOIN BY ID QUICK BAR */}
              <div className="pt-2 border-t border-border flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Enter Duel ID to join (e.g. 1)"
                  value={joinDuelInput}
                  onChange={(e) => setJoinDuelInput(e.target.value)}
                  className="flex-1 h-11 px-3.5 rounded-xl bg-surface-secondary border border-border text-xs font-mono text-text-primary focus:outline-none focus:border-monad-600"
                />
                <button
                  onClick={async () => {
                    if (!joinDuelInput) return;
                    const duel = await fetchDuelDetails(BigInt(joinDuelInput));
                    if (duel) {
                      handleJoinDuel(duel);
                    } else {
                      setTxMessage(`Duel #${joinDuelInput} not found on Monad Testnet.`);
                    }
                  }}
                  disabled={!joinDuelInput || isProcessingTx}
                  className="h-11 px-4 rounded-xl bg-surface-secondary hover:bg-surface border border-border text-xs font-bold text-text-primary active:scale-95 transition-all disabled:opacity-50"
                >
                  Join Match
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
