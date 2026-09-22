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
  Coins,
  Percent,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Flame,
  Activity,
  Gauge,
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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  isSmoke?: boolean;
}

export function RocketClashGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Asset selection & Price Stream
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("MON");
  const priceState = usePriceStream(selectedAsset);
  const { currentPrice, isLive } = priceState;

  // Game configuration & match state
  const [gameMode, setGameMode] = useState<"solo" | "versus">("solo");
  const [stakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "gameover">("idle");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [matchWinner, setMatchWinner] = useState<"P1" | "P2" | "DRAW" | null>(null);

  // 4-Candle Blitz State
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundPhase, setRoundPhase] = useState<RoundPhase>("LOCK_IN");
  const [roundTimeLeft, setRoundTimeLeft] = useState<number>(5.0);
  const [p1Score, setP1Score] = useState<number>(0);
  const [p2Score, setP2Score] = useState<number>(0);

  // Real-time telemetry states for UI HUD
  const [p1ThrustPercent, setP1ThrustPercent] = useState<number>(0);
  const [p2ThrustPercent, setP2ThrustPercent] = useState<number>(0);
  const [tugOfWarAdvantage, setTugOfWarAdvantage] = useState<number>(0);

  // Player predictions for current round
  const [p1Call, setP1Call] = useState<PredictionCall>(null);
  const [p2Call, setP2Call] = useState<PredictionCall>(null);
  const [aiThought, setAiThought] = useState<string>("Analyzing price momentum... 📊");

  // Round candle prices
  const roundOpenPriceRef = useRef<number>(currentPrice);
  const roundHighPriceRef = useRef<number>(currentPrice);
  const roundLowPriceRef = useRef<number>(currentPrice);
  const currentPriceRef = useRef<number>(currentPrice);
  const [, setRoundOpenPrice] = useState<number>(currentPrice);

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

  // Tug-of-War dynamic coordinates & particle systems
  const p1PhysicsX = useRef<number>(260);
  const p2PhysicsX = useRef<number>(260);
  const particlesRef = useRef<Particle[]>([]);
  const screenShakeRef = useRef<number>(0);
  const heartbeatTriggeredRef = useRef<boolean>(false);
  const speedLinesRef = useRef<Array<{ x: number; y: number; length: number; speed: number }>>([]);

  // Initialize speed lines for the drag strip
  useEffect(() => {
    const lines = [];
    for (let i = 0; i < 28; i++) {
      lines.push({
        x: Math.random() * 880,
        y: 245 + Math.random() * 155,
        length: 20 + Math.random() * 50,
        speed: 8 + Math.random() * 14,
      });
    }
    speedLinesRef.current = lines;
  }, []);

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
    p1PhysicsX.current = 260;
    p2PhysicsX.current = 260;
    particlesRef.current = [];
    screenShakeRef.current = 0;

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
  }, []);

  // Execute 5-second Round Cycle
  const startRoundCycle = (roundNum: number, currentP1Score: number, currentP2Score: number) => {
    setGameState("playing");
    setCurrentRound(roundNum);
    setRoundPhase("LOCK_IN");
    setP1Call(null);
    setP2Call(null);
    p1CallRef.current = null;
    p2CallRef.current = null;
    heartbeatTriggeredRef.current = false;
    soundEngine.stopThrust();

    // Snapshot Open Price
    const openP = currentPriceRef.current;
    roundOpenPriceRef.current = openP;
    roundHighPriceRef.current = openP;
    roundLowPriceRef.current = openP;
    setRoundOpenPrice(openP);

    // AI Prediction Decision in Solo mode (Locks around T=1.2s)
    if (gameMode === "solo") {
      setAiThought("Scanning order book micro-flow... 👀");
      setTimeout(() => {
        const aiPick: "UP" | "DOWN" = Math.random() > 0.48 ? "UP" : "DOWN";
        setP2Call(aiPick);
        p2CallRef.current = aiPick;
        setAiThought(aiPick === "UP" ? "Bullish volume spike! Locking SUBE 🟢" : "Resistance wall hit! Locking BAJA 🔴");
      }, 1200);
    }

    // 5.0-second round clock
    let timeLeftMs = 5000;
    const intervalTime = 100;

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    roundTimerRef.current = setInterval(() => {
      timeLeftMs -= intervalTime;
      const secLeft = Number((timeLeftMs / 1000).toFixed(1));
      setRoundTimeLeft(secLeft);

      // At T = 3.0s (2 seconds elapsed), lock-in ends and Tug-of-War resolving begins
      if (timeLeftMs <= 3000 && timeLeftMs > 2800) {
        setRoundPhase("RESOLVING");
        soundEngine.startThrust(true);

        if (!p1CallRef.current) {
          setP1Call("UP");
          p1CallRef.current = "UP";
        }
        if (gameMode === "solo" && !p2CallRef.current) {
          setP2Call("DOWN");
          p2CallRef.current = "DOWN";
        }
      }

      // Final 1.0s Photo-Finish heartbeat detection
      if (timeLeftMs <= 1200 && timeLeftMs > 200 && !heartbeatTriggeredRef.current) {
        const openPNow = roundOpenPriceRef.current;
        const currPNow = currentPriceRef.current;
        const delta = openPNow > 0 ? Math.abs((currPNow - openPNow) / openPNow) * 100 : 0;
        if (delta < 0.02) {
          soundEngine.playHeartbeatThump();
          heartbeatTriggeredRef.current = true;
          screenShakeRef.current = 2.5;
        }
      }

      // Round Finished (0s)
      if (timeLeftMs <= 0) {
        clearInterval(roundTimerRef.current!);
        soundEngine.stopThrust();
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
      screenShakeRef.current = 4.0;
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

    // Check match completion after 4 rounds
    setTimeout(() => {
      if (roundNum >= 4) {
        finalizeMatch(newP1Score, newP2Score);
      } else {
        startRoundCycle(roundNum + 1, newP1Score, newP2Score);
      }
    }, 1600);
  };

  // Finalize Match Winner
  const finalizeMatch = (finalP1: number, finalP2: number) => {
    setGameState("gameover");
    soundEngine.stopThrust();
    if (finalP1 > finalP2) {
      setMatchWinner("P1");
      soundEngine.playVictoryJingle();
      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
          colors: ["#6E4EF4", "#10B981", "#3B82F6"],
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
      soundEngine.stopThrust();
    };
  }, []);

  // Main 60fps Canvas Loop: Tug-of-War Physics + Candlestick Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Handle screen micro-shake
      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      if (screenShakeRef.current > 0.1) {
        shakeOffsetX = (Math.random() - 0.5) * screenShakeRef.current * 2;
        shakeOffsetY = (Math.random() - 0.5) * screenShakeRef.current * 2;
        screenShakeRef.current *= 0.88;
      }

      ctx.save();
      ctx.translate(shakeOffsetX, shakeOffsetY);

      // 1. CLEAR & CUPERTINO CANVAS BASE
      ctx.clearRect(-10, -10, width + 20, height + 20);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#FFFFFF");
      bgGrad.addColorStop(1, "#F8F8F7");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle background grid
      ctx.strokeStyle = "rgba(0, 0, 0, 0.035)";
      ctx.lineWidth = 1;
      for (let y = 30; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. CHECKPOINT MATCH TRACK (Top of Canvas)
      const trackY = 46;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(60, trackY);
      ctx.lineTo(width - 60, trackY);
      ctx.stroke();

      for (let i = 1; i <= 4; i++) {
        const nodeX = 60 + ((width - 120) / 3) * (i - 1);
        const isPast = i < currentRound;
        const isCurrent = i === currentRound;

        ctx.fillStyle = isPast ? "#10B981" : isCurrent ? "#6E4EF4" : "#E2E8F0";
        ctx.beginPath();
        ctx.arc(nodeX, trackY, isCurrent ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = isCurrent ? "#6E4EF4" : "#64748B";
        ctx.textAlign = "center";
        ctx.fillText(`R${i}`, nodeX, trackY - 12);
      }

      // 3. CANDLESTICK STRIKE CORRIDOR (Upper Half: Y 65 -> 220)
      const candleBaselineY = 145;

      // Strike Price Reference Baseline
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(40, candleBaselineY);
      ctx.lineTo(width - 40, candleBaselineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Baseline Price Badge
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(40, candleBaselineY - 11, 110, 22, 5);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 9.5px monospace";
      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.fillText(
        `OPEN: $${roundOpenPriceRef.current.toFixed(selectedAsset === "BTC" ? 1 : 2)}`,
        95,
        candleBaselineY + 4
      );

      // Render Historical Completed Candles
      resolvedCandles.forEach((c, idx) => {
        const candleX = 175 + idx * 80;
        const isGreen = c.winnerCall === "UP";
        const color = isGreen ? "#10B981" : "#EF4444";

        const deltaClose = ((c.closePrice - c.openPrice) / c.openPrice) * 100;
        const candleH = Math.max(10, Math.min(65, Math.abs(deltaClose) * 400));
        const candleY = isGreen ? candleBaselineY - candleH : candleBaselineY;

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(candleX + 14, candleBaselineY - 35);
        ctx.lineTo(candleX + 14, candleBaselineY + 35);
        ctx.stroke();

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(candleX, candleY, 28, candleH, 3);
        ctx.fill();

        // Round Badge
        ctx.font = "bold 8.5px system-ui, sans-serif";
        ctx.fillStyle = "#64748B";
        ctx.textAlign = "center";
        ctx.fillText(`R${c.roundNumber}`, candleX + 14, candleBaselineY + 48);
      });

      // Render Active Live Forming Candle
      const currP = currentPriceRef.current;
      const openP = roundOpenPriceRef.current;
      const deltaPct = openP > 0 ? ((currP - openP) / openP) * 100 : 0;

      if (gameState === "playing") {
        const activeCandleX = 175 + resolvedCandles.length * 80;
        const isGreen = deltaPct >= 0;
        const activeColor = isGreen ? "#10B981" : "#EF4444";
        const dynamicH = Math.max(8, Math.min(80, Math.abs(deltaPct) * 550));
        const candleY = isGreen ? candleBaselineY - dynamicH : candleBaselineY;

        // Live Wick
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(activeCandleX + 18, candleBaselineY - (dynamicH + 14));
        ctx.lineTo(activeCandleX + 18, candleBaselineY + (dynamicH + 14));
        ctx.stroke();

        // Glowing Live Candle Body
        ctx.fillStyle = activeColor;
        ctx.beginPath();
        ctx.roundRect(activeCandleX, candleY, 36, dynamicH, 4);
        ctx.fill();

        // Live Delta Badge
        ctx.fillStyle = activeColor;
        ctx.beginPath();
        ctx.roundRect(activeCandleX - 22, isGreen ? candleY - 22 : candleY + dynamicH + 6, 80, 16, 4);
        ctx.fill();

        ctx.font = "bold 9px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(
          `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(3)}%`,
          activeCandleX + 18,
          isGreen ? candleY - 11 : candleY + dynamicH + 17
        );
      }

      // 4. TUG-OF-WAR ROCKET DRAG ARENA (Lower Half: Y 225 -> 410)
      const arenaTop = 225;
      const lane1Y = 275; // P1 (You) Lane
      const lane2Y = 355; // P2 (Rival) Lane
      const dragCenterX = 380;

      // Arena Separator Line
      ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, arenaTop);
      ctx.lineTo(width - 30, arenaTop);
      ctx.stroke();

      // High-Speed Drag Floor Scrolling Lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1.5;
      speedLinesRef.current.forEach((sl) => {
        sl.x -= sl.speed;
        if (sl.x < 30) sl.x = width - 30;
        ctx.beginPath();
        ctx.moveTo(sl.x, sl.y);
        ctx.lineTo(sl.x + sl.length, sl.y);
        ctx.stroke();
      });

      // Calculate Real-Time Dynamic Thrust Forces
      let f1 = 0.3; // Idle thrust
      let f2 = 0.3;

      if (gameState === "playing" && roundPhase === "RESOLVING") {
        const p1 = p1CallRef.current;
        const p2 = p2CallRef.current;
        const absDelta = Math.abs(deltaPct);

        // P1 Force Evaluation
        if ((p1 === "UP" && deltaPct > 0) || (p1 === "DOWN" && deltaPct < 0)) {
          f1 = Math.min(1.0 + absDelta * 30, 3.2);
        } else {
          f1 = 0.15; // Stalling
        }

        // P2 Force Evaluation
        if ((p2 === "UP" && deltaPct > 0) || (p2 === "DOWN" && deltaPct < 0)) {
          f2 = Math.min(1.0 + absDelta * 30, 3.2);
        } else {
          f2 = 0.15; // Stalling
        }

        // Update audio engine frequency & volume
        soundEngine.updateThrustIntensity(Math.max(f1, f2) / 3.2);

        // Screen micro-shake if volatility bursts
        if (absDelta > 0.04) {
          screenShakeRef.current = Math.min(screenShakeRef.current + 0.3, 2.5);
        }
      }

      // Update UI Telemetry
      setP1ThrustPercent(Math.round(f1 * 100));
      setP2ThrustPercent(Math.round(f2 * 100));
      const netAdv = Number((f1 - f2).toFixed(2));
      setTugOfWarAdvantage(netAdv);

      // Smooth Physics Interpolation for Rocket Positions
      const maxOffset = 130;
      const targetP1X = dragCenterX + Math.max(-maxOffset, Math.min(maxOffset, (f1 - f2) * 55));
      const targetP2X = dragCenterX - Math.max(-maxOffset, Math.min(maxOffset, (f1 - f2) * 45));

      p1PhysicsX.current += (targetP1X - p1PhysicsX.current) * 0.12;
      p2PhysicsX.current += (targetP2X - p2PhysicsX.current) * 0.12;

      const p1X = p1PhysicsX.current;
      const p2X = p2PhysicsX.current;

      // Draw Tug-of-War Laser Tension Beam
      ctx.save();
      const beamGrad = ctx.createLinearGradient(p1X, lane1Y, p2X, lane2Y);
      beamGrad.addColorStop(0, f1 > f2 ? "rgba(110, 78, 244, 0.7)" : "rgba(110, 78, 244, 0.2)");
      beamGrad.addColorStop(1, f2 > f1 ? "rgba(16, 185, 129, 0.7)" : "rgba(16, 185, 129, 0.2)");
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -Date.now() * 0.04;
      ctx.beginPath();
      ctx.moveTo(p1X + 15, lane1Y);
      ctx.lineTo(p2X + 15, lane2Y);
      ctx.stroke();
      ctx.restore();

      // Particle Generator: Thruster sparks & stall smoke
      if (gameState === "playing" && roundPhase === "RESOLVING") {
        // P1 Exhaust
        if (f1 > 0.5) {
          for (let s = 0; s < 2; s++) {
            particlesRef.current.push({
              x: p1X - 32,
              y: lane1Y + (Math.random() - 0.5) * 6,
              vx: -(5 + f1 * 4 + Math.random() * 3),
              vy: (Math.random() - 0.5) * 2,
              life: 0,
              maxLife: 14 + Math.random() * 10,
              color: Math.random() > 0.3 ? "#6E4EF4" : "#38BDF8",
              size: 2.5 + Math.random() * 2,
            });
          }
        } else {
          // Stall smoke
          particlesRef.current.push({
            x: p1X - 25,
            y: lane1Y + (Math.random() - 0.5) * 4,
            vx: -1.5,
            vy: (Math.random() - 0.5) * 1.5,
            life: 0,
            maxLife: 20,
            color: "rgba(148, 163, 184, 0.5)",
            size: 3 + Math.random() * 4,
            isSmoke: true,
          });
        }

        // P2 Exhaust
        if (f2 > 0.5) {
          for (let s = 0; s < 2; s++) {
            particlesRef.current.push({
              x: p2X - 32,
              y: lane2Y + (Math.random() - 0.5) * 6,
              vx: -(5 + f2 * 4 + Math.random() * 3),
              vy: (Math.random() - 0.5) * 2,
              life: 0,
              maxLife: 14 + Math.random() * 10,
              color: Math.random() > 0.3 ? "#10B981" : "#F59E0B",
              size: 2.5 + Math.random() * 2,
            });
          }
        } else {
          // Stall smoke
          particlesRef.current.push({
            x: p2X - 25,
            y: lane2Y + (Math.random() - 0.5) * 4,
            vx: -1.5,
            vy: (Math.random() - 0.5) * 1.5,
            life: 0,
            maxLife: 20,
            color: "rgba(148, 163, 184, 0.5)",
            size: 3 + Math.random() * 4,
            isSmoke: true,
          });
        }
      }

      // Render and update particles
      particlesRef.current.forEach((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life++;

        const alpha = 1 - pt.life / pt.maxLife;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      particlesRef.current = particlesRef.current.filter((pt) => pt.life < pt.maxLife);

      // Helper to draw Apple-grade aerodynamic vector spacecraft
      const drawSpaceship = (
        x: number,
        y: number,
        colorPrimary: string,
        colorSecondary: string,
        thrustVal: number,
        isP1: boolean
      ) => {
        ctx.save();
        ctx.translate(x, y);

        // Dynamic Thruster Flame
        const flameLength = Math.max(8, thrustVal * 28 + Math.sin(Date.now() * 0.05) * 4);
        const flameGrad = ctx.createLinearGradient(-30 - flameLength, 0, -30, 0);
        if (thrustVal > 0.4) {
          flameGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
          flameGrad.addColorStop(0.4, isP1 ? "rgba(110, 78, 244, 0.8)" : "rgba(16, 185, 129, 0.8)");
          flameGrad.addColorStop(0.8, isP1 ? "#38BDF8" : "#FBBF24");
          flameGrad.addColorStop(1, "#FFFFFF");

          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.moveTo(-30, -6);
          ctx.lineTo(-30 - flameLength, 0);
          ctx.lineTo(-30, 6);
          ctx.closePath();
          ctx.fill();
        }

        // Soft ambient drop shadow
        ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;

        // Fuselage Main Body
        const bodyGrad = ctx.createLinearGradient(-30, 0, 30, 0);
        bodyGrad.addColorStop(0, colorSecondary);
        bodyGrad.addColorStop(0.7, colorPrimary);
        bodyGrad.addColorStop(1, "#FFFFFF");

        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.moveTo(32, 0); // Sharp nose cone
        ctx.lineTo(5, -10); // Upper shoulder
        ctx.lineTo(-24, -14); // Upper wing tip
        ctx.lineTo(-22, -6);
        ctx.lineTo(-30, -5); // Tail engine mount
        ctx.lineTo(-30, 5);
        ctx.lineTo(-22, 6);
        ctx.lineTo(-24, 14); // Lower wing tip
        ctx.lineTo(5, 10);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = "transparent";

        // Cockpit Glass Canopy
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.ellipse(6, 0, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wing Accent Stripes
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-12, -10);
        ctx.lineTo(2, -6);
        ctx.moveTo(-12, 10);
        ctx.lineTo(2, 6);
        ctx.stroke();

        ctx.restore();
      };

      // Draw P1 Rocket (Gmonad Alpha)
      drawSpaceship(p1X, lane1Y, "#6E4EF4", "#4F46E5", f1, true);

      // P1 Label Tag
      ctx.fillStyle = "#6E4EF4";
      ctx.beginPath();
      ctx.roundRect(p1X - 45, lane1Y - 26, 90, 16, 4);
      ctx.fill();
      ctx.font = "bold 8.5px system-ui, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText(`YOU • ${p1Call ? (p1Call === "UP" ? "SUBE 🟢" : "BAJA 🔴") : "WAITING"}`, p1X, lane1Y - 14);

      // Draw P2 Rocket (MemeBot AI / Rival)
      drawSpaceship(p2X, lane2Y, "#0F172A", "#1E293B", f2, false);

      // P2 Label Tag
      ctx.fillStyle = "#0F172A";
      ctx.beginPath();
      ctx.roundRect(p2X - 52, lane2Y + 12, 104, 16, 4);
      ctx.fill();
      ctx.font = "bold 8.5px system-ui, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText(
        `${gameMode === "solo" ? "MEMEBOT" : "RIVAL"} • ${
          p2Call ? (p2Call === "UP" ? "SUBE 🟢" : "BAJA 🔴") : "CALCULATING"
        }`,
        p2X,
        lane2Y + 24
      );

      // Tug-of-War Dynamic Center Force Gauge
      const gaugeY = (lane1Y + lane2Y) / 2;
      const gaugeW = 220;
      const gaugeH = 6;
      const gaugeX = width / 2 - gaugeW / 2;

      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.beginPath();
      ctx.roundRect(gaugeX, gaugeY - gaugeH / 2, gaugeW, gaugeH, 3);
      ctx.fill();

      // Gauge Balance Needle
      const needleOffset = Math.max(-gaugeW / 2, Math.min(gaugeW / 2, (f1 - f2) * 40));
      const needleX = width / 2 + needleOffset;

      ctx.fillStyle = f1 >= f2 ? "#6E4EF4" : "#10B981";
      ctx.beginPath();
      ctx.arc(needleX, gaugeY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, currentRound, p1Score, p2Score, resolvedCandles, selectedAsset, gameMode]);

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
            <span>Pyth Hermes Live Stream</span>
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
              <span>Price: ${currentPrice.toFixed(selectedAsset === "BTC" ? 1 : 2)}</span>
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

      {/* 3. Canvas Candlestick + Tug-of-War Drag Arena */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] bg-white">
        <canvas
          ref={canvasRef}
          width={880}
          height={415}
          className="w-full h-auto block touch-none"
        />

        {/* Live Round Phase Pill */}
        {gameState === "playing" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/95 border border-black/[0.08] shadow-sm flex items-center gap-2 text-xs font-bold text-slate-800 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#6E4EF4]" />
            <span>
              {roundPhase === "LOCK_IN"
                ? `LOCK CALL: ${roundTimeLeft}s`
                : `TUG-OF-WAR CLASH: ${roundTimeLeft}s`}
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
              Rocket Clash: Tug-of-War Prediction Duel
            </h2>

            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              4 mini-rounds of 5 seconds each. Lock SUBE or BAJA before the candle forms. Real-time Pyth price movements directly power your rocket engines in an intense physical drag race!
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
                1v1 Versus
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
              Start Tug-of-War Duel (0.25 MON)
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
              {matchWinner === "P1"
                ? "Tug-of-War Champion! 🏆"
                : matchWinner === "P2"
                ? "Rival Won the Clash 🤖"
                : "Dead Heat Tie ⚖️"}
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
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Real-time Telemetry & Tug-of-War Power Gauges */}
      {gameState === "playing" && (
        <div className="w-full mt-3 grid grid-cols-3 gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200/60 flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-[#6E4EF4]" />
            <div>
              <div className="text-[10px] font-semibold text-purple-600 uppercase">Your Engine Power</div>
              <div className="text-xs font-bold text-slate-900 font-mono">
                {p1ThrustPercent}% {p1ThrustPercent > 120 ? "🔥 OVERDRIVE" : p1ThrustPercent < 30 ? "⚠️ STALL" : "ACTIVE"}
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-black/[0.06] flex items-center gap-2.5 text-center justify-center">
            <Activity className="w-4 h-4 text-slate-500" />
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Tug-of-War Advantage</div>
              <div className="text-xs font-bold font-mono">
                {tugOfWarAdvantage > 0 ? (
                  <span className="text-purple-600 font-black">◄ P1 PULLING (+{tugOfWarAdvantage})</span>
                ) : tugOfWarAdvantage < 0 ? (
                  <span className="text-emerald-600 font-black">RIVAL PULLING ({tugOfWarAdvantage}) ►</span>
                ) : (
                  <span className="text-slate-500">BALANCED</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-black/[0.06] flex items-center gap-2.5">
            <Gauge className="w-4 h-4 text-slate-600" />
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Rival Engine Power</div>
              <div className="text-xs font-bold text-slate-900 font-mono">
                {p2ThrustPercent}% {p2ThrustPercent > 120 ? "⚡ BOOST" : p2ThrustPercent < 30 ? "⚠️ STALL" : "ACTIVE"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Active Lock-In Prediction Buttons (Apple Design Touch Controls) */}
      <div className="w-full mt-3 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#6E4EF4]" />
            <span>Round {currentRound} Prediction Call (Hotkeys: [A / ←] SUBE • [D / →] BAJA)</span>
          </div>
          <div className="text-xs font-mono text-slate-500">
            {roundPhase === "LOCK_IN" ? (
              <span className="text-[#6E4EF4] font-bold animate-pulse">LOCKING IN ACTIVE...</span>
            ) : (
              <span className="text-emerald-600 font-bold">LOCKED & POWERING THRUSTERS</span>
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
                  Engines ignite on price pumps
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
                  Engines ignite on price dumps
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
                  <span className="text-slate-400 italic">Reading momentum...</span>
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

      {/* 6. Apple Design System Rules & Economics Cards */}
      <div className="w-full mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Flame className="w-3.5 h-3.5 text-[#6E4EF4]" />
            Física Dinámica de Empuje
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Cada tick del oráculo Pyth alimenta directamente la potencia del propulsor de tu nave en tiempo real.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Tug-of-War Determinista
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Sin físicas falsas ni trampas. Gana quien predice con precisión los movimientos del precio en cada vela de 5s.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Percent className="w-3.5 h-3.5 text-[#6E4EF4]" />
            5.0% Protocol Rake Garantizado
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pozo de 0.50 MON. 0.025 MON fijo a la tesorería de Duelio. 0.475 MON directo al ganador del duelo.
          </p>
        </div>
      </div>
    </div>
  );
}
