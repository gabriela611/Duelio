"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { soundEngine } from "./gameAudio";
import {
  Trophy,
  Volume2,
  VolumeX,
  RefreshCw,
  Zap,
  Users,
  User,
  ArrowLeft,
  Radio,
  TrendingUp,
  TrendingDown,
  Coins,
  Percent,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { usePriceStream, SupportedAsset } from "@/infrastructure/price-feed/usePriceStream";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

type PredictionCall = "UP" | "DOWN" | null;
type RoundPhase = "LOCK_IN" | "RESOLVING" | "ROUND_RESULT";

interface ResolvedCandle {
  roundNumber: number;
  openPrice: number;
  closePrice: number;
  highPrice: number;
  lowPrice: number;
  winnerCall: "UP" | "DOWN" | "DRAW";
  p1Call: PredictionCall;
  p2Call: PredictionCall;
  p1Won: boolean;
  p2Won: boolean;
}

export function RocketClashGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Asset selection & Price Stream
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("MON");
  const priceState = usePriceStream(selectedAsset);
  const { currentPrice, isLive } = priceState;

  // Game configuration & match state
  const [gameMode, setGameMode] = useState<"solo" | "versus">("solo");
  const [stakeMon, setStakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "gameover">("idle");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [matchWinner, setMatchWinner] = useState<"P1" | "P2" | "DRAW" | null>(null);

  // 4-Candle Blitz State
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundPhase, setRoundPhase] = useState<RoundPhase>("LOCK_IN");
  const [roundTimeLeft, setRoundTimeLeft] = useState<number>(5.0);
  const [p1Score, setP1Score] = useState<number>(0);
  const [p2Score, setP2Score] = useState<number>(0);

  // Player predictions for current round
  const [p1Call, setP1Call] = useState<PredictionCall>(null);
  const [p2Call, setP2Call] = useState<PredictionCall>(null);
  const [aiThought, setAiThought] = useState<string>("Analyzing price momentum... 📊");

  // Round candle prices
  const roundOpenPriceRef = useRef<number>(currentPrice);
  const roundHighPriceRef = useRef<number>(currentPrice);
  const roundLowPriceRef = useRef<number>(currentPrice);
  const currentPriceRef = useRef<number>(currentPrice);
  const [roundOpenPrice, setRoundOpenPrice] = useState<number>(currentPrice);

  useEffect(() => {
    currentPriceRef.current = currentPrice;
    if (gameState === "playing" && roundPhase === "RESOLVING") {
      roundHighPriceRef.current = Math.max(roundHighPriceRef.current, currentPrice);
      roundLowPriceRef.current = Math.min(roundLowPriceRef.current, currentPrice);
    }
  }, [currentPrice, gameState, roundPhase]);

  // History of completed rounds
  const [resolvedCandles, setResolvedCandles] = useState<ResolvedCandle[]>([]);

  // Physics & Animation refs
  const animFrameId = useRef<number>(0);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const p1CallRef = useRef<PredictionCall>(null);
  const p2CallRef = useRef<PredictionCall>(null);

  // Ships position for track animations
  const p1TrackX = useRef<number>(120);
  const p2TrackX = useRef<number>(120);

  // Audio toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Lock P1 Prediction Call
  const handleP1Call = useCallback((call: "UP" | "DOWN") => {
    if (gameState !== "playing" || roundPhase !== "LOCK_IN") return;
    setP1Call(call);
    p1CallRef.current = call;
    soundEngine.playLockSound();
  }, [gameState, roundPhase]);

  // Lock P2 Prediction Call (Versus mode)
  const handleP2Call = useCallback((call: "UP" | "DOWN") => {
    if (gameState !== "playing" || roundPhase !== "LOCK_IN" || gameMode !== "versus") return;
    setP2Call(call);
    p2CallRef.current = call;
    soundEngine.playLockSound();
  }, [gameState, roundPhase, gameMode]);

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyA" || e.code === "ArrowLeft" || e.code === "ArrowUp") {
        e.preventDefault();
        handleP1Call("UP");
      } else if (e.code === "KeyD" || e.code === "ArrowRight" || e.code === "ArrowDown") {
        e.preventDefault();
        handleP1Call("DOWN");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleP1Call]);

  // Start 4-Round Blitz Match
  const startMatch = useCallback(() => {
    setMatchWinner(null);
    setGameState("countdown");
    setResolvedCandles([]);
    setCurrentRound(1);
    setP1Score(0);
    setP2Score(0);
    setP1Call(null);
    setP2Call(null);
    p1CallRef.current = null;
    p2CallRef.current = null;
    p1TrackX.current = 120;
    p2TrackX.current = 120;

    let c = 3;
    soundEngine.playCountdownBeep(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      c--;
      if (c > 0) {
        soundEngine.playCountdownBeep(false);
      } else {
        clearInterval(countdownTimerRef.current!);
        soundEngine.playCountdownBeep(true);
        startRoundCycle(1, 0, 0);
      }
    }, 1000);
  }, [currentPrice]);

  // Execute 5-second Round Cycle
  const startRoundCycle = (roundNum: number, currentP1Score: number, currentP2Score: number) => {
    setGameState("playing");
    setCurrentRound(roundNum);
    setRoundPhase("LOCK_IN");
    setP1Call(null);
    setP2Call(null);
    p1CallRef.current = null;
    p2CallRef.current = null;

    // Snapshot Open Price
    const openP = currentPriceRef.current;
    roundOpenPriceRef.current = openP;
    roundHighPriceRef.current = openP;
    roundLowPriceRef.current = openP;
    setRoundOpenPrice(openP);

    // AI Prediction Decision in Solo mode (Locks around T=1.2s)
    if (gameMode === "solo") {
      setAiThought("Analyzing order book momentum... 👀");
      setTimeout(() => {
        // AI reads subtle micro-momentum or flips 50/50 with momentum bias
        const aiPick: "UP" | "DOWN" = Math.random() > 0.48 ? "UP" : "DOWN";
        setP2Call(aiPick);
        p2CallRef.current = aiPick;
        setAiThought(aiPick === "UP" ? "Bullish trend! Locking SUBE 🟢" : "Bearish breakdown! Locking BAJA 🔴");
      }, 1200);
    }

    // 5.0-second round clock
    let timeLeftMs = 5000;
    const intervalTime = 100;

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    roundTimerRef.current = setInterval(() => {
      timeLeftMs -= intervalTime;
      setRoundTimeLeft(Number((timeLeftMs / 1000).toFixed(1)));

      // At T = 3.0s (2 seconds elapsed), lock-in ends and candle resolves
      if (timeLeftMs <= 3000 && timeLeftMs > 2800) {
        setRoundPhase("RESOLVING");
        // Auto-default to UP if player didn't pick
        if (!p1CallRef.current) {
          setP1Call("UP");
          p1CallRef.current = "UP";
        }
        if (gameMode === "solo" && !p2CallRef.current) {
          setP2Call("DOWN");
          p2CallRef.current = "DOWN";
        }
      }

      // Round Finished (0s)
      if (timeLeftMs <= 0) {
        clearInterval(roundTimerRef.current!);
        resolveRound(roundNum, currentP1Score, currentP2Score);
      }
    }, intervalTime);
  };

  // Evaluate Round Result
  const resolveRound = (roundNum: number, currentP1Score: number, currentP2Score: number) => {
    setRoundPhase("ROUND_RESULT");
    const openP = roundOpenPriceRef.current;
    const closeP = currentPriceRef.current;
    const highP = roundHighPriceRef.current;
    const lowP = roundLowPriceRef.current;

    let winnerCall: "UP" | "DOWN" | "DRAW" = "DRAW";
    if (closeP > openP) winnerCall = "UP";
    else if (closeP < openP) winnerCall = "DOWN";

    const p1 = p1CallRef.current;
    const p2 = p2CallRef.current;

    const p1Won = p1 === winnerCall;
    const p2Won = p2 === winnerCall;

    let newP1Score = currentP1Score;
    let newP2Score = currentP2Score;

    if (p1Won) {
      newP1Score += 1;
      soundEngine.playRoundWinSound();
    }
    if (p2Won) {
      newP2Score += 1;
    }

    setP1Score(newP1Score);
    setP2Score(newP2Score);

    const candleResult: ResolvedCandle = {
      roundNumber: roundNum,
      openPrice: openP,
      closePrice: closeP,
      highPrice: highP,
      lowPrice: lowP,
      winnerCall,
      p1Call: p1,
      p2Call: p2,
      p1Won,
      p2Won,
    };

    setResolvedCandles((prev) => [...prev, candleResult]);

    // Check match completion (4 rounds complete, or tiebreaker needed)
    setTimeout(() => {
      if (roundNum >= 4) {
        // Match concludes
        finalizeMatch(newP1Score, newP2Score);
      } else {
        // Next Round
        startRoundCycle(roundNum + 1, newP1Score, newP2Score);
      }
    }, 1500);
  };

  // Finalize Match Winner
  const finalizeMatch = (finalP1: number, finalP2: number) => {
    setGameState("gameover");
    if (finalP1 > finalP2) {
      setMatchWinner("P1");
      soundEngine.playVictoryJingle();
      try {
        confetti({
          particleCount: 85,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#6E4EF4", "#10B981", "#F59E0B"],
        });
      } catch (_) {}
    } else if (finalP2 > finalP1) {
      setMatchWinner("P2");
      soundEngine.playStallSound();
    } else {
      setMatchWinner("DRAW");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  // Main Canvas Rendering Loop (Apple Design System)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. APPLE LIGHT MODE SURFACE
      ctx.clearRect(0, 0, width, height);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#FFFFFF");
      bgGrad.addColorStop(1, "#F8F8F7");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle Cupertino Grid
      ctx.strokeStyle = "rgba(0, 0, 0, 0.04)";
      ctx.lineWidth = 1;
      for (let y = 30; y < height; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. CHECKPOINT RACE TRACK (Across Top of Canvas)
      const trackY = 54;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(80, trackY);
      ctx.lineTo(width - 80, trackY);
      ctx.stroke();

      // 4 Checkpoint Nodes
      for (let i = 1; i <= 4; i++) {
        const nodeX = 80 + ((width - 160) / 3) * (i - 1);
        const isPast = i < currentRound;
        const isCurrent = i === currentRound;

        ctx.fillStyle = isPast ? "#10B981" : isCurrent ? "#6E4EF4" : "#E2E8F0";
        ctx.beginPath();
        ctx.arc(nodeX, trackY, isCurrent ? 9 : 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = isCurrent ? "#6E4EF4" : "#64748B";
        ctx.textAlign = "center";
        ctx.fillText(`R${i}`, nodeX, trackY - 14);
      }

      // Smoothly animate ships towards current score checkpoint
      const targetP1X = 80 + ((width - 160) / 4) * p1Score;
      const targetP2X = 80 + ((width - 160) / 4) * p2Score;
      p1TrackX.current += (targetP1X - p1TrackX.current) * 0.1;
      p2TrackX.current += (targetP2X - p2TrackX.current) * 0.1;

      // Draw P1 Ship on Track
      ctx.fillStyle = "#6E4EF4";
      ctx.beginPath();
      ctx.arc(p1TrackX.current, trackY - 1, 6, 0, Math.PI * 2);
      ctx.fill();

      // 3. CINEMATIC REAL-TIME CANDLESTICK DISPLAY (Center Stage)
      const arenaCenterY = height * 0.58;
      const arenaCenterX = width * 0.5;

      // Strike Price Reference Baseline
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(40, arenaCenterY);
      ctx.lineTo(width - 40, arenaCenterY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Baseline Price Badge
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(40, arenaCenterY - 11, 120, 22, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.fillText(`OPEN: $${roundOpenPriceRef.current.toFixed(selectedAsset === "BTC" ? 1 : 2)}`, 100, arenaCenterY + 4);

      // Render Historical Completed Candles from this match
      resolvedCandles.forEach((c, idx) => {
        const candleX = 190 + idx * 85;
        const isGreen = c.winnerCall === "UP";
        const color = isGreen ? "#10B981" : "#EF4444";

        const deltaClose = ((c.closePrice - c.openPrice) / c.openPrice) * 100;
        const candleH = Math.max(12, Math.min(80, Math.abs(deltaClose) * 400));
        const candleY = isGreen ? arenaCenterY - candleH : arenaCenterY;

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(candleX + 16, arenaCenterY - 50);
        ctx.lineTo(candleX + 16, arenaCenterY + 50);
        ctx.stroke();

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(candleX, candleY, 32, candleH, 4);
        ctx.fill();

        // Round Badge
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillStyle = "#64748B";
        ctx.textAlign = "center";
        ctx.fillText(`R${c.roundNumber}`, candleX + 16, arenaCenterY + 70);
      });

      // Render Active Live Forming Candle (Round in progress)
      if (gameState === "playing") {
        const activeCandleX = 190 + resolvedCandles.length * 85;
        const currP = currentPriceRef.current;
        const openP = roundOpenPriceRef.current;
        const deltaPct = openP > 0 ? ((currP - openP) / openP) * 100 : 0;

        const isGreen = deltaPct >= 0;
        const activeColor = isGreen ? "#10B981" : "#EF4444";

        const dynamicH = Math.max(8, Math.min(100, Math.abs(deltaPct) * 550));
        const candleY = isGreen ? arenaCenterY - dynamicH : arenaCenterY;

        // Live Wick
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(activeCandleX + 22, arenaCenterY - (dynamicH + 18));
        ctx.lineTo(activeCandleX + 22, arenaCenterY + (dynamicH + 18));
        ctx.stroke();

        // Glowing Live Candle Body
        ctx.fillStyle = activeColor;
        ctx.beginPath();
        ctx.roundRect(activeCandleX, candleY, 44, dynamicH, 6);
        ctx.fill();

        // Live Pulse Pin
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(activeCandleX + 22, isGreen ? candleY : candleY + dynamicH, 4, 0, Math.PI * 2);
        ctx.fill();

        // Live Price Tag floating on active candle
        ctx.fillStyle = activeColor;
        ctx.beginPath();
        ctx.roundRect(activeCandleX - 24, isGreen ? candleY - 26 : candleY + dynamicH + 10, 92, 18, 5);
        ctx.fill();

        ctx.font = "bold 9px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(
          `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(3)}%`,
          activeCandleX + 22,
          isGreen ? candleY - 14 : candleY + dynamicH + 22
        );
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, currentRound, p1Score, p2Score, resolvedCandles, selectedAsset]);

  const totalPot = (stakeMon * 2).toFixed(2);
  const netPayout = (stakeMon * 2 * 0.95).toFixed(4);

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-6 font-sans select-none text-slate-900">
      {/* 1. Top Navigation & Status */}
      <div className="w-full flex items-center justify-between mb-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors p-2 rounded-xl hover:bg-black/[0.04]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Arena</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-black/[0.06] shadow-sm text-xs font-medium text-slate-700">
            <Radio className={`w-3.5 h-3.5 ${isLive ? "text-emerald-500 animate-pulse" : "text-amber-500"}`} />
            <span>Pyth Hermes Oracle</span>
          </div>

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-white border border-black/[0.06] shadow-sm text-slate-600 hover:text-slate-900 hover:bg-black/[0.02] transition-all"
            title={isMuted ? "Unmute sound" : "Mute sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>

      {/* 2. Apple Design Market Banner & Escrow Pot */}
      <div className="w-full bg-white border border-black/[0.06] rounded-2xl p-4 mb-4 shadow-[0_2px_10px_rgba(0,0,0,0.035)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AssetLogo symbol={selectedAsset} size={32} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base">{selectedAsset}/USD</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-[#6E4EF4] font-semibold font-mono">
                Round {currentRound} of 4
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Current Price: ${currentPrice.toFixed(selectedAsset === "BTC" ? 1 : 2)}</span>
            </div>
          </div>
        </div>

        {/* Live Scoreboard */}
        <div className="flex items-center gap-4 px-5 py-2 rounded-xl bg-slate-50 border border-black/[0.04]">
          <div className="text-center">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">You (P1)</div>
            <div className="text-base font-black text-[#6E4EF4] font-mono">{p1Score} WINS</div>
          </div>
          <div className="text-xs font-bold text-slate-300">VS</div>
          <div className="text-center">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">
              {gameMode === "solo" ? "MemeBot AI" : "Rival"}
            </div>
            <div className="text-base font-black text-slate-800 font-mono">{p2Score} WINS</div>
          </div>
        </div>

        {/* Escrow Pot & Protocol Rake */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#6E4EF4]/5 border border-[#6E4EF4]/15">
          <Coins className="w-5 h-5 text-[#6E4EF4]" />
          <div>
            <div className="text-[10px] font-semibold text-[#6E4EF4] uppercase tracking-wider">Escrow Pot (5% Rake)</div>
            <div className="text-xs font-bold text-slate-900 font-mono">
              {totalPot} MON • Winner: {netPayout} MON
            </div>
          </div>
        </div>
      </div>

      {/* 3. Canvas Candlestick Arena */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] bg-white">
        <canvas
          ref={canvasRef}
          width={880}
          height={420}
          className="w-full h-auto block touch-none"
        />

        {/* Live Round Timer Pill */}
        {gameState === "playing" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/95 border border-black/[0.08] shadow-sm flex items-center gap-2 text-xs font-bold text-slate-800 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#6E4EF4]" />
            <span>
              {roundPhase === "LOCK_IN"
                ? `LOCK CALL: ${roundTimeLeft}s`
                : `RESOLVING CANDLE: ${roundTimeLeft}s`}
            </span>
          </div>
        )}

        {/* Pre-Match Overlay */}
        {gameState === "idle" && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#6E4EF4]/10 text-[#6E4EF4] flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1.5">
              Round-by-Round Blitz: 4-Candle Showdown
            </h2>

            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              4 mini-rounds of 5 seconds each. In each round, predict whether the Pyth candle closes SUBE or BAJA. Whoever wins more rounds takes the pot!
            </p>

            <div className="flex items-center gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setGameMode("solo")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  gameMode === "solo"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Solo vs MemeBot AI
              </button>
              <button
                onClick={() => setGameMode("versus")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  gameMode === "versus"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                1v1 Duel
              </button>
            </div>

            <div className="flex items-center gap-2 mb-6">
              <span className="text-xs font-semibold text-slate-500 uppercase">Asset:</span>
              {(["MON", "BTC", "ETH", "SOL"] as SupportedAsset[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setSelectedAsset(a)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    selectedAsset === a
                      ? "bg-slate-900 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            <button
              onClick={startMatch}
              className="px-8 py-3 rounded-2xl bg-[#6E4EF4] text-white font-semibold text-sm hover:bg-[#5b3ce0] active:scale-95 transition-all shadow-md shadow-purple-600/20"
            >
              Start 4-Candle Blitz (0.25 MON)
            </button>
          </div>
        )}

        {/* Game Over Settlement Modal */}
        {gameState === "gameover" && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-[#6E4EF4]/10 text-3xl flex items-center justify-center mb-3">
              <Trophy className="w-8 h-8 text-[#6E4EF4]" />
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-1">
              {matchWinner === "P1" ? "Victory! You Out-Predicted the Rival 🏆" : matchWinner === "P2" ? "Rival Won the Blitz 🤖" : "Dead Heat Tie ⚖️"}
            </h3>

            <p className="text-xs text-slate-500 mb-5 font-mono">
              Net Payout: <span className="text-[#6E4EF4] font-bold">{netPayout} MON</span> • 5.0% Protocol Rake
            </p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-6">
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-center">
                <div className="text-[10px] text-purple-600 font-semibold uppercase">YOU (P1)</div>
                <div className="text-2xl font-black text-[#6E4EF4] font-mono">{p1Score} WINS</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">
                  {gameMode === "solo" ? "MEMEBOT AI" : "RIVAL"}
                </div>
                <div className="text-2xl font-black text-slate-800 font-mono">{p2Score} WINS</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={startMatch}
                className="px-6 py-2.5 rounded-xl bg-[#6E4EF4] text-white font-semibold text-sm hover:bg-[#5b3ce0] active:scale-95 transition-all shadow-md flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Play Rematch
              </button>
              <button
                onClick={() => setGameState("idle")}
                className="px-4 py-2.5 rounded-xl bg-white border border-black/[0.08] text-slate-700 font-medium text-sm hover:bg-slate-50 active:scale-95 transition-all"
              >
                Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Active Lock-In Prediction Buttons (Apple Design Touch Controls) */}
      <div className="w-full mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#6E4EF4]" />
            <span>Round {currentRound} Prediction Call (Hotkeys: [A / ←] SUBE • [D / →] BAJA)</span>
          </div>
          <div className="text-xs font-mono text-slate-500">
            {roundPhase === "LOCK_IN" ? (
              <span className="text-[#6E4EF4] font-bold animate-pulse">LOCKING IN ACTIVE...</span>
            ) : (
              <span className="text-emerald-600 font-bold">LOCKED & RESOLVING</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* SUBE BUTTON */}
          <button
            onClick={() => handleP1Call("UP")}
            disabled={gameState !== "playing" || roundPhase !== "LOCK_IN"}
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${
              p1Call === "UP"
                ? "bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                : "bg-white border-black/[0.08] hover:border-black/[0.15]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                  p1Call === "UP" ? "bg-emerald-600 text-white shadow-sm" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                🟢
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>SUBE (HIGHER)</span>
                  {p1Call === "UP" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                      LOCKED
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Candle closes above Open
                </div>
              </div>
            </div>

            <ArrowUpRight
              className={`w-6 h-6 transition-transform ${
                p1Call === "UP" ? "text-emerald-600 scale-125" : "text-slate-400"
              }`}
            />
          </button>

          {/* BAJA BUTTON */}
          <button
            onClick={() => handleP1Call("DOWN")}
            disabled={gameState !== "playing" || roundPhase !== "LOCK_IN"}
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${
              p1Call === "DOWN"
                ? "bg-rose-500/15 border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                : "bg-white border-black/[0.08] hover:border-black/[0.15]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                  p1Call === "DOWN" ? "bg-rose-600 text-white shadow-sm" : "bg-rose-50 text-rose-600"
                }`}
              >
                🔴
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>BAJA (LOWER)</span>
                  {p1Call === "DOWN" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold">
                      LOCKED
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Candle closes below Open
                </div>
              </div>
            </div>

            <ArrowDownRight
              className={`w-6 h-6 transition-transform ${
                p1Call === "DOWN" ? "text-rose-600 scale-125" : "text-slate-400"
              }`}
            />
          </button>
        </div>

        {/* Rival Call Status Indicator */}
        {gameMode === "solo" ? (
          <div className="p-3 rounded-xl bg-slate-50 border border-black/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-base">
                🤖
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900">MemeBot AI Prediction: </span>
                {p2Call ? (
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded ${
                      p2Call === "UP" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {p2Call === "UP" ? "🟢 SUBE (HIGHER)" : "🔴 BAJA (LOWER)"}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Thinking...</span>
                )}
              </div>
            </div>
            <div className="text-xs font-mono text-slate-500 italic">&quot;{aiThought}&quot;</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              onClick={() => handleP2Call("UP")}
              disabled={gameState !== "playing" || roundPhase !== "LOCK_IN"}
              className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                p2Call === "UP" ? "bg-emerald-600 text-white" : "bg-white border-black/[0.08] text-slate-600"
              }`}
            >
              <span>P2: SUBE [↑]</span>
            </button>
            <button
              onClick={() => handleP2Call("DOWN")}
              disabled={gameState !== "playing" || roundPhase !== "LOCK_IN"}
              className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                p2Call === "DOWN" ? "bg-rose-600 text-white" : "bg-white border-black/[0.08] text-slate-600"
              }`}
            >
              <span>P2: BAJA [↓]</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Apple Design System Rules & Economics Cards */}
      <div className="w-full mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-[#6E4EF4]" />
            4 Asaltos de 5 Segundos
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            La partida dura 20s en total. En cada asalto tienes 2s para fijar tu predicción y 3s para ver la vela cerrarse.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            100% Habilidad de Predicción
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Cero físicas flotantes de dedos. Gana quien mejor lea el gráfico y acierte la dirección del precio en tiempo real.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Percent className="w-3.5 h-3.5 text-[#6E4EF4]" />
            5.0% Protocol Rake Garantizado
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pozo P2P de 0.50 MON. 0.025 MON fijo a la tesorería de Duelio. La casa nunca arriesga capital propio.
          </p>
        </div>
      </div>
    </div>
  );
}
