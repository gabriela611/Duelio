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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Scale,
  Shield,
  Percent,
} from "lucide-react";
import Link from "next/link";
import { usePriceStream, SupportedAsset } from "@/infrastructure/price-feed/usePriceStream";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

interface TugRocket {
  y: number;
  vy: number;
  tilt: number;
  thrusting: boolean;
  marginStress: number; // 0 to 100%
  liquidated: boolean;
  name: string;
  avatar: string;
  color: string;
  flameColor: string;
  side: "PUMP" | "DUMP";
  dominanceScore: number;
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

type MatchDuration = 15 | 30;

export function RocketClashGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Asset selection & Price Stream
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("MON");
  const priceState = usePriceStream(selectedAsset);
  const { currentPrice, history, isLive } = priceState;

  // Game configuration & round state
  const [gameMode, setGameMode] = useState<"versus" | "solo">("versus");
  const [selectedDuration, setSelectedDuration] = useState<MatchDuration>(15);
  const [playerSide, setPlayerSide] = useState<"PUMP" | "DUMP">("PUMP");
  const [stakeMon, setStakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [winner, setWinner] = useState<"P1" | "P2" | "DRAW" | null>(null);
  const [winReason, setWinReason] = useState<"LIQUIDATION_KO" | "ORACLE_SETTLEMENT" | "DRAW" | null>(null);

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
  const [p1Telemetry, setP1Telemetry] = useState({ stress: 0, thrusting: false, liquidated: false });
  const [p2Telemetry, setP2Telemetry] = useState({ stress: 0, thrusting: false, liquidated: false });
  const [tugDominance, setTugDominance] = useState<number>(50); // 50% = Dead center

  // Physics & Animation references
  const animFrameId = useRef<number>(0);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);

  const p1Ref = useRef<TugRocket>({
    y: 120, // Upper PUMP territory
    vy: 0,
    tilt: 0,
    thrusting: false,
    marginStress: 0,
    liquidated: false,
    name: "Gmonad Alpha",
    avatar: "🟣",
    color: "#836EF9",
    flameColor: "#FF6B00",
    side: "PUMP",
    dominanceScore: 0,
  });

  const p2Ref = useRef<TugRocket>({
    y: 320, // Lower DUMP territory
    vy: 0,
    tilt: 0,
    thrusting: false,
    marginStress: 0,
    liquidated: false,
    name: "Pepe Rocket",
    avatar: "🐸",
    color: "#10B981",
    flameColor: "#059669",
    side: "DUMP",
    dominanceScore: 0,
  });

  const particlesRef = useRef<Particle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);

  // Audio toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Generate clouds for light mode canvas
  useEffect(() => {
    const clouds: Cloud[] = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: i * 150 + Math.random() * 40,
        y: 30 + Math.random() * 160,
        width: 85 + Math.random() * 50,
        height: 26 + Math.random() * 14,
        speed: 0.25 + Math.random() * 0.3,
        opacity: 0.4 + Math.random() * 0.3,
      });
    }
    cloudsRef.current = clouds;
  }, []);

  // Keyboard controls with scroll prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault();
      }

      if (gameState !== "playing") return;

      if (e.code === "KeyW" || e.code === "Space") {
        const p1 = p1Ref.current;
        if (!p1.thrusting && !p1.liquidated) {
          p1.thrusting = true;
          soundEngine.startThrust(true);
        }
      }

      if (e.code === "ArrowUp") {
        const p2 = p2Ref.current;
        if (gameMode === "versus" && !p2.thrusting && !p2.liquidated) {
          p2.thrusting = true;
          soundEngine.startThrust(false);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown") {
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

  // Start round
  const startGame = useCallback(() => {
    setWinner(null);
    setWinReason(null);
    setTimeLeft(selectedDuration);
    setGameState("playing");

    // Freeze strike price at the exact moment round begins
    const lockedPrice = currentPriceRef.current;
    setStrikePrice(lockedPrice);
    strikePriceRef.current = lockedPrice;

    // Determine sides
    const p1Side = gameMode === "versus" ? "PUMP" : playerSide;
    const p2Side = p1Side === "PUMP" ? "DUMP" : "PUMP";

    p1Ref.current = {
      ...p1Ref.current,
      y: p1Side === "PUMP" ? 120 : 320,
      vy: 0,
      tilt: 0,
      thrusting: false,
      marginStress: 0,
      liquidated: false,
      side: p1Side,
      dominanceScore: 0,
    };

    p2Ref.current = {
      ...p2Ref.current,
      y: p2Side === "PUMP" ? 120 : 320,
      vy: 0,
      tilt: 0,
      thrusting: false,
      marginStress: 0,
      liquidated: false,
      side: p2Side,
      dominanceScore: 0,
    };

    particlesRef.current = [];

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);

    let seconds = selectedDuration;
    roundTimerRef.current = setInterval(() => {
      seconds--;
      setTimeLeft(seconds);

      // Tension tick sound in the final 5 seconds
      if (seconds <= 5 && seconds > 0) {
        soundEngine.playCountdownTick(true);
      }

      if (seconds <= 0) {
        clearInterval(roundTimerRef.current!);
        setGameState("gameover");
        soundEngine.stopThrust();
        soundEngine.playVictoryJingle();

        // Check winner at 00:00 by final Pyth Oracle settlement
        const finalPrice = currentPriceRef.current;
        const initial = strikePriceRef.current;
        const isDraw = Math.abs(finalPrice - initial) < 0.00000001;

        if (isDraw) {
          setWinner("DRAW");
          setWinReason("DRAW");
          return;
        }

        const winningTrend = finalPrice > initial ? "PUMP" : "DUMP";
        setWinReason("ORACLE_SETTLEMENT");

        if (p1Ref.current.side === winningTrend) {
          setWinner("P1");
        } else {
          setWinner("P2");
        }
      }
    }, 1000);
  }, [selectedDuration, gameMode, playerSide]);

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
      const strikeCenterY = height * 0.5;

      const currP = currentPriceRef.current;
      const strikeP = strikePriceRef.current;
      const priceDeltaPercent = strikeP > 0 ? ((currP - strikeP) / strikeP) * 100 : 0;

      // 1. UPDATE PHYSICS & MARGIN STRESS
      if (gameState === "playing") {
        // Solo Mode AI behavior: reacts to price and thrusts with occasional mistakes
        if (gameMode === "solo") {
          const p2 = p2Ref.current;
          // In Solo, P2 is the counter-party
          const marketAgainstP2 = p2.side === "DUMP" ? priceDeltaPercent > 0.08 : priceDeltaPercent < -0.08;

          // AI releases if stress is getting dangerously high (>70%)
          if (p2.marginStress > 70) {
            p2.thrusting = false;
          } else if (marketAgainstP2 && Math.random() < 0.25) {
            p2.thrusting = false; // AI hedges
          } else if (Math.random() < 0.65) {
            p2.thrusting = true; // AI pumps pressure
          }
        }

        // Update Rockets
        [p1Ref.current, p2Ref.current].forEach((r, idx) => {
          if (r.liquidated) return;

          const rocketX = idx === 0 ? width * 0.28 : width * 0.44;

          // Target altitude based on role: PUMP stays in top half (y ~ 110), DUMP in bottom half (y ~ 330)
          const naturalY = r.side === "PUMP" ? 110 : 330;
          const thrustForce = r.side === "PUMP" ? -0.85 : 0.85;
          const returnForce = r.side === "PUMP" ? 0.38 : -0.38;

          // MARGIN STRESS & LIVE LIQUIDATION MECHANIC:
          // If player is thrusting while market moves AGAINST them:
          // PUMP suffers stress if price is dropping (priceDeltaPercent < 0)
          // DUMP suffers stress if price is rising (priceDeltaPercent > 0)
          const marketAdverseDelta = r.side === "PUMP" ? -priceDeltaPercent : priceDeltaPercent;

          if (r.thrusting) {
            // Thrusting accelerates rocket in its direction
            r.vy += thrustForce;

            if (marketAdverseDelta > 0.05) {
              // Holding while market moves in opposite direction builds rapid stress!
              r.marginStress = Math.min(100, r.marginStress + marketAdverseDelta * 38 * dt);
              if (r.marginStress > 70 && Math.random() < 0.1) {
                soundEngine.playMarginAlarm();
              }
            } else {
              // Favorable market cools margin stress
              r.marginStress = Math.max(0, r.marginStress - 15 * dt);
            }
          } else {
            // Releasing the button enters HEDGED / SAFE MODE (stress cools down quickly)
            r.marginStress = Math.max(0, r.marginStress - 45 * dt);
            r.vy += returnForce;
          }

          // CHECK LIVE LIQUIDATION (💥 REKT BLOWOUT)
          if (r.marginStress >= 100) {
            r.liquidated = true;
            r.thrusting = false;
            soundEngine.stopThrust();
            soundEngine.playExplosionSound();

            // Spawn giant explosion particles
            for (let i = 0; i < 28; i++) {
              particlesRef.current.push({
                x: rocketX,
                y: r.y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                size: Math.random() * 8 + 4,
                alpha: 1.0,
                color: Math.random() < 0.5 ? "#EF4444" : "#F59E0B",
              });
            }

            // Opponent instantly wins by Knockout!
            if (roundTimerRef.current) clearInterval(roundTimerRef.current);
            setGameState("gameover");
            setWinReason("LIQUIDATION_KO");
            setWinner(idx === 0 ? "P2" : "P1");
            soundEngine.playVictoryJingle();
            return;
          }

          // Physics integration
          r.vy *= 0.94; // Drag
          r.y += r.vy;

          // Boundary constraints
          if (r.side === "PUMP") {
            if (r.y < 50) { r.y = 50; r.vy = 1.0; }
            if (r.y > strikeCenterY - 15) { r.y = strikeCenterY - 15; r.vy = -1.0; }
          } else {
            if (r.y < strikeCenterY + 15) { r.y = strikeCenterY + 15; r.vy = 1.0; }
            if (r.y > height - 40) { r.y = height - 40; r.vy = -1.0; }
          }

          // Aerodynamic tilt
          r.tilt = Math.max(-20, Math.min(20, r.vy * 2.8));

          // Exhaust particles
          if (r.thrusting) {
            particlesRef.current.push({
              x: rocketX,
              y: r.side === "PUMP" ? r.y + 14 : r.y - 14,
              vx: (Math.random() - 0.5) * 2 - 2,
              vy: r.side === "PUMP" ? Math.random() * 2 + 1 : -(Math.random() * 2 + 1),
              size: Math.random() * 4 + 2,
              alpha: 0.8,
              color: r.marginStress > 60 ? "#EF4444" : r.flameColor,
            });
          }
        });

        // Update exhaust particles
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.035;
          p.size = Math.max(0, p.size - 0.1);
        });
        particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);

        // Calculate Tug-of-War Dominance (0 to 100%)
        // 50% is equilibrium. P1 thrusting pulls up (+), P2 thrusting pulls down (-), price delta shifts baseline
        const pricePull = Math.max(-25, Math.min(25, priceDeltaPercent * 40));
        const thrustPull = (p1Ref.current.thrusting ? 15 : 0) - (p2Ref.current.thrusting ? 15 : 0);
        const currentDom = Math.max(5, Math.min(95, 50 + pricePull + thrustPull));
        setTugDominance(Math.round(currentDom));

        // Update HUD telemetry
        setP1Telemetry({
          stress: Math.round(p1Ref.current.marginStress),
          thrusting: p1Ref.current.thrusting,
          liquidated: p1Ref.current.liquidated,
        });
        setP2Telemetry({
          stress: Math.round(p2Ref.current.marginStress),
          thrusting: p2Ref.current.thrusting,
          liquidated: p2Ref.current.liquidated,
        });
      }

      // Update clouds
      cloudsRef.current.forEach((c) => {
        c.x -= c.speed;
        if (c.x < -c.width) c.x = width + 40;
      });

      // 2. RENDER SCENE (Clean Apple Daylight Palette)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#F4F6F9");
      skyGrad.addColorStop(0.5, "#EDF2F7");
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

      // Ambient Clouds
      cloudsRef.current.forEach((c) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
        ctx.beginPath();
        const r = c.height / 2;
        ctx.arc(c.x + r, c.y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
        ctx.arc(c.x + c.width - r, c.y + r, r, (Math.PI * 3) / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
      });

      // UPPER HALF: PUMP TERRITORY (Gentle Green Tint)
      ctx.fillStyle = "rgba(20, 207, 28, 0.05)";
      ctx.fillRect(0, 0, width, strikeCenterY);

      // LOWER HALF: DUMP TERRITORY (Gentle Red Tint)
      ctx.fillStyle = "rgba(239, 68, 68, 0.05)";
      ctx.fillRect(0, strikeCenterY, width, height - strikeCenterY);

      // HORIZONTAL STRIKE DIVIDER
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(0, strikeCenterY);
      ctx.lineTo(width, strikeCenterY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center Strike Price Badge
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - 90, strikeCenterY - 12, 180, 24, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#1E293B";
      ctx.textAlign = "center";
      ctx.fillText(
        `STRIKE: $${strikePriceRef.current.toFixed(selectedAsset === "BTC" ? 1 : 2)}`,
        width * 0.5,
        strikeCenterY + 4
      );
      ctx.textAlign = "start";

      // TUG-OF-WAR ENERGETIC TETHER BEAM
      const p1 = p1Ref.current;
      const p2 = p2Ref.current;
      if (!p1.liquidated && !p2.liquidated) {
        const x1 = width * 0.28;
        const x2 = width * 0.44;
        const midX = (x1 + x2) / 2;

        ctx.strokeStyle = priceDeltaPercent >= 0 ? "rgba(20, 207, 28, 0.6)" : "rgba(239, 68, 68, 0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, p1.y);
        ctx.quadraticCurveTo(midX + (priceDeltaPercent * 80), strikeCenterY, x2, p2.y);
        ctx.stroke();
      }

      // Render Particles
      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Render Rockets
      const renderTugRocket = (r: TugRocket, x: number) => {
        if (r.liquidated) return;

        ctx.save();
        ctx.translate(x, r.y);
        ctx.rotate((r.tilt * Math.PI) / 180);

        // Thruster flame
        if (r.thrusting) {
          ctx.fillStyle = r.marginStress > 60 ? "#EF4444" : r.flameColor;
          ctx.beginPath();
          ctx.moveTo(-16, -4);
          ctx.lineTo(-30 - Math.random() * 8, 0);
          ctx.lineTo(-16, 4);
          ctx.closePath();
          ctx.fill();
        }

        // Margin Stress Warning Glow
        if (r.marginStress > 50) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${r.marginStress / 100})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2);
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

        // Cockpit & Avatar
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(2, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.stroke();

        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(r.avatar, 2, 4);

        // LIQUIDATION RISK GAUGE ABOVE ROCKET
        const gaugeW = 32;
        const gaugeH = 3;
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        ctx.fillRect(-16, -26, gaugeW, gaugeH);

        const stressW = (r.marginStress / 100) * gaugeW;
        ctx.fillStyle = r.marginStress > 70 ? "#EF4444" : r.marginStress > 40 ? "#F59E0B" : "#10B981";
        ctx.fillRect(-16, -26, stressW, gaugeH);

        // Tag label
        ctx.font = "bold 9px system-ui, sans-serif";
        if (r.marginStress > 60) {
          ctx.fillStyle = "#EF4444";
          ctx.fillText("⚠️ MARGIN STRESS", 0, -31);
        } else {
          ctx.fillStyle = r.side === "PUMP" ? "#059669" : "#DC2626";
          ctx.fillText(`${r.name} [${r.side}]`, 0, -31);
        }

        ctx.restore();
      };

      renderTugRocket(p1Ref.current, width * 0.28);
      renderTugRocket(p2Ref.current, width * 0.44);

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, gameMode, selectedAsset, selectedDuration]);

  // Touch & Pointer handlers
  const handleP1PointerDown = (e: React.PointerEvent) => {
    if (gameState !== "playing" || p1Ref.current.liquidated) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    p1Ref.current.thrusting = true;
    soundEngine.startThrust(true);
  };

  const handleP1PointerUp = () => {
    p1Ref.current.thrusting = false;
    soundEngine.stopThrust();
  };

  const handleP2PointerDown = (e: React.PointerEvent) => {
    if (gameState !== "playing" || gameMode !== "versus" || p2Ref.current.liquidated) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    p2Ref.current.thrusting = true;
    soundEngine.startThrust(false);
  };

  const handleP2PointerUp = () => {
    p2Ref.current.thrusting = false;
    if (gameMode === "versus") soundEngine.stopThrust();
  };

  const isFinalFiveSeconds = timeLeft <= 5 && gameState === "playing";
  const livePriceDelta = strikePrice > 0 ? ((currentPrice - strikePrice) / strikePrice) * 100 : 0;
  const isDeltaPositive = livePriceDelta >= 0;
  const roundProgressPercent = Math.max(0, Math.min(100, ((selectedDuration - timeLeft) / selectedDuration) * 100));

  // 3.5% PROTOCOL HOUSE RAKE ECONOMICS
  const totalEscrowPot = (stakeMon * 2).toFixed(3);
  const protocolHouseFee = (stakeMon * 2 * 0.035).toFixed(4);
  const netWinnerPayout = ((stakeMon * 2) * 0.965).toFixed(3);

  // Sparkline SVG
  const sparklineSVG = useMemo(() => {
    if (!history || history.length === 0) return null;
    const prices = history.map((p) => p.price);
    const minP = Math.min(...prices, strikePrice, currentPrice);
    const maxP = Math.max(...prices, strikePrice, currentPrice);
    const range = maxP - minP || 1;
    const w = 480;
    const h = 65;
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
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12 overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="priceSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.16" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <line
          x1="0"
          y1={strikeY}
          x2={w}
          y2={strikeY}
          stroke="#94A3B8"
          strokeDasharray="4 4"
          strokeWidth="1.2"
        />

        <path d={`${pathD} L ${w} ${h} L 0 ${h} Z`} fill="url(#priceSparkGrad)" />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        <circle cx={lastP.x} cy={lastP.y} r="3.5" fill={strokeColor} className="animate-pulse" />
      </svg>
    );
  }, [history, strikePrice, currentPrice, isDeltaPositive]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center select-none text-[#0B0B0B]">
      {/* 1. Apple Header Bar with Protocol Rake Badge */}
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
              Rocket Tug-of-War <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#836EF9]/10 text-[#6E4EF4] font-mono font-medium">EXP</span>
            </h1>
          </div>
        </div>

        {/* Stake Selector & House Rake Notice */}
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

          <div className="hidden md:flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2.5 py-1 rounded-xl text-[11px] font-mono font-medium">
            <Percent className="w-3 h-3 text-emerald-600" />
            <span>3.5% Rake ({protocolHouseFee}M)</span>
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

      {/* 2. Tug-of-War Real-Time Dominance Bar */}
      <div className="w-full bg-white border border-black/[0.06] rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.035)] p-3 mb-3">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span className="text-emerald-700 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> P1 PUMP: {tugDominance}%
          </span>
          <span className="text-slate-500 font-mono text-[11px]">
            {tugDominance > 55 ? "▲ PUMP DOMINATING" : tugDominance < 45 ? "▼ DUMP DOMINATING" : "⚖️ DEAD HEAT"}
          </span>
          <span className="text-red-600 flex items-center gap-1">
            P2 DUMP: {100 - tugDominance}% <TrendingDown className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Tug-of-War Segmented Progress Bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex p-0.5">
          <div
            className="h-full bg-emerald-500 rounded-l-full transition-all duration-150"
            style={{ width: `${tugDominance}%` }}
          />
          <div
            className="h-full bg-red-500 rounded-r-full transition-all duration-150"
            style={{ width: `${100 - tugDominance}%` }}
          />
        </div>
      </div>

      {/* 3. Live Price & Oracle Card */}
      <section className="w-full bg-white border border-black/[0.06] rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.035)] p-4 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
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
              {isLive ? "PYTH ORACLE LIVE" : "SIMULATED"}
            </span>
          </div>

          {/* Current Live Price vs Strike */}
          <div className="flex items-baseline gap-4">
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
                Oracle Price
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

        {/* Live Sparkline */}
        <div className="w-full">
          {sparklineSVG}
        </div>
      </section>

      {/* 4. Main Game Arena (Light Mode Daylight Canvas) */}
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
              isFinalFiveSeconds ? "bg-red-500 animate-pulse" : "bg-[#836EF9]"
            }`}
            style={{ width: `${roundProgressPercent}%` }}
          />
        </div>

        {/* Floating Top HUD: P1, Match Timer, P2 */}
        <div className="absolute top-3 left-0 right-0 px-4 sm:px-6 flex items-center justify-between pointer-events-none">
          {/* Player 1 HUD Card */}
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border backdrop-blur-md transition-all shadow-sm ${
              p1Telemetry.stress > 60
                ? "bg-red-50/95 border-red-400 text-red-900 animate-pulse"
                : p1Telemetry.thrusting
                ? "bg-emerald-50/95 border-emerald-400 text-slate-900 shadow-emerald-500/15"
                : "bg-white/85 border-black/[0.06] text-slate-800"
            }`}
          >
            <span className="text-xl">🟣</span>
            <div>
              <div className="text-[10px] font-bold text-[#6E4EF4] leading-none uppercase flex items-center gap-1">
                P1 • PUMP (LONG)
                {p1Telemetry.thrusting ? <span className="text-emerald-600 font-bold">PUMPING</span> : <span className="text-slate-400">HEDGED</span>}
              </div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 flex items-center gap-1.5">
                POT: {netWinnerPayout}M
              </div>
              {/* Margin Stress Bar */}
              <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    p1Telemetry.stress > 70 ? "bg-red-500" : p1Telemetry.stress > 40 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${p1Telemetry.stress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Central Match Timer & Status */}
          <div className={`flex flex-col items-center px-4 py-1.5 rounded-2xl border backdrop-blur-md shadow-sm transition-all ${
            isFinalFiveSeconds
              ? "bg-red-500/15 border-red-400/80 text-red-950 scale-105"
              : "bg-white/90 border-black/[0.06] text-slate-900"
          }`}>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#6E4EF4]" />
              {selectedDuration}s Round • {isDeltaPositive ? "🟢 PUMP LEADING" : "🔴 DUMP LEADING"}
            </div>
            <div
              className={`text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums ${
                isFinalFiveSeconds ? "text-red-600 animate-pulse font-black" : "text-slate-900"
              }`}
            >
              00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </div>
          </div>

          {/* Player 2 / Opponent HUD Card */}
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border backdrop-blur-md transition-all shadow-sm ${
              p2Telemetry.stress > 60
                ? "bg-red-50/95 border-red-400 text-red-900 animate-pulse"
                : p2Telemetry.thrusting
                ? "bg-red-50/95 border-red-400 text-slate-900 shadow-red-500/15"
                : "bg-white/85 border-black/[0.06] text-slate-800"
            }`}
          >
            <div>
              <div className="text-[10px] font-bold text-red-600 uppercase text-right leading-none flex items-center justify-end gap-1">
                {p2Telemetry.thrusting ? <span className="text-red-600 font-bold">DUMPING</span> : <span className="text-slate-400">HEDGED</span>}
                {gameMode === "solo" ? "AI ORACLE" : "P2 • DUMP (SHORT)"}
              </div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 flex items-center gap-1.5 justify-end">
                POT: {netWinnerPayout}M
              </div>
              {/* Margin Stress Bar */}
              <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden ml-auto">
                <div
                  className={`h-full transition-all ${
                    p2Telemetry.stress > 70 ? "bg-red-500" : p2Telemetry.stress > 40 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${p2Telemetry.stress}%` }}
                />
              </div>
            </div>
            <span className="text-xl">🐸</span>
          </div>
        </div>

        {/* Start Overlay / Lobby Screen */}
        {gameState === "idle" && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="inline-flex p-3 rounded-2xl bg-[#836EF9]/10 text-[#6E4EF4] mb-2.5">
              <Flame className="w-7 h-7 text-[#836EF9]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1">
              Rocket Tug-of-War: Pump vs Dump
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-3 leading-relaxed">
              Hold to inject leverage pressure in your direction. If the Pyth Oracle moves sharply against you, <strong>release to hedge</strong> or suffer <strong>Margin Call Liquidation (KO)</strong>!
            </p>

            {/* Mode & Settings Row */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
              {/* Game Mode Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setGameMode("versus")}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameMode === "versus" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-[#6E4EF4]" /> 1v1 Split Duel
                </button>
                <button
                  onClick={() => setGameMode("solo")}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameMode === "solo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-amber-600" /> Solo vs AI
                </button>
              </div>

              {/* Duration Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <span className="text-[10px] font-medium text-slate-500 px-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> DURATION:
                </span>
                {([15, 30] as MatchDuration[]).map((sec) => (
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

              {/* Player Side (In Solo Mode) */}
              {gameMode === "solo" && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <span className="text-[10px] font-medium text-slate-500 px-2">YOUR SIDE:</span>
                  <button
                    onClick={() => setPlayerSide("PUMP")}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      playerSide === "PUMP"
                        ? "bg-white text-[#14CF1C] shadow-sm font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-[#14CF1C]" />
                    PUMP (LONG)
                  </button>
                  <button
                    onClick={() => setPlayerSide("DUMP")}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      playerSide === "DUMP"
                        ? "bg-white text-[#FF3B30] shadow-sm font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5 text-[#FF3B30]" />
                    DUMP (SHORT)
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3 rounded-2xl bg-[#6E4EF4] hover:bg-[#5E3DE0] text-white font-semibold text-sm tracking-wide shadow-md shadow-purple-500/20 active:scale-[0.98] transition-all"
            >
              Start {selectedDuration}s Tug-of-War ({totalEscrowPot} MON Pot)
            </button>
          </div>
        )}

        {/* Game Over Settlement Modal */}
        {gameState === "gameover" && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
            <div className={`p-3.5 rounded-2xl mb-2 ${
              winner === "DRAW"
                ? "bg-slate-100 text-slate-700"
                : winner === "P1"
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-red-500/15 text-red-600"
            }`}>
              {winner === "DRAW" ? <Scale className="w-8 h-8" /> : winner === "P1" ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
            </div>

            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mb-1">
              {winReason === "LIQUIDATION_KO" ? "💥 KNOCKOUT LIQUIDATION" : "PYTH ORACLE SETTLEMENT"}
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-1">
              {winner === "DRAW"
                ? "Exact Draw! ⚖️ Stakes Refunded"
                : winner === "P1"
                ? "P1 (PUMP) Wins the Pot! 🎉"
                : "P2 (DUMP) Wins the Pot! 🐸"}
            </h3>

            <p className="text-xs text-slate-600 mb-4 font-mono">
              {winReason === "LIQUIDATION_KO" ? (
                <span>Rival failed to hedge and was liquidated!</span>
              ) : (
                <span>Strike: ${strikePrice.toFixed(2)} → Final: ${currentPrice.toFixed(2)} ({isDeltaPositive ? "PUMP WON" : "DUMP WON"})</span>
              )} • Protocol Rake (3.5%): <span className="font-bold text-slate-900">{protocolHouseFee} MON</span>
            </p>

            <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <div className="text-[10px] text-slate-500 font-mono">TOTAL POT</div>
                <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                  {totalEscrowPot} MON
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <div className="text-[10px] text-slate-500 font-mono">WINNER PAYOUT</div>
                <div className="text-lg font-bold text-emerald-600 font-mono tabular-nums">
                  {winner === "DRAW" ? `${stakeMon} MON` : `${netWinnerPayout} MON`}
                </div>
              </div>
            </div>

            <button
              onClick={startGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6E4EF4] hover:bg-[#5E3DE0] text-white font-semibold text-xs tracking-wide shadow-sm active:scale-[0.98] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Play Rematch ({selectedDuration}s)
            </button>
          </div>
        )}
      </div>

      {/* 5. Direct Manipulation Tug Controls */}
      <div className="w-full mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* P1 Controls Button */}
        <button
          onPointerDown={handleP1PointerDown}
          onPointerUp={handleP1PointerUp}
          onPointerLeave={handleP1PointerUp}
          onPointerCancel={handleP1PointerUp}
          className={`relative group p-4 rounded-2xl bg-white border transition-all flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.035)] cursor-pointer touch-none ${
            p1Telemetry.stress > 60
              ? "border-red-400 bg-red-50/50"
              : p1Telemetry.thrusting
              ? "border-emerald-400 bg-emerald-50/30"
              : "border-black/[0.06] hover:border-black/[0.12] active:scale-[0.98]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
              p1Telemetry.stress > 60 ? "bg-red-500/20" : "bg-[#836EF9]/15"
            }`}>
              {p1Telemetry.stress > 60 ? "⚠️" : "🟣"}
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-[#6E4EF4] flex items-center gap-1.5">
                <span>P1 (PUMP) • Hold to Inject Pressure</span>
                {p1Telemetry.stress > 60 && <span className="text-red-500 text-[10px] font-bold">RELEASE TO HEDGE!</span>}
              </div>
              <div className="text-xs font-mono text-slate-500">HOLD [SPACE] / [W] / TAP • Stress: {p1Telemetry.stress}%</div>
            </div>
          </div>
          <Flame className={`w-5 h-5 transition-transform ${
            p1Telemetry.stress > 60 ? "text-red-500" : "text-amber-500 group-active:scale-125"
          }`} />
        </button>

        {/* P2 Controls Button */}
        {gameMode === "versus" ? (
          <button
            onPointerDown={handleP2PointerDown}
            onPointerUp={handleP2PointerUp}
            onPointerLeave={handleP2PointerUp}
            onPointerCancel={handleP2PointerUp}
            className={`relative group p-4 rounded-2xl bg-white border transition-all flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.035)] cursor-pointer touch-none ${
              p2Telemetry.stress > 60
                ? "border-red-400 bg-red-50/50"
                : p2Telemetry.thrusting
                ? "border-red-400 bg-red-50/30"
                : "border-black/[0.06] hover:border-black/[0.12] active:scale-[0.98]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                p2Telemetry.stress > 60 ? "bg-red-500/20" : "bg-emerald-500/15"
              }`}>
                {p2Telemetry.stress > 60 ? "⚠️" : "🐸"}
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <span>P2 (DUMP) • Hold to Inject Pressure</span>
                  {p2Telemetry.stress > 60 && <span className="text-red-500 text-[10px] font-bold">RELEASE TO HEDGE!</span>}
                </div>
                <div className="text-xs font-mono text-slate-500">HOLD [ARROW UP] / TAP • Stress: {p2Telemetry.stress}%</div>
              </div>
            </div>
            <Flame className={`w-5 h-5 transition-transform ${
              p2Telemetry.stress > 60 ? "text-red-500" : "text-emerald-600 group-active:scale-125"
            }`} />
          </button>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-black/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200/60 flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800">AI Rival ({p2Ref.current.side})</div>
                <div className="text-xs text-slate-500 font-mono">Automated risk hedging & pressure</div>
              </div>
            </div>
            <div className="text-[10px] font-mono px-2 py-1 rounded bg-slate-200/80 text-slate-700 font-semibold">
              BOT ACTIVE
            </div>
          </div>
        )}
      </div>

      {/* 6. Game Economics Info Cards */}
      <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Percent className="w-3.5 h-3.5 text-[#6E4EF4]" />
            Guaranteed 3.5% House Rake
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Every 15-second round extracts a 3.5% protocol cut into the Duelio Treasury. Zero counter-party risk for the house.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Live Margin Call (KO)
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Holding through an adverse market move builds liquidation stress. If you fail to release, your rocket blows up!
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            15s Hyper-Casual Velocity
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Designed for Monad sub-second finality. High-speed rematches produce massive volume and continuous fee generation.
          </p>
        </div>
      </div>
    </div>
  );
}
