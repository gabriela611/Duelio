"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  TrendingUp,
  TrendingDown,
  Radio,
  Clock,
  Coins,
} from "lucide-react";
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
  liquidated: boolean;
  name: string;
  avatar: string;
  color: string;
  flameColor: string;
  prediction: "BULL" | "BEAR";
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

interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
}

interface FloatingMeme {
  text: string;
  x: number;
  y: number;
  speed: number;
  color: string;
}

type MatchDuration = 15 | 30 | 60;

export function RocketClashGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Asset selection & Price Stream
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("MON");
  const priceState = usePriceStream(selectedAsset);
  const { currentPrice, changePercent, history, isLive, source } = priceState;

  // Game configuration & round state
  const [gameMode, setGameMode] = useState<"solo" | "versus">("solo");
  const [selectedDuration, setSelectedDuration] = useState<MatchDuration>(30);
  const [p1Prediction, setP1Prediction] = useState<"BULL" | "BEAR">("BULL");
  const [stakeMon, setStakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [winner, setWinner] = useState<"P1" | "P2" | "DRAW" | null>(null);

  // Strike price locked at start of round
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

  // Corridor physics reference
  const corridorRef = useRef({
    topY: 140,
    bottomY: 260,
    targetY: 200,
    currentCenterY: 200,
    phase: 0,
    speed: 0.025,
  });

  const p1Ref = useRef<RocketState>({
    y: 200,
    vy: 0,
    tilt: 0,
    thrusting: false,
    score: 0,
    multiplier: 1.0,
    inCorridor: true,
    liquidated: false,
    name: "Gmonad Alpha",
    avatar: "🟣",
    color: "#836EF9",
    flameColor: "#FF6B00",
    prediction: "BULL",
  });

  const p2Ref = useRef<RocketState>({
    y: 200,
    vy: 0,
    tilt: 0,
    thrusting: false,
    score: 0,
    multiplier: 1.0,
    inCorridor: true,
    liquidated: false,
    name: "Pepe Rocket",
    avatar: "🐸",
    color: "#10B981",
    flameColor: "#059669",
    prediction: "BEAR",
  });

  const particlesRef = useRef<Particle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const memesRef = useRef<FloatingMeme[]>([
    { text: "⚡ MONAD 10k TPS", x: 750, y: 70, speed: 0.9, color: "#6E4EF4" },
    { text: "PYTH ORACLE TICK", x: 1000, y: 110, speed: 1.1, color: "#059669" },
    { text: "SUB-SECOND FINALITY", x: 1280, y: 60, speed: 0.85, color: "#D97706" },
    { text: "WAGMI MON", x: 1550, y: 130, speed: 1.0, color: "#2563EB" },
  ]);

  // Audio toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Generate gentle ambient clouds for daylight Apple sky
  useEffect(() => {
    const clouds: Cloud[] = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: (i * 150) + Math.random() * 40,
        y: 40 + Math.random() * 180,
        width: 90 + Math.random() * 60,
        height: 28 + Math.random() * 16,
        speed: 0.25 + Math.random() * 0.35,
        opacity: 0.45 + Math.random() * 0.35,
      });
    }
    cloudsRef.current = clouds;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      if (e.code === "KeyW" || e.code === "Space") {
        p1Ref.current.thrusting = false;
        soundEngine.stopThrust();
      }
      if (e.code === "ArrowUp") {
        p2Ref.current.thrusting = false;
        if (gameMode === "versus") soundEngine.stopThrust();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState, gameMode]);

  // Start round
  const startGame = useCallback(() => {
    setWinner(null);
    setTimeLeft(selectedDuration);
    setGameState("playing");

    // Freeze strike price at the exact moment round begins
    const lockedPrice = currentPriceRef.current;
    setStrikePrice(lockedPrice);
    strikePriceRef.current = lockedPrice;

    p1Ref.current = {
      ...p1Ref.current,
      y: 200,
      vy: 0,
      tilt: 0,
      thrusting: false,
      score: 0,
      multiplier: 1.0,
      liquidated: false,
      prediction: p1Prediction,
    };

    p2Ref.current = {
      ...p2Ref.current,
      y: 200,
      vy: 0,
      tilt: 0,
      thrusting: false,
      score: 0,
      multiplier: 1.0,
      liquidated: false,
      prediction: p1Prediction === "BULL" ? "BEAR" : "BULL",
    };

    particlesRef.current = [];

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);

    let seconds = selectedDuration;
    roundTimerRef.current = setInterval(() => {
      seconds--;
      setTimeLeft(seconds);

      if (seconds <= 0) {
        clearInterval(roundTimerRef.current!);
        setGameState("gameover");
        soundEngine.stopThrust();
        soundEngine.playVictoryJingle();

        // Check price direction outcome
        const finalPrice = currentPriceRef.current;
        const initial = strikePriceRef.current;
        const isBullOutcome = finalPrice >= initial;

        // Apply prediction bonus (1.5x) if matched
        let s1 = p1Ref.current.score * p1Ref.current.multiplier;
        if ((p1Ref.current.prediction === "BULL" && isBullOutcome) || (p1Ref.current.prediction === "BEAR" && !isBullOutcome)) {
          s1 *= 1.5;
        }

        let s2 = p2Ref.current.score * p2Ref.current.multiplier;
        if ((p2Ref.current.prediction === "BULL" && isBullOutcome) || (p2Ref.current.prediction === "BEAR" && !isBullOutcome)) {
          s2 *= 1.5;
        }

        if (s1 > s2) setWinner("P1");
        else if (s2 > s1) setWinner("P2");
        else setWinner("DRAW");
      }
    }, 1000);
  }, [selectedDuration, p1Prediction]);

  // Main 60fps Canvas Loop (Apple Light Mode)
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

      // 1. UPDATE PHYSICS & LOGIC
      if (gameState === "playing") {
        // Correlate corridor altitude with real-time price delta!
        const currP = currentPriceRef.current;
        const strikeP = strikePriceRef.current;
        const priceDeltaPercent = strikeP > 0 ? ((currP - strikeP) / strikeP) * 100 : 0;

        // Upward price moves corridor UP (-y in canvas), downward price moves corridor DOWN (+y)
        const priceVerticalOffset = Math.max(-90, Math.min(90, priceDeltaPercent * 110));

        const corr = corridorRef.current;
        corr.phase += corr.speed;
        const baselineCenter = height * 0.5 - priceVerticalOffset;
        const targetCenter = baselineCenter + Math.sin(corr.phase) * 18;

        // Smooth critically damped approach to target
        corr.currentCenterY += (targetCenter - corr.currentCenterY) * 0.08;

        const corridorHeight = 115;
        corr.topY = corr.currentCenterY - corridorHeight / 2;
        corr.bottomY = corr.currentCenterY + corridorHeight / 2;

        // Bot AI behavior in Solo mode
        if (gameMode === "solo") {
          const p2 = p2Ref.current;
          const desiredY = corr.currentCenterY + Math.sin(time * 0.0025) * 12;
          const distance = p2.y - desiredY;
          if (distance > 6 && p2.vy > -1.2) {
            p2.thrusting = true;
          } else if (distance < -6 && p2.vy < 1.0) {
            p2.thrusting = false;
          }
        }

        // Update Rockets
        [p1Ref.current, p2Ref.current].forEach((r, idx) => {
          if (r.liquidated) return;

          const gravity = 0.36;
          const thrust = -0.78;

          if (r.thrusting) {
            r.vy += thrust;
            // Spawn clean exhaust puffs
            for (let i = 0; i < 2; i++) {
              particlesRef.current.push({
                x: idx === 0 ? width * 0.28 : width * 0.44,
                y: r.y + 14,
                vx: (Math.random() - 0.5) * 1.5 - 2,
                vy: Math.random() * 2 + 0.8,
                size: Math.random() * 4 + 2.5,
                alpha: 0.8,
                color: r.flameColor,
              });
            }
          }

          r.vy += gravity;
          r.vy *= 0.965; // Air drag
          r.y += r.vy;

          // Realistic aerodynamic tilt
          r.tilt = Math.max(-22, Math.min(26, r.vy * 3.0));

          // Boundaries
          if (r.y < 28) {
            r.y = 28;
            r.vy = 1;
            soundEngine.playLiquidationWarning();
          }
          if (r.y > height - 32) {
            r.y = height - 32;
            r.vy = -1;
            soundEngine.playLiquidationWarning();
          }

          // In-Corridor scoring
          if (r.y >= corr.topY && r.y <= corr.bottomY) {
            r.inCorridor = true;
            r.score += 1.6;
            r.multiplier = Math.min(5.0, r.multiplier + 0.005);
            if (Math.random() < 0.07) soundEngine.playScorePing();
          } else {
            r.inCorridor = false;
            r.multiplier = Math.max(1.0, r.multiplier - 0.007);
          }
        });

        // Update exhaust particles
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.028;
          p.size = Math.max(0, p.size - 0.08);
        });
        particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);

        // Update meme banners
        memesRef.current.forEach((m) => {
          m.x -= m.speed;
          if (m.x < -200) m.x = width + 60;
        });

        // Update HUD telemetry
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

      // Update ambient clouds
      cloudsRef.current.forEach((c) => {
        c.x -= c.speed;
        if (c.x < -c.width) c.x = width + 40;
      });

      // 2. RENDER SCENE (Apple Daylight Palette)

      // Soft Daylight Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#F4F6F9");
      skyGrad.addColorStop(0.65, "#EDF2F7");
      skyGrad.addColorStop(1, "#E2E8F0");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle Minimalist Dot Grid
      ctx.fillStyle = "rgba(0, 0, 0, 0.035)";
      for (let x = 20; x < width; x += 40) {
        for (let y = 20; y < height; y += 40) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Floating Cartoon Clouds
      cloudsRef.current.forEach((c) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
        ctx.beginPath();
        // Pill cloud shape
        const r = c.height / 2;
        ctx.arc(c.x + r, c.y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
        ctx.arc(c.x + c.width - r, c.y + r, r, (Math.PI * 3) / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `rgba(0, 0, 0, 0.03)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Monad Purple Daylight Sun / Hot Air Balloon
      const balloonX = width - 90;
      const balloonY = 70;
      ctx.fillStyle = "#836EF9";
      ctx.beginPath();
      ctx.arc(balloonX, balloonY, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "16px sans-serif";
      ctx.fillText("🟣", balloonX - 8, balloonY + 6);
      ctx.font = "600 8px system-ui, sans-serif";
      ctx.fillStyle = "#6E4EF4";
      ctx.fillText("MONAD LABS", balloonX - 22, balloonY + 38);

      // Distant Minimalist Skyline Candlesticks (Apple-restrained financial silhouette)
      const candles = [60, 95, 75, 120, 85, 105, 135];
      candles.forEach((ch, i) => {
        const cx = 90 + i * 105;
        const cy = height - ch;
        // Subtle wick
        ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + 10, cy - 12);
        ctx.lineTo(cx + 10, height);
        ctx.stroke();

        // Soft clean body
        ctx.fillStyle = i % 2 === 0 ? "rgba(20, 207, 28, 0.1)" : "rgba(255, 59, 48, 0.08)";
        ctx.strokeStyle = i % 2 === 0 ? "rgba(20, 207, 28, 0.3)" : "rgba(255, 59, 48, 0.25)";
        ctx.lineWidth = 1;
        ctx.fillRect(cx, cy, 20, ch);
        ctx.strokeRect(cx, cy, 20, ch);
      });

      // Floating Crypto Meme Stream
      memesRef.current.forEach((m) => {
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.fillStyle = m.color;
        ctx.fillText(m.text, m.x, m.y);
      });

      // Strike Price Reference Horizon (Dotted line)
      const strikeCenterY = height * 0.5;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.14)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, strikeCenterY);
      ctx.lineTo(width, strikeCenterY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "500 9px system-ui, sans-serif";
      ctx.fillStyle = "#858585";
      ctx.fillText(`STRIKE BASELINE: $${strikePriceRef.current.toFixed(selectedAsset === "BTC" ? 1 : 2)}`, 16, strikeCenterY - 6);

      // Render Dynamic Price Corridor (Apple clean green ribbon)
      const corr = corridorRef.current;
      const currP = currentPriceRef.current;
      const strikeP = strikePriceRef.current;
      const isAboveStrike = currP >= strikeP;

      const corridorGrad = ctx.createLinearGradient(0, corr.topY, 0, corr.bottomY);
      if (isAboveStrike) {
        corridorGrad.addColorStop(0, "rgba(20, 207, 28, 0.02)");
        corridorGrad.addColorStop(0.5, "rgba(20, 207, 28, 0.12)");
        corridorGrad.addColorStop(1, "rgba(20, 207, 28, 0.02)");
      } else {
        corridorGrad.addColorStop(0, "rgba(255, 59, 48, 0.02)");
        corridorGrad.addColorStop(0.5, "rgba(255, 59, 48, 0.10)");
        corridorGrad.addColorStop(1, "rgba(255, 59, 48, 0.02)");
      }

      ctx.fillStyle = corridorGrad;
      ctx.fillRect(0, corr.topY, width, corr.bottomY - corr.topY);

      // Corridor Borders
      ctx.strokeStyle = isAboveStrike ? "rgba(20, 207, 28, 0.75)" : "rgba(255, 59, 48, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);

      ctx.beginPath();
      ctx.moveTo(0, corr.topY);
      ctx.lineTo(width, corr.topY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, corr.bottomY);
      ctx.lineTo(width, corr.bottomY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Corridor Label
      ctx.font = "600 10px system-ui, sans-serif";
      ctx.fillStyle = isAboveStrike ? "#059669" : "#DC2626";
      const deltaPercent = strikeP > 0 ? (((currP - strikeP) / strikeP) * 100).toFixed(2) : "0.00";
      ctx.fillText(
        `⚡ ${selectedAsset} TARGET CORRIDOR (${Number(deltaPercent) >= 0 ? `+${deltaPercent}%` : `${deltaPercent}%`}) ⚡`,
        width * 0.28,
        corr.topY + 16
      );

      // Render Exhaust Particles
      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Render Rockets (Apple Clean Vectors)
      const renderRocket = (r: RocketState, x: number) => {
        ctx.save();
        ctx.translate(x, r.y);
        ctx.rotate((r.tilt * Math.PI) / 180);

        // Thruster flame if firing
        if (r.thrusting) {
          // Warm cartoon outer flame
          ctx.fillStyle = r.flameColor;
          ctx.beginPath();
          ctx.moveTo(-16, -4);
          ctx.lineTo(-30 - Math.random() * 8, 0);
          ctx.lineTo(-16, 4);
          ctx.closePath();
          ctx.fill();

          // White hot core
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(-16, -2);
          ctx.lineTo(-24, 0);
          ctx.lineTo(-16, 2);
          ctx.closePath();
          ctx.fill();
        }

        // In-zone highlight aura
        if (r.inCorridor) {
          ctx.strokeStyle = "rgba(20, 207, 28, 0.4)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, 0, 23, 14, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Rocket Body
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Rocket Nosecone
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(14, -8);
        ctx.lineTo(24, 0);
        ctx.lineTo(14, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Rocket Tail Fin
        ctx.fillStyle = r.color === "#836EF9" ? "#5B44E0" : "#059669";
        ctx.beginPath();
        ctx.moveTo(-12, -10);
        ctx.lineTo(-18, -14);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-12, 10);
        ctx.lineTo(-18, 14);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();

        // Cockpit Bubble & Avatar
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        ctx.beginPath();
        ctx.arc(2, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.stroke();

        ctx.font = "11px sans-serif";
        ctx.fillText(r.avatar, -3.5, 4);

        // Player Tag & Multiplier Badge
        ctx.font = "600 9px system-ui, sans-serif";
        ctx.fillStyle = r.inCorridor ? "#059669" : "#1E293B";
        ctx.fillText(`${r.name} (${r.multiplier.toFixed(1)}x)`, -24, -18);

        ctx.restore();
      };

      renderRocket(p1Ref.current, width * 0.28);
      renderRocket(p2Ref.current, width * 0.44);

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, gameMode, selectedAsset]);

  // Touch & Pointer handlers for zero latency direct manipulation
  const handleP1PointerDown = (e: React.PointerEvent) => {
    if (gameState !== "playing") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    p1Ref.current.thrusting = true;
    soundEngine.startThrust(true);
  };

  const handleP1PointerUp = () => {
    p1Ref.current.thrusting = false;
    soundEngine.stopThrust();
  };

  const handleP2PointerDown = (e: React.PointerEvent) => {
    if (gameState !== "playing" || gameMode !== "versus") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    p2Ref.current.thrusting = true;
    soundEngine.startThrust(false);
  };

  const handleP2PointerUp = () => {
    p2Ref.current.thrusting = false;
    if (gameMode === "versus") soundEngine.stopThrust();
  };

  const totalPot = (stakeMon * 2 * Math.max(p1Telemetry.mult, p2Telemetry.mult)).toFixed(3);
  const roundProgressPercent = Math.max(0, Math.min(100, ((selectedDuration - timeLeft) / selectedDuration) * 100));

  // Calculate live delta between current price and strike
  const livePriceDelta = strikePrice > 0 ? ((currentPrice - strikePrice) / strikePrice) * 100 : 0;
  const isDeltaPositive = livePriceDelta >= 0;

  // Render SVG mini price sparkline with Strike line
  const sparklineSVG = useMemo(() => {
    if (!history || history.length === 0) return null;
    const prices = history.map((p) => p.price);
    const minP = Math.min(...prices, strikePrice, currentPrice);
    const maxP = Math.max(...prices, strikePrice, currentPrice);
    const range = maxP - minP || 1;
    const w = 480;
    const h = 80;
    const padY = 8;
    const usableH = h - padY * 2;

    const points = history.map((p, i) => {
      const x = (i / Math.max(history.length - 1, 1)) * w;
      const y = padY + usableH - ((p.price - minP) / range) * usableH;
      return { x, y };
    });

    let pathD = "";
    if (points.length > 0) {
      pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
    }

    const strikeY = padY + usableH - ((strikePrice - minP) / range) * usableH;
    const lastP = points[points.length - 1] || { x: w, y: h / 2 };
    const strokeColor = isDeltaPositive ? "#14CF1C" : "#FF3B30";

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16 overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="priceSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.16" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Strike price reference horizontal line */}
        <line
          x1="0"
          y1={strikeY}
          x2={w}
          y2={strikeY}
          stroke="#858585"
          strokeDasharray="4 4"
          strokeWidth="1.2"
          opacity="0.5"
        />

        {/* Area fill */}
        <path d={`${pathD} L ${w} ${h} L 0 ${h} Z`} fill="url(#priceSparkGrad)" />

        {/* Price path */}
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Current price endpoint */}
        <circle cx={lastP.x} cy={lastP.y} r="3.5" fill={strokeColor} className="animate-pulse" />
        <circle cx={lastP.x} cy={lastP.y} r="7" fill={strokeColor} fillOpacity="0.2" />
      </svg>
    );
  }, [history, strikePrice, currentPrice, isDeltaPositive]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center select-none text-[#0B0B0B]">
      {/* 1. Apple Top Navigation & Controls Bar */}
      <header className="w-full flex items-center justify-between px-4 py-3 bg-white border border-black/[0.06] rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.035)] mb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Arena
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#14CF1C] animate-pulse" />
            <h1 className="text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#836EF9]" />
              Rocket Clash <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#836EF9]/10 text-[#6E4EF4] font-mono font-medium">EXP</span>
            </h1>
          </div>
        </div>

        {/* Stake Selector & Audio Toggle */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <span className="text-slate-500 text-[10px] px-1.5 font-medium">STAKE:</span>
            {[0.1, 0.25, 0.5, 1.0].map((amt) => (
              <button
                key={amt}
                onClick={() => setStakeMon(amt)}
                disabled={gameState === "playing"}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                  stakeMon === amt
                    ? "bg-white text-slate-900 shadow-sm font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {amt}M
              </button>
            ))}
          </div>

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            title={isMuted ? "Unmute sound" : "Mute sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
          </button>
        </div>
      </header>

      {/* 2. Live Crypto Price & Oracle Card (Apple Design Language) */}
      <section className="w-full bg-white border border-black/[0.06] rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.035)] p-4 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          {/* Asset Selector Segmented Control */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              {(["MON", "BTC", "ETH"] as SupportedAsset[]).map((sym) => (
                <button
                  key={sym}
                  onClick={() => setSelectedAsset(sym)}
                  disabled={gameState === "playing"}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedAsset === sym
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <AssetLogo symbol={sym} size={16} />
                  <span>{sym}</span>
                </button>
              ))}
            </div>

            <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
              <Radio className={`w-2.5 h-2.5 ${isLive ? "text-emerald-500 animate-pulse" : "text-amber-500"}`} />
              {isLive ? "PYTH LIVE" : "SIMULATED"}
            </span>
          </div>

          {/* Current Live Price vs Strike */}
          <div className="flex items-baseline gap-3">
            <div className="text-right">
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Strike Price
              </div>
              <div className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
                ${strikePrice.toLocaleString(undefined, { minimumFractionDigits: selectedAsset === "BTC" ? 1 : 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Current Price
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums flex items-center gap-1.5">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: selectedAsset === "BTC" ? 1 : 2, maximumFractionDigits: 2 })}
                <span
                  className={`text-xs font-semibold flex items-center gap-0.5 ${
                    isDeltaPositive ? "text-[#14CF1C]" : "text-[#FF3B30]"
                  }`}
                >
                  {isDeltaPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{isDeltaPositive ? `+${livePriceDelta.toFixed(2)}%` : `${livePriceDelta.toFixed(2)}%`}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Smooth Bézier Price Chart */}
        <div className="w-full">
          {sparklineSVG}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-black/[0.04] mt-1">
          <span>Dotted line = Round Strike Price ($ {strikePrice.toFixed(selectedAsset === "BTC" ? 1 : 2)})</span>
          <span className={isDeltaPositive ? "text-[#14CF1C] font-semibold" : "text-[#FF3B30] font-semibold"}>
            Flight Corridor Target: {isDeltaPositive ? "▲ Bull Ascent (+Altitude)" : "▼ Bear Dip (-Altitude)"}
          </span>
        </div>
      </section>

      {/* 3. Main Game Arena (Daylight Apple Light Mode Canvas) */}
      <div className="relative w-full aspect-[16/9] max-h-[460px] rounded-3xl overflow-hidden border border-black/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.06)] bg-[#F8FAFC]">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full block"
        />

        {/* Linear Match Duration Progress Bar across the top edge */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/[0.06]">
          <div
            className={`h-full transition-all duration-300 ${
              timeLeft <= 5 ? "bg-red-500" : "bg-[#836EF9]"
            }`}
            style={{ width: `${roundProgressPercent}%` }}
          />
        </div>

        {/* Floating Top HUD: P1, Match Duration Timer & Pot, P2 */}
        <div className="absolute top-3 left-0 right-0 px-4 sm:px-6 flex items-center justify-between pointer-events-none">
          {/* Player 1 HUD Card */}
          <div
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-all shadow-sm ${
              p1Telemetry.inZone
                ? "bg-white/95 border-emerald-400 text-slate-900 shadow-emerald-500/10"
                : "bg-white/85 border-black/[0.06] text-slate-800"
            }`}
          >
            <span className="text-lg">🟣</span>
            <div>
              <div className="text-[10px] font-semibold text-[#6E4EF4] leading-none uppercase">
                P1 • {p1Prediction}
              </div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 flex items-center gap-1.5">
                {p1Telemetry.score} pts
                <span className="text-[11px] px-1 rounded bg-[#836EF9]/15 text-[#6E4EF4] font-mono">
                  {p1Telemetry.mult}x
                </span>
              </div>
            </div>
          </div>

          {/* Central Match Timer & Dynamic Pot */}
          <div className="flex flex-col items-center bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-black/[0.06] shadow-sm">
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#6E4EF4]" />
              {selectedDuration}s Round • Pot: <span className="text-emerald-600 font-bold">{totalPot} MON</span>
            </div>
            <div
              className={`text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums ${
                timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-slate-900"
              }`}
            >
              00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </div>
          </div>

          {/* Player 2 / Bot HUD Card */}
          <div
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-all shadow-sm ${
              p2Telemetry.inZone
                ? "bg-white/95 border-emerald-400 text-slate-900 shadow-emerald-500/10"
                : "bg-white/85 border-black/[0.06] text-slate-800"
            }`}
          >
            <div>
              <div className="text-[10px] font-semibold text-emerald-600 uppercase text-right leading-none">
                {gameMode === "solo" ? "AI ORACLE" : "P2 • " + (p1Prediction === "BULL" ? "BEAR" : "BULL")}
              </div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 flex items-center gap-1.5 justify-end">
                <span className="text-[11px] px-1 rounded bg-emerald-500/15 text-emerald-700 font-mono">
                  {p2Telemetry.mult}x
                </span>
                {p2Telemetry.score} pts
              </div>
            </div>
            <span className="text-lg">🐸</span>
          </div>
        </div>

        {/* Start Overlay / Lobby Screen (Clean Apple Card) */}
        {gameState === "idle" && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="inline-flex p-3 rounded-2xl bg-[#836EF9]/10 text-[#6E4EF4] mb-2.5">
              <Flame className="w-7 h-7 text-[#836EF9]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1">
              Rocket Clash Arena
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-4 leading-relaxed">
              Predict {selectedAsset} price movement. Hold to thrust, hover in the{" "}
              <span className="text-emerald-600 font-semibold">Live Price Corridor</span> to stack up to 5x altitude multipliers!
            </p>

            {/* Round Settings Row */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
              {/* Duration Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <span className="text-[10px] font-medium text-slate-500 px-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> DURATION:
                </span>
                {([15, 30, 60] as MatchDuration[]).map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setSelectedDuration(sec)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                      selectedDuration === sec
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              {/* Prediction Stance */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <span className="text-[10px] font-medium text-slate-500 px-2">TARGET:</span>
                <button
                  onClick={() => setP1Prediction("BULL")}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    p1Prediction === "BULL"
                      ? "bg-white text-[#14CF1C] shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[#14CF1C]" />
                  BULL (UP)
                </button>
                <button
                  onClick={() => setP1Prediction("BEAR")}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    p1Prediction === "BEAR"
                      ? "bg-white text-[#FF3B30] shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5 text-[#FF3B30]" />
                  BEAR (DOWN)
                </button>
              </div>

              {/* Game Mode */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setGameMode("solo")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    gameMode === "solo" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500"
                  }`}
                >
                  <User className="w-3 h-3" /> Solo
                </button>
                <button
                  onClick={() => setGameMode("versus")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    gameMode === "versus" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500"
                  }`}
                >
                  <Users className="w-3 h-3" /> 1v1 Split
                </button>
              </div>
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3 rounded-2xl bg-[#6E4EF4] hover:bg-[#5E3DE0] text-white font-semibold text-sm tracking-wide shadow-md shadow-purple-500/20 active:scale-[0.98] transition-all"
            >
              Start {selectedDuration}s Clash Round
            </button>
          </div>
        )}

        {/* Game Over Settlement Modal (Clean Apple Card) */}
        {gameState === "gameover" && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 mb-2">
              <Trophy className="w-7 h-7" />
            </div>

            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mb-1">
              Match Completed ({selectedDuration}s)
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-1">
              {winner === "P1" ? "Gmonad Alpha Wins! 🎉" : winner === "P2" ? "Pepe Rocket Wins! 🐸" : "Tie Clash! 🤝"}
            </h3>

            <p className="text-xs text-slate-600 mb-4 font-mono">
              Outcome: <span className={isDeltaPositive ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                {selectedAsset} ended {isDeltaPositive ? `UP (+${livePriceDelta.toFixed(2)}%)` : `DOWN (${livePriceDelta.toFixed(2)}%)`}
              </span> • Pot: <span className="font-bold text-slate-900">{totalPot} MON</span>
            </p>

            <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <div className="text-[10px] text-slate-500 font-mono">P1 TOTAL</div>
                <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                  {Math.floor(p1Ref.current.score * p1Ref.current.multiplier)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <div className="text-[10px] text-slate-500 font-mono">P2 TOTAL</div>
                <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                  {Math.floor(p2Ref.current.score * p2Ref.current.multiplier)}
                </div>
              </div>
            </div>

            <button
              onClick={startGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6E4EF4] hover:bg-[#5E3DE0] text-white font-semibold text-xs tracking-wide shadow-sm active:scale-[0.98] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Play Another {selectedDuration}s Round
            </button>
          </div>
        )}
      </div>

      {/* 4. Direct Manipulation Physical Controls (Instant pointerdown feedback) */}
      <div className="w-full mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* P1 Controls Button */}
        <button
          onPointerDown={handleP1PointerDown}
          onPointerUp={handleP1PointerUp}
          onPointerLeave={handleP1PointerUp}
          onPointerCancel={handleP1PointerUp}
          className="relative group p-4 rounded-2xl bg-white border border-black/[0.06] hover:border-black/[0.12] active:scale-[0.98] transition-all flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.035)] cursor-pointer touch-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#836EF9]/15 flex items-center justify-center text-xl">
              🟣
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-[#6E4EF4]">P1 • Hold to Fire Thrusters</div>
              <div className="text-xs font-mono text-slate-500">HOLD [SPACE] / [W] / TAP</div>
            </div>
          </div>
          <Flame className="w-5 h-5 text-amber-500 group-active:scale-125 transition-transform" />
        </button>

        {/* P2 Controls Button (Versus mode or Auto AI in Solo) */}
        {gameMode === "versus" ? (
          <button
            onPointerDown={handleP2PointerDown}
            onPointerUp={handleP2PointerUp}
            onPointerLeave={handleP2PointerUp}
            onPointerCancel={handleP2PointerUp}
            className="relative group p-4 rounded-2xl bg-white border border-black/[0.06] hover:border-black/[0.12] active:scale-[0.98] transition-all flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.035)] cursor-pointer touch-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-xl">
                🐸
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-emerald-700">P2 • Hold to Fire Thrusters</div>
                <div className="text-xs font-mono text-slate-500">HOLD [ARROW UP] / TAP</div>
              </div>
            </div>
            <Flame className="w-5 h-5 text-emerald-600 group-active:scale-125 transition-transform" />
          </button>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-black/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200/60 flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800">AI Oracle Competitor</div>
                <div className="text-xs text-slate-500 font-mono">Automated Pyth corridor tracking</div>
              </div>
            </div>
            <div className="text-[10px] font-mono px-2 py-1 rounded bg-slate-200/80 text-slate-700 font-semibold">
              BOT ACTIVE
            </div>
          </div>
        )}
      </div>

      {/* 5. Apple Design Info Cards (Clean surfaces directly on page) */}
      <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-[#6E4EF4]" />
            10,000 TPS Finality
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            High-frequency {selectedDuration}s rounds settled directly with sub-second finality and near-zero fees on Monad.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Live Oracle Tracking
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            The target flight corridor shifts dynamically based on real-time {selectedAsset}/USD price volatility.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            House Monetization
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            A 2.5% protocol fee from each round settlement flows automatically into the Duelio House Treasury.
          </p>
        </div>
      </div>
    </div>
  );
}
