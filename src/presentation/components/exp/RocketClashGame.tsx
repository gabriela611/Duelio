"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { soundEngine } from "./gameAudio";
import {
  Flame,
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
  Gauge,
  Sparkles,
  Activity,
} from "lucide-react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { usePriceStream, SupportedAsset } from "@/infrastructure/price-feed/usePriceStream";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

interface RocketState {
  y: number;
  vy: number;
  tilt: number;
  thrusting: boolean;
  score: number;
  multiplier: number;
  inCorridor: boolean;
  name: string;
  avatar: string;
  color: string;
  accentColor: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

interface PriceSample {
  x: number;
  price: number;
  y: number;
}

export function RocketClashGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Asset selection & Price Stream
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("MON");
  const priceState = usePriceStream(selectedAsset);
  const { currentPrice, isLive } = priceState;

  // Game configuration & round state
  const [gameMode, setGameMode] = useState<"solo" | "versus">("solo");
  const [stakeMon, setStakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [winner, setWinner] = useState<"P1" | "P2" | "DRAW" | null>(null);

  // Live Strike price locked at start of round
  const [strikePrice, setStrikePrice] = useState<number>(currentPrice);
  const strikePriceRef = useRef<number>(currentPrice);
  const currentPriceRef = useRef<number>(currentPrice);

  useEffect(() => {
    currentPriceRef.current = currentPrice;
    if (gameState === "idle") {
      setStrikePrice(currentPrice);
      strikePriceRef.current = currentPrice;
    }
  }, [currentPrice, gameState]);

  // Live HUD telemetry
  const [p1Telemetry, setP1Telemetry] = useState({ score: 0, mult: 1.0, inZone: false });
  const [p2Telemetry, setP2Telemetry] = useState({ score: 0, mult: 1.0, inZone: false });

  // Physics & Animation references
  const animFrameId = useRef<number>(0);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const priceHistoryBufferRef = useRef<PriceSample[]>([]);

  // Real-time Pyth Oracle Corridor
  const corridorRef = useRef({
    topY: 160,
    bottomY: 280,
    targetY: 220,
    smoothedY: 220,
  });

  const p1Ref = useRef<RocketState>({
    y: 220,
    vy: 0,
    tilt: 0,
    thrusting: false,
    score: 0,
    multiplier: 1.0,
    inCorridor: true,
    name: "Gmonad Alpha",
    avatar: "🟣",
    color: "#6E4EF4", // Apple-style Monad Deep Purple
    accentColor: "#836EF9",
  });

  const p2Ref = useRef<RocketState>({
    y: 220,
    vy: 0,
    tilt: 0,
    thrusting: false,
    score: 0,
    multiplier: 1.0,
    inCorridor: true,
    name: "MemeBot AI",
    avatar: "🤖",
    color: "#0F172A", // Sleek Cupertino Slate
    accentColor: "#10B981",
  });

  const particlesRef = useRef<Particle[]>([]);

  // Sound toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Keyboard controls with scroll prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
      }

      if (gameState !== "playing") return;

      if (e.code === "KeyW" || e.code === "Space") {
        if (!p1Ref.current.thrusting) {
          p1Ref.current.thrusting = true;
          soundEngine.startThrust(true);
        }
      }
      if (e.code === "ArrowUp") {
        if (gameMode === "versus" && !p2Ref.current.thrusting) {
          p2Ref.current.thrusting = true;
          soundEngine.startThrust(false);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyW" || e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
      }

      if (e.code === "KeyW" || e.code === "Space") {
        p1Ref.current.thrusting = false;
        soundEngine.stopThrust();
      }
      if (e.code === "ArrowUp") {
        p2Ref.current.thrusting = false;
        if (gameMode === "versus") soundEngine.stopThrust();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState, gameMode]);

  // Round management
  const startGame = useCallback(() => {
    setWinner(null);
    setTimeLeft(20);
    setGameState("playing");

    // Lock live strike price at round start
    const lockedPrice = currentPriceRef.current;
    setStrikePrice(lockedPrice);
    strikePriceRef.current = lockedPrice;

    p1Ref.current = {
      ...p1Ref.current,
      y: 220,
      vy: 0,
      tilt: 0,
      thrusting: false,
      score: 0,
      multiplier: 1.0,
      inCorridor: true,
    };

    p2Ref.current = {
      ...p2Ref.current,
      y: 220,
      vy: 0,
      tilt: 0,
      thrusting: false,
      score: 0,
      multiplier: 1.0,
      inCorridor: true,
      name: gameMode === "solo" ? "MemeBot AI" : "Rival Challenger",
      avatar: gameMode === "solo" ? "🤖" : "🐸",
    };

    particlesRef.current = [];
    priceHistoryBufferRef.current = [];

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);

    let seconds = 20;
    roundTimerRef.current = setInterval(() => {
      seconds--;
      setTimeLeft(seconds);
      if (seconds <= 5 && seconds > 0) {
        soundEngine.playCountdownTick(true);
      } else if (seconds > 0) {
        soundEngine.playCountdownTick(false);
      }

      if (seconds <= 0) {
        clearInterval(roundTimerRef.current!);
        soundEngine.stopThrust();
        setGameState("gameover");

        const s1 = Math.floor(p1Ref.current.score * p1Ref.current.multiplier);
        const s2 = Math.floor(p2Ref.current.score * p2Ref.current.multiplier);

        if (s1 === s2) {
          setWinner("DRAW");
        } else if (s1 > s2) {
          setWinner("P1");
          soundEngine.playVictoryJingle();
          try {
            confetti({
              particleCount: 75,
              spread: 65,
              origin: { y: 0.6 },
              colors: ["#6E4EF4", "#10B981", "#F59E0B"],
            });
          } catch (_) {}
        } else {
          setWinner("P2");
          soundEngine.playStallSound();
        }
      }
    }, 1000);
  }, [gameMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      cancelAnimationFrame(animFrameId.current);
      soundEngine.stopThrust();
    };
  }, []);

  // Main Canvas & Game Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const width = canvas.width;
      const height = canvas.height;
      const strikeCenterY = height * 0.5;

      // 1. UPDATE REAL-TIME PYTH ORACLE CORRIDOR
      if (gameState === "playing") {
        const currP = currentPriceRef.current;
        const strikeP = strikePriceRef.current;

        // Calculate REAL-TIME price delta percentage
        const priceDeltaPercent = strikeP > 0 ? ((currP - strikeP) / strikeP) * 100 : 0;

        // Apple Design Dynamic Scaling:
        // Sensitivity calibrated so ±0.15% price delta spans comfortable screen altitude
        const deltaPx = Math.max(-130, Math.min(130, priceDeltaPercent * 450));
        const rawTargetY = strikeCenterY - deltaPx;

        // Smooth spring-damped corridor interpolation
        const corr = corridorRef.current;
        corr.targetY = rawTargetY;
        corr.smoothedY += (rawTargetY - corr.smoothedY) * Math.min(1, 6.0 * dt);

        const corridorHeight = 118;
        corr.topY = Math.max(28, corr.smoothedY - corridorHeight / 2);
        corr.bottomY = Math.min(height - 28, corr.smoothedY + corridorHeight / 2);

        // Record real price point for scrolling line visualization
        const buffer = priceHistoryBufferRef.current;
        buffer.push({
          x: width,
          price: currP,
          y: corr.smoothedY,
        });

        // Scroll price samples leftward
        for (let i = buffer.length - 1; i >= 0; i--) {
          buffer[i].x -= 2.2;
          if (buffer[i].x < -20) {
            buffer.splice(i, 1);
          }
        }

        // 2. INTELLIGENT MEMEBOT AI BEHAVIOR
        if (gameMode === "solo") {
          const p2 = p2Ref.current;
          // AI tracks the smoothed corridor center with calibrated human reaction jitter
          const targetY = corr.smoothedY + Math.sin(time * 0.0025) * 8;
          const dist = p2.y - targetY;

          if (dist > 7 && p2.vy > -1.2) {
            p2.thrusting = true;
          } else if (dist < -7 && p2.vy < 0.9) {
            p2.thrusting = false;
          }
        }

        // 3. ROCKET PHYSICS & SCORING
        [p1Ref.current, p2Ref.current].forEach((r, idx) => {
          const gravity = 0.38;
          const thrust = -0.84;

          if (r.thrusting) {
            r.vy += thrust;
            // Spawn subtle flame particles
            const rocketX = idx === 0 ? width * 0.28 : width * 0.44;
            particlesRef.current.push({
              x: rocketX - 16,
              y: r.y + (Math.random() - 0.5) * 4,
              vx: -(Math.random() * 20 + 10),
              vy: (Math.random() - 0.5) * 8,
              size: Math.random() * 3 + 1.5,
              alpha: 0.85,
              color: idx === 0 ? "#6E4EF4" : "#10B981",
            });
          }

          r.vy += gravity;
          r.vy *= 0.965; // Atmospheric drag
          r.y += r.vy;

          // Aerodynamic tilt
          r.tilt = Math.max(-22, Math.min(28, r.vy * 3.4));

          // Apple-style soft bounce on ceiling / floor boundaries
          if (r.y < 26) {
            r.y = 26;
            r.vy = 1.0;
            soundEngine.playLiquidationWarning();
          }
          if (r.y > height - 32) {
            r.y = height - 32;
            r.vy = -1.0;
            soundEngine.playLiquidationWarning();
          }

          // In-Corridor Scoring & Multiplier
          if (r.y >= corr.topY && r.y <= corr.bottomY) {
            r.inCorridor = true;
            r.score += 2.2;
            r.multiplier = Math.min(5.0, r.multiplier + 0.006);
            if (Math.random() < 0.08) soundEngine.playScorePing();
          } else {
            r.inCorridor = false;
            r.multiplier = Math.max(1.0, r.multiplier - 0.008);
          }
        });

        // Update particle physics
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.alpha -= 2.2 * dt;
          p.size = Math.max(0.2, p.size - 2 * dt);

          if (p.alpha <= 0) {
            particlesRef.current.splice(i, 1);
          }
        }

        // Sync React HUD telemetry
        setP1Telemetry({
          score: Math.floor(p1Ref.current.score),
          mult: Number(p1Ref.current.multiplier.toFixed(2)),
          inZone: p1Ref.current.inCorridor,
        });
        setP2Telemetry({
          score: Math.floor(p2Ref.current.score),
          mult: Number(p2Ref.current.multiplier.toFixed(2)),
          inZone: p2Ref.current.inCorridor,
        });
      }

      // 4. APPLE DESIGN CANVAS RENDERING
      ctx.clearRect(0, 0, width, height);

      // Clean Apple Light Mode Surface
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#FFFFFF");
      bgGrad.addColorStop(1, "#F8F8F7");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle Cupertino Grid Lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.04)";
      ctx.lineWidth = 1;
      for (let y = 30; y < height; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Strike Price Center Baseline
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, strikeCenterY);
      ctx.lineTo(width, strikeCenterY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Strike Price Tag Badge on Left
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(14, strikeCenterY - 10, 110, 20, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#64748B";
      ctx.textAlign = "center";
      ctx.fillText(`STRIKE: $${strikePriceRef.current.toFixed(selectedAsset === "BTC" ? 1 : 2)}`, 69, strikeCenterY + 3.5);

      // Render Dynamic Pyth Green Prediction Corridor
      const corr = corridorRef.current;
      const corridorHeight = corr.bottomY - corr.topY;

      // Soft emerald corridor fill
      const corridorGrad = ctx.createLinearGradient(0, corr.topY, 0, corr.bottomY);
      corridorGrad.addColorStop(0, "rgba(16, 185, 129, 0.04)");
      corridorGrad.addColorStop(0.5, "rgba(16, 185, 129, 0.12)");
      corridorGrad.addColorStop(1, "rgba(16, 185, 129, 0.04)");

      ctx.fillStyle = corridorGrad;
      ctx.fillRect(0, corr.topY, width, corridorHeight);

      // Corridor Top & Bottom Boundaries (Apple frosted hairline)
      ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 4]);

      ctx.beginPath();
      ctx.moveTo(0, corr.topY);
      ctx.lineTo(width, corr.topY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, corr.bottomY);
      ctx.lineTo(width, corr.bottomY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Real-time Pyth Price Path Curve (Historical samples ribbon)
      const samples = priceHistoryBufferRef.current;
      if (samples.length > 2) {
        ctx.strokeStyle = "rgba(16, 185, 129, 0.65)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(samples[0].x, samples[0].y);
        for (let i = 1; i < samples.length; i++) {
          ctx.lineTo(samples[i].x, samples[i].y);
        }
        ctx.stroke();
      }

      // Live Pyth Price Indicator Pin on Corridor
      ctx.fillStyle = "#10B981";
      ctx.beginPath();
      ctx.arc(width - 24, corr.smoothedY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Live Corridor Header Label
      ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#059669";
      ctx.textAlign = "start";
      ctx.fillText(`⚡ PYTH LIVE PREDICTION CHANNEL • SURF TO CHARGE 5X`, 140, corr.topY + 16);

      // Render Exhaust Particles
      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Render Rockets (Apple Clean Vector Style)
      const renderAppleRocket = (r: RocketState, x: number) => {
        ctx.save();
        ctx.translate(x, r.y);
        ctx.rotate((r.tilt * Math.PI) / 180);

        // Ambient Soft Shadow under rocket
        ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
        ctx.beginPath();
        ctx.ellipse(0, 18, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Locked-in Aura Glow when inside corridor
        if (r.inCorridor) {
          ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(0, 0, 26, 16, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Rocket Main Fuselage
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Rocket Nosecone (Crisp White with subtle hairline)
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(14, -7);
        ctx.lineTo(24, 0);
        ctx.lineTo(14, 7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.stroke();

        // Cockpit Window & Avatar
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(2, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
        ctx.stroke();

        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(r.avatar, 2, 4);

        // Rocket Fins
        ctx.fillStyle = r.accentColor;
        ctx.beginPath();
        ctx.moveTo(-14, -8);
        ctx.lineTo(-22, -14);
        ctx.lineTo(-15, -2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-14, 8);
        ctx.lineTo(-22, 14);
        ctx.lineTo(-15, 2);
        ctx.closePath();
        ctx.fill();

        // Multiplier Pill Badge above rocket
        ctx.fillStyle = r.inCorridor ? "#10B981" : "#F59E0B";
        ctx.beginPath();
        ctx.roundRect(-24, -28, 48, 16, 8);
        ctx.fill();

        ctx.font = "bold 9px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`${r.multiplier.toFixed(1)}x`, 0, -17);

        ctx.restore();
      };

      renderAppleRocket(p1Ref.current, width * 0.28);
      renderAppleRocket(p2Ref.current, width * 0.44);

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, gameMode, selectedAsset]);

  // Touch & Pointer handlers for P1
  const handleP1PointerDown = () => {
    if (gameState !== "playing") return;
    p1Ref.current.thrusting = true;
    soundEngine.startThrust(true);
  };

  const handleP1PointerUp = () => {
    p1Ref.current.thrusting = false;
    soundEngine.stopThrust();
  };

  // Touch & Pointer handlers for P2
  const handleP2PointerDown = () => {
    if (gameState !== "playing" || gameMode !== "versus") return;
    p2Ref.current.thrusting = true;
    soundEngine.startThrust(false);
  };

  const handleP2PointerUp = () => {
    if (gameMode !== "versus") return;
    p2Ref.current.thrusting = false;
    soundEngine.stopThrust();
  };

  const totalPot = (stakeMon * 2).toFixed(2);
  const netPayout = (stakeMon * 2 * 0.95).toFixed(4);

  // Price delta helper
  const priceDelta = strikePrice > 0 ? currentPrice - strikePrice : 0;
  const priceDeltaPercent = strikePrice > 0 ? (priceDelta / strikePrice) * 100 : 0;

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
            <span>Pyth Live Feed</span>
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                Strike: ${strikePrice.toFixed(selectedAsset === "BTC" ? 1 : 2)}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Now: ${currentPrice.toFixed(selectedAsset === "BTC" ? 1 : 2)}</span>
              <span
                className={`font-mono font-bold flex items-center gap-0.5 ${
                  priceDeltaPercent >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {priceDeltaPercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {priceDeltaPercent >= 0 ? "+" : ""}
                {priceDeltaPercent.toFixed(3)}%
              </span>
            </div>
          </div>
        </div>

        {/* Live Oracle Wave Status */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-50 border border-black/[0.04]">
          <Activity className="w-4 h-4 text-emerald-600" />
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Oracle Trajectory</div>
            <div className="text-xs font-bold text-slate-800 font-mono">Real-Time Pyth Tracking</div>
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

      {/* 3. Live HUD Multipliers (Apple Clean Design) */}
      <div className="w-full grid grid-cols-2 gap-3 mb-3">
        {/* P1 Player HUD */}
        <div
          className={`p-3.5 rounded-2xl bg-white border transition-all ${
            p1Telemetry.inZone
              ? "border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm"
              : "border-black/[0.06]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🟣</span>
              <div>
                <div className="text-xs font-bold text-slate-900">Gmonad Alpha (You)</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {p1Telemetry.inZone ? "LOCKED IN CORRIDOR ⚡" : "OUTSIDE CHANNEL"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-xl font-black font-mono tracking-tight ${
                  p1Telemetry.inZone ? "text-emerald-600" : "text-slate-700"
                }`}
              >
                {p1Telemetry.mult}x
              </div>
              <div className="text-[10px] font-mono text-slate-400">Score: {p1Telemetry.score}</div>
            </div>
          </div>
        </div>

        {/* P2 Rival HUD */}
        <div
          className={`p-3.5 rounded-2xl bg-white border transition-all ${
            p2Telemetry.inZone
              ? "border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm"
              : "border-black/[0.06]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{gameMode === "solo" ? "🤖" : "🐸"}</span>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {gameMode === "solo" ? "MemeBot AI" : "Rival Challenger"}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {p2Telemetry.inZone ? "LOCKED IN CORRIDOR ⚡" : "OUTSIDE CHANNEL"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-xl font-black font-mono tracking-tight ${
                  p2Telemetry.inZone ? "text-emerald-600" : "text-slate-700"
                }`}
              >
                {p2Telemetry.mult}x
              </div>
              <div className="text-[10px] font-mono text-slate-400">Score: {p2Telemetry.score}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Canvas Arena */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] bg-white">
        <canvas
          ref={canvasRef}
          width={880}
          height={480}
          className="w-full h-auto block touch-none"
        />

        {/* Live Timer Pill */}
        {gameState === "playing" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/95 border border-black/[0.08] shadow-sm flex items-center gap-2 text-xs font-bold text-slate-800 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Time Left: {timeLeft}s</span>
          </div>
        )}

        {/* Pre-Round Launch Overlay */}
        {gameState === "idle" && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#6E4EF4]/10 text-[#6E4EF4] flex items-center justify-center mb-3">
              <Flame className="w-7 h-7" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1.5">
              Rocket Clash: Surf the Pyth Channel
            </h2>

            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              Pilot your rocket inside the real-time Pyth price corridor. Charge up to 5x multipliers by holding the line!
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
                Solo vs AI
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
                1v1 Split
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
              onClick={startGame}
              className="px-8 py-3 rounded-2xl bg-[#6E4EF4] text-white font-semibold text-sm hover:bg-[#5b3ce0] active:scale-95 transition-all shadow-md shadow-purple-600/20"
            >
              Start Duel (0.25 MON)
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
              {winner === "P1" ? "Victory! You Held the Line 🏆" : winner === "P2" ? "Rival Won the Clash 🤖" : "Dead Heat Tie ⚖️"}
            </h3>

            <p className="text-xs text-slate-500 mb-5 font-mono">
              Net Payout: <span className="text-[#6E4EF4] font-bold">{netPayout} MON</span> • 5.0% Protocol Rake
            </p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-6">
              <div className="p-3 rounded-xl bg-slate-50 border border-black/[0.06] text-center">
                <div className="text-[10px] text-slate-400 font-mono">P1 SCORE (x{p1Ref.current.multiplier.toFixed(1)})</div>
                <div className="text-lg font-bold text-slate-900 font-mono">
                  {Math.floor(p1Ref.current.score * p1Ref.current.multiplier)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-black/[0.06] text-center">
                <div className="text-[10px] text-slate-400 font-mono">P2 SCORE (x{p2Ref.current.multiplier.toFixed(1)})</div>
                <div className="text-lg font-bold text-slate-900 font-mono">
                  {Math.floor(p2Ref.current.score * p2Ref.current.multiplier)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={startGame}
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

      {/* 5. Direct Tactile Controls (Apple Native Style) */}
      <div className="w-full mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* P1 Controls Button */}
        <button
          onPointerDown={handleP1PointerDown}
          onPointerUp={handleP1PointerUp}
          onPointerLeave={handleP1PointerUp}
          onPointerCancel={handleP1PointerUp}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-black/[0.08] hover:border-[#6E4EF4] active:scale-[0.98] transition-all flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.035)] cursor-pointer touch-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#6E4EF4]/10 text-xl flex items-center justify-center">
              🟣
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-900">P1 • Hold to Fire Thrusters</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">HOLD [SPACE] / [W] OR TAP</div>
            </div>
          </div>
          <Flame className="w-6 h-6 text-[#6E4EF4] group-active:scale-125 transition-transform" />
        </button>

        {/* P2 Controls Button */}
        {gameMode === "versus" ? (
          <button
            onPointerDown={handleP2PointerDown}
            onPointerUp={handleP2PointerUp}
            onPointerLeave={handleP2PointerUp}
            onPointerCancel={handleP2PointerUp}
            className="p-4 sm:p-5 rounded-2xl bg-white border border-black/[0.08] hover:border-emerald-500 active:scale-[0.98] transition-all flex items-center justify-between shadow-sm cursor-pointer touch-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-xl flex items-center justify-center">
                🐸
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">P2 • Hold to Fire Thrusters</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">HOLD [ARROW UP]</div>
              </div>
            </div>
            <Flame className="w-6 h-6 text-emerald-600 group-active:scale-125 transition-transform" />
          </button>
        ) : (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-black/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-200 flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">MemeBot AI Rival</div>
                <div className="text-xs text-slate-500 font-mono">Auto-tracking Pyth target channel</div>
              </div>
            </div>
            <div className="text-[10px] font-mono px-2 py-1 rounded bg-slate-200 text-slate-700 font-semibold">
              BOT ACTIVE
            </div>
          </div>
        )}
      </div>

      {/* 6. Apple Design Economics & Mechanics Cards */}
      <div className="w-full mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-[#6E4EF4]" />
            Real Pyth Oracle Dynamic
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            The target corridor directly maps to real-time Pyth price movements. When the market rallies, the channel climbs; when it dumps, it descends.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Gauge className="w-3.5 h-3.5 text-emerald-600" />
            Precision Multiplier (1x to 5x)
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Piloting inside the channel builds your score multiplier up to 5x. Staying outside causes the multiplier to cool down.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Percent className="w-3.5 h-3.5 text-[#6E4EF4]" />
            5.0% Protocol Rake
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            0.50 MON total pot. 0.025 MON goes to the Duelio Treasury on every match. Zero insolvency risk for the house.
          </p>
        </div>
      </div>
    </div>
  );
}
