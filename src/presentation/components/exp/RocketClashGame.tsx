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
  ShieldCheck,
  Scale,
  Gauge,
  Skull,
} from "lucide-react";
import Link from "next/link";
import { usePriceStream, SupportedAsset } from "@/infrastructure/price-feed/usePriceStream";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

interface RocketState {
  y: number;
  vy: number;
  tilt: number;
  thrusting: boolean;
  multiplier: number;
  chargeTime: number;
  inZone: boolean;
  name: string;
  avatar: string;
  color: string;
  flameColor: string;
  side: "BULL" | "BEAR";
  heat: number; // 0 to 100
  overheated: boolean;
  overheatTimer: number;
}

interface Obstacle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  icon: string;
  label: string;
  color: string;
  hit: boolean;
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

type MatchDuration = 15 | 30 | 60;

export function RocketClashGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Asset selection & Price Stream
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("MON");
  const priceState = usePriceStream(selectedAsset);
  const { currentPrice, history, isLive, source } = priceState;

  // Game configuration & round state
  const [gameMode, setGameMode] = useState<"solo" | "versus">("versus");
  const [selectedDuration, setSelectedDuration] = useState<MatchDuration>(30);
  const [playerStance, setPlayerStance] = useState<"BULL" | "BEAR">("BULL");
  const [stakeMon, setStakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [winner, setWinner] = useState<"P1" | "P2" | "HOUSE" | "DRAW" | null>(null);
  const [winningSide, setWinningSide] = useState<"BULL" | "BEAR" | "DRAW" | null>(null);

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
  const [p1Telemetry, setP1Telemetry] = useState({ mult: 1.0, inZone: false, chargePercent: 0, heat: 0, overheated: false });
  const [p2Telemetry, setP2Telemetry] = useState({ mult: 1.0, inZone: false, chargePercent: 0, heat: 0, overheated: false });

  // Physics & Animation references
  const animFrameId = useRef<number>(0);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);

  const p1Ref = useRef<RocketState>({
    y: 130, // Upper half (Bull zone)
    vy: 0,
    tilt: 0,
    thrusting: false,
    multiplier: 1.0,
    chargeTime: 0,
    inZone: true,
    name: "Gmonad Alpha",
    avatar: "🟣",
    color: "#836EF9",
    flameColor: "#FF6B00",
    side: "BULL",
    heat: 0,
    overheated: false,
    overheatTimer: 0,
  });

  const p2Ref = useRef<RocketState>({
    y: 310, // Lower half (Bear zone)
    vy: 0,
    tilt: 0,
    thrusting: false,
    multiplier: 1.0,
    chargeTime: 0,
    inZone: true,
    name: "Pepe Rocket",
    avatar: "🐸",
    color: "#10B981",
    flameColor: "#059669",
    side: "BEAR",
    heat: 0,
    overheated: false,
    overheatTimer: 0,
  });

  const particlesRef = useRef<Particle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const nextObstacleSpawnRef = useRef<number>(0);

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
      // Prevent page scrolling on Space and Arrow keys
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault();
      }

      if (gameState !== "playing") return;

      if (e.code === "KeyW" || e.code === "Space") {
        const p1 = p1Ref.current;
        if (!p1.thrusting && !p1.overheated) {
          p1.thrusting = true;
          soundEngine.startThrust(true);
        }
      }

      if (e.code === "ArrowUp") {
        const p2 = p2Ref.current;
        if (gameMode === "versus" && !p2.thrusting && !p2.overheated) {
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
    setWinningSide(null);
    setTimeLeft(selectedDuration);
    setGameState("playing");

    // Freeze strike price at the exact moment round begins
    const lockedPrice = currentPriceRef.current;
    setStrikePrice(lockedPrice);
    strikePriceRef.current = lockedPrice;

    // Determine player sides
    const p1Side = gameMode === "versus" ? "BULL" : playerStance;
    const p2Side = p1Side === "BULL" ? "BEAR" : "BULL";

    p1Ref.current = {
      ...p1Ref.current,
      y: p1Side === "BULL" ? 130 : 310,
      vy: 0,
      tilt: 0,
      thrusting: false,
      multiplier: 1.0,
      chargeTime: 0,
      side: p1Side,
      heat: 0,
      overheated: false,
      overheatTimer: 0,
    };

    p2Ref.current = {
      ...p2Ref.current,
      y: p2Side === "BULL" ? 130 : 310,
      vy: 0,
      tilt: 0,
      thrusting: false,
      multiplier: 1.0,
      chargeTime: 0,
      side: p2Side,
      heat: 0,
      overheated: false,
      overheatTimer: 0,
    };

    particlesRef.current = [];
    obstaclesRef.current = [];
    nextObstacleSpawnRef.current = performance.now() + 1500;

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);

    let seconds = selectedDuration;
    roundTimerRef.current = setInterval(() => {
      seconds--;
      setTimeLeft(seconds);

      // Tension tick sound in the final 10 seconds
      if (seconds <= 10 && seconds > 0) {
        soundEngine.playCountdownTick(seconds <= 5);
      }

      if (seconds <= 0) {
        clearInterval(roundTimerRef.current!);
        setGameState("gameover");
        soundEngine.stopThrust();
        soundEngine.playVictoryJingle();

        // ORACLE VICTORY EVALUATION AT EXACT SECOND 00:00
        const finalPrice = currentPriceRef.current;
        const initial = strikePriceRef.current;

        const isDraw = Math.abs(finalPrice - initial) < 0.00000001;
        if (isDraw) {
          setWinningSide("DRAW");
          setWinner("DRAW");
          return;
        }

        const outcomeSide: "BULL" | "BEAR" = finalPrice > initial ? "BULL" : "BEAR";
        setWinningSide(outcomeSide);

        if (gameMode === "versus") {
          if (outcomeSide === "BULL") {
            setWinner("P1");
          } else {
            setWinner("P2");
          }
        } else {
          if (p1Ref.current.side === outcomeSide) {
            setWinner("P1");
          } else {
            setWinner("HOUSE");
          }
        }
      }
    }, 1000);
  }, [selectedDuration, gameMode, playerStance]);

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

      // 1. UPDATE PHYSICS, HAZARDS & HEAT
      if (gameState === "playing") {
        // Spawn Enemies / Crypto Hazards
        if (time > nextObstacleSpawnRef.current) {
          nextObstacleSpawnRef.current = time + 2600 + Math.random() * 1600;
          const hazardTypes = [
            { icon: "🕯️", label: "Red Wick", color: "#EF4444" },
            { icon: "📜", label: "SEC Subpoena", color: "#F59E0B" },
            { icon: "⛽", label: "500 Gwei", color: "#8B5CF6" },
            { icon: "⚡", label: "MEV Sniper", color: "#EC4899" },
          ];
          const chosen = hazardTypes[Math.floor(Math.random() * hazardTypes.length)];
          obstaclesRef.current.push({
            id: Math.random(),
            x: width + 30,
            y: 70 + Math.random() * (height - 130),
            vx: -(2.0 + Math.random() * 1.2),
            vy: (Math.random() - 0.5) * 0.5,
            radius: 16,
            icon: chosen.icon,
            label: chosen.label,
            color: chosen.color,
            hit: false,
          });
        }

        // Move and filter obstacles
        obstaclesRef.current.forEach((obs) => {
          obs.x += obs.vx;
          obs.y += obs.vy;
        });
        obstaclesRef.current = obstaclesRef.current.filter((obs) => obs.x > -50 && !obs.hit);

        // Solo Mode AI behavior: tries to stay in its assigned zone and dodge obstacles
        if (gameMode === "solo") {
          const p2 = p2Ref.current;
          const targetY = p2.side === "BULL" ? height * 0.28 : height * 0.72;
          const targetJitter = targetY + Math.sin(time * 0.003) * 16;
          const distance = p2.y - targetJitter;

          if (distance > 6 && p2.vy > -1.2 && !p2.overheated && p2.heat < 85) {
            p2.thrusting = true;
          } else if (distance < -6 || p2.heat > 85) {
            p2.thrusting = false;
          }
        }

        // Update Rockets
        [p1Ref.current, p2Ref.current].forEach((r, idx) => {
          const gravity = 0.36;
          const thrust = -0.78;
          const rocketX = idx === 0 ? width * 0.28 : width * 0.44;

          // Engine Heat Accumulation & Cooling
          if (r.thrusting && !r.overheated) {
            r.heat = Math.min(100, r.heat + 0.88);
            if (r.heat >= 100) {
              r.overheated = true;
              r.overheatTimer = 1.7; // 1.7s engine stall
              r.thrusting = false;
              soundEngine.stopThrust();
              soundEngine.playStallSound();
            }
          } else if (!r.thrusting) {
            r.heat = Math.max(0, r.heat - 1.2);
          }

          // Cool-down recovery timer if overheated
          if (r.overheated) {
            r.overheatTimer -= dt;
            if (r.overheatTimer <= 0) {
              r.overheated = false;
              r.heat = 40; // Starts cool
            }
          }

          // Thruster particle exhaust
          if (r.thrusting && !r.overheated) {
            r.vy += thrust;
            for (let i = 0; i < 2; i++) {
              particlesRef.current.push({
                x: rocketX,
                y: r.y + 14,
                vx: (Math.random() - 0.5) * 1.5 - 2,
                vy: Math.random() * 2 + 0.8,
                size: Math.random() * 4 + 2.5,
                alpha: 0.8,
                color: r.flameColor,
              });
            }
          } else if (r.overheated) {
            // Sputtering stall smoke
            particlesRef.current.push({
              x: rocketX,
              y: r.y + 10,
              vx: (Math.random() - 0.5) * 2 - 1,
              vy: Math.random() * 2,
              size: Math.random() * 6 + 4,
              alpha: 0.6,
              color: "#64748B",
            });
          }

          r.vy += gravity;
          r.vy *= 0.965; // Air drag
          r.y += r.vy;

          // Aerodynamic tilt
          r.tilt = Math.max(-22, Math.min(26, r.vy * 3.0));

          // ANTI-CEILING EXPLOIT: Ionosphere Repulsion & Heat Spike
          if (r.y < 46) {
            r.y = 46;
            r.vy = 2.8; // Bounces aggressively downward
            r.heat = Math.min(100, r.heat + 4.5); // Rapid heating if riding the ceiling
            soundEngine.playLiquidationWarning();

            // Searing atmospheric sparks
            for (let s = 0; s < 3; s++) {
              particlesRef.current.push({
                x: rocketX + (Math.random() - 0.5) * 20,
                y: r.y - 6,
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * 3 + 1,
                size: 3.5,
                alpha: 0.9,
                color: "#EF4444",
              });
            }
          }

          // Floor cushion
          if (r.y > height - 32) {
            r.y = height - 32;
            r.vy = -1.6;
          }

          // Test Obstacle Collision
          obstaclesRef.current.forEach((obs) => {
            if (obs.hit) return;
            const dist = Math.hypot(obs.x - rocketX, obs.y - r.y);
            if (dist < obs.radius + 14) {
              obs.hit = true;
              soundEngine.playHitSound();

              // Knockback & Spin Penalty
              r.vy = r.y < obs.y ? -3.2 : 3.2;
              r.tilt += 60;
              r.heat = Math.min(100, r.heat + 25); // Heat penalty

              // Multiplier penalty in Solo mode
              if (gameMode === "solo" && idx === 0) {
                r.multiplier = Math.max(1.0, r.multiplier - 0.4);
              }

              // Collision burst sparks
              for (let i = 0; i < 8; i++) {
                particlesRef.current.push({
                  x: obs.x,
                  y: obs.y,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 6,
                  size: Math.random() * 5 + 3,
                  alpha: 1.0,
                  color: obs.color,
                });
              }
            }
          });

          // Check Zone Position:
          const inValidZone = r.side === "BULL" ? r.y < strikeCenterY : r.y >= strikeCenterY;
          r.inZone = inValidZone;

          if (inValidZone && !r.overheated && r.y >= 46) {
            r.chargeTime += dt;
            const maxSecondsFor5x = selectedDuration * 0.75;
            r.multiplier = Math.min(5.0, 1.0 + (r.chargeTime / maxSecondsFor5x) * 4.0);
            if (Math.random() < 0.05) soundEngine.playScorePing();
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

        // Update HUD telemetry
        const maxSec = selectedDuration * 0.75;
        setP1Telemetry({
          mult: Number(p1Ref.current.multiplier.toFixed(2)),
          inZone: p1Ref.current.inZone,
          chargePercent: Math.min(100, Math.floor((p1Ref.current.chargeTime / maxSec) * 100)),
          heat: Math.floor(p1Ref.current.heat),
          overheated: p1Ref.current.overheated,
        });
        setP2Telemetry({
          mult: Number(p2Ref.current.multiplier.toFixed(2)),
          inZone: p2Ref.current.inZone,
          chargePercent: Math.min(100, Math.floor((p2Ref.current.chargeTime / maxSec) * 100)),
          heat: Math.floor(p2Ref.current.heat),
          overheated: p2Ref.current.overheated,
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

      // Floating Cartoon Clouds
      cloudsRef.current.forEach((c) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
        ctx.beginPath();
        const r = c.height / 2;
        ctx.arc(c.x + r, c.y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
        ctx.arc(c.x + c.width - r, c.y + r, r, (Math.PI * 3) / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
      });

      // CEILING OVERHEAT FRICTION ZONE (Anti-Camping Barrier)
      ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
      ctx.fillRect(0, 0, width, 46);

      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 46);
      ctx.lineTo(width, 46);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillStyle = "#EF4444";
      ctx.fillText("⚠️ IONOSPHERE FRICTION ZONE — OVERHEAT DANGER", 18, 20);

      // Current Price vs Strike Delta
      const currP = currentPriceRef.current;
      const strikeP = strikePriceRef.current;
      const isPriceBullish = currP >= strikeP;
      const deltaPercent = strikeP > 0 ? (((currP - strikeP) / strikeP) * 100).toFixed(2) : "0.00";

      // UPPER HALF: BULL TERRITORY
      if (isPriceBullish) {
        ctx.fillStyle = "rgba(20, 207, 28, 0.06)";
        ctx.fillRect(0, 46, width, strikeCenterY - 46);
      }

      // LOWER HALF: BEAR TERRITORY
      if (!isPriceBullish) {
        ctx.fillStyle = "rgba(255, 59, 48, 0.06)";
        ctx.fillRect(0, strikeCenterY, width, height - strikeCenterY);
      }

      // UPPER ZONE WATERMARK & LABEL
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = isPriceBullish ? "#059669" : "#94A3B8";
      ctx.fillText("▲ BULL ZONE (Wins if Price >= Strike)", 18, 65);
      if (isPriceBullish) {
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#059669";
        ctx.fillText(`⚡ CURRENTLY LEADING (+${deltaPercent}%)`, width - 210, 65);
      }

      // LOWER ZONE WATERMARK & LABEL
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = !isPriceBullish ? "#DC2626" : "#94A3B8";
      ctx.fillText("▼ BEAR ZONE (Wins if Price < Strike)", 18, height - 16);
      if (!isPriceBullish) {
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#DC2626";
        ctx.fillText(`⚡ CURRENTLY LEADING (${deltaPercent}%)`, width - 210, height - 16);
      }

      // HORIZONTAL STRIKE PRICE BARRIER
      ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(0, strikeCenterY);
      ctx.lineTo(width, strikeCenterY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Strike Price Badge
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

      // Render Enemies / Crypto Hazards
      obstaclesRef.current.forEach((obs) => {
        ctx.save();
        ctx.translate(obs.x, obs.y);

        // Hazard bubble surface
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = obs.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Icon
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(obs.icon, 0, 5);

        // Label
        ctx.font = "bold 8px system-ui, sans-serif";
        ctx.fillStyle = obs.color;
        ctx.fillText(obs.label, 0, obs.radius + 10);

        ctx.restore();
      });

      // Render Exhaust Particles
      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Render Rockets
      const renderRocket = (r: RocketState, x: number) => {
        ctx.save();
        ctx.translate(x, r.y);
        ctx.rotate((r.tilt * Math.PI) / 180);

        // Thruster flame if firing and not stalled
        if (r.thrusting && !r.overheated) {
          ctx.fillStyle = r.flameColor;
          ctx.beginPath();
          ctx.moveTo(-16, -4);
          ctx.lineTo(-30 - Math.random() * 8, 0);
          ctx.lineTo(-16, 4);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(-16, -2);
          ctx.lineTo(-24, 0);
          ctx.lineTo(-16, 2);
          ctx.closePath();
          ctx.fill();
        }

        // Active Zone aura
        if (r.inZone && !r.overheated) {
          ctx.strokeStyle = r.side === "BULL" ? "rgba(20, 207, 28, 0.6)" : "rgba(239, 68, 68, 0.6)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Rocket Body
        ctx.fillStyle = r.overheated ? "#94A3B8" : r.color;
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
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(2, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.stroke();

        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(r.avatar, 2, 4);

        // MINI ENGINE HEAT GAUGE (Overhead bar)
        const heatBarW = 28;
        const heatBarH = 3;
        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        ctx.fillRect(-14, -28, heatBarW, heatBarH);

        const heatFillW = (r.heat / 100) * heatBarW;
        ctx.fillStyle = r.overheated ? "#EF4444" : r.heat > 75 ? "#F59E0B" : "#10B981";
        ctx.fillRect(-14, -28, heatFillW, heatBarH);

        // Status Label above Rocket
        ctx.font = "bold 9px system-ui, sans-serif";
        if (r.overheated) {
          ctx.fillStyle = "#EF4444";
          ctx.fillText("🔥 STALLED!", 0, -33);
        } else {
          ctx.fillStyle = r.inZone ? (r.side === "BULL" ? "#059669" : "#DC2626") : "#64748B";
          const tagLabel = gameMode === "versus"
            ? `${r.name} [${r.side}]`
            : `${r.name} [${r.multiplier.toFixed(1)}x]`;
          ctx.fillText(tagLabel, 0, -33);
        }

        ctx.restore();
      };

      renderRocket(p1Ref.current, width * 0.28);
      renderRocket(p2Ref.current, width * 0.44);

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, gameMode, selectedAsset, selectedDuration]);

  // Pointer Handlers with Overheat Check
  const handleP1PointerDown = (e: React.PointerEvent) => {
    if (gameState !== "playing") return;
    const p1 = p1Ref.current;
    if (p1.overheated) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    p1.thrusting = true;
    soundEngine.startThrust(true);
  };

  const handleP1PointerUp = () => {
    p1Ref.current.thrusting = false;
    soundEngine.stopThrust();
  };

  const handleP2PointerDown = (e: React.PointerEvent) => {
    if (gameState !== "playing" || gameMode !== "versus") return;
    const p2 = p2Ref.current;
    if (p2.overheated) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    p2.thrusting = true;
    soundEngine.startThrust(false);
  };

  const handleP2PointerUp = () => {
    p2Ref.current.thrusting = false;
    if (gameMode === "versus") soundEngine.stopThrust();
  };

  const isFinalTenSeconds = timeLeft <= 10 && gameState === "playing";
  const livePriceDelta = strikePrice > 0 ? ((currentPrice - strikePrice) / strikePrice) * 100 : 0;
  const isDeltaPositive = livePriceDelta >= 0;
  const roundProgressPercent = Math.max(0, Math.min(100, ((selectedDuration - timeLeft) / selectedDuration) * 100));

  // P2P and Vault Economics
  const totalEscrowPot = (stakeMon * 2).toFixed(3);
  const p2pWinnerPayout = ((stakeMon * 2) * 0.975).toFixed(3);
  const soloMultiplierPayout = (stakeMon * p1Telemetry.mult).toFixed(3);

  // Sparkline SVG
  const sparklineSVG = useMemo(() => {
    if (!history || history.length === 0) return null;
    const prices = history.map((p) => p.price);
    const minP = Math.min(...prices, strikePrice, currentPrice);
    const maxP = Math.max(...prices, strikePrice, currentPrice);
    const range = maxP - minP || 1;
    const w = 480;
    const h = 70;
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
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14 overflow-visible" preserveAspectRatio="none">
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
        <circle cx={lastP.x} cy={lastP.y} r="7" fill={strokeColor} fillOpacity="0.2" />
      </svg>
    );
  }, [history, strikePrice, currentPrice, isDeltaPositive]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center select-none text-[#0B0B0B]">
      {/* 1. Top Navigation & Controls Bar */}
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

      {/* 2. MODE & HAZARD ALERT BANNER */}
      <div className={`w-full px-4 py-2 rounded-2xl mb-3 border text-center transition-all ${
        isFinalTenSeconds
          ? "bg-amber-50 border-amber-300 text-amber-900 shadow-md animate-pulse"
          : "bg-slate-50 border-black/[0.06] text-slate-700"
      }`}>
        <div className="text-xs font-semibold flex items-center justify-center gap-2 flex-wrap">
          {isFinalTenSeconds ? (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>FINAL 10s VOLATILITY: PYTH ORACLE SETTLES WINNER AT 00:00!</span>
            </>
          ) : (
            <>
              <span className="text-emerald-700 font-bold">P1 = BULL (UP)</span>
              <span className="text-slate-300">•</span>
              <span className="text-red-600 font-bold">P2 = BEAR (DOWN)</span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-700 font-medium">⚠️ Avoid flying hazards (📜 🕯️ ⛽) & don't overheat on the ceiling!</span>
            </>
          )}
        </div>
      </div>

      {/* 3. Live Price & Oracle Card */}
      <section className="w-full bg-white border border-black/[0.06] rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.035)] p-4 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          {/* Asset Selector */}
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
          <div className="flex items-baseline gap-4">
            <div className="text-right">
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Strike Baseline
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

        {/* Live Smooth Bézier Price Chart */}
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
              isFinalTenSeconds ? "bg-amber-500 animate-pulse" : "bg-[#836EF9]"
            }`}
            style={{ width: `${roundProgressPercent}%` }}
          />
        </div>

        {/* Floating Top HUD: P1, Match Timer, P2 */}
        <div className="absolute top-3 left-0 right-0 px-4 sm:px-6 flex items-center justify-between pointer-events-none">
          {/* Player 1 HUD Card */}
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border backdrop-blur-md transition-all shadow-sm ${
              p1Telemetry.overheated
                ? "bg-red-50/95 border-red-400 text-red-900 animate-pulse"
                : p1Telemetry.inZone
                ? "bg-white/95 border-emerald-400 text-slate-900 shadow-emerald-500/15"
                : "bg-white/85 border-black/[0.06] text-slate-800"
            }`}
          >
            <span className="text-xl">🟣</span>
            <div>
              <div className="text-[10px] font-bold text-[#6E4EF4] leading-none uppercase flex items-center gap-1">
                P1 • {p1Ref.current.side}
                {p1Telemetry.overheated && <span className="text-red-500 font-bold">STALLED</span>}
              </div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 flex items-center gap-1.5">
                {gameMode === "versus" ? (
                  <span>POT: {p2pWinnerPayout}M</span>
                ) : (
                  <>
                    {p1Telemetry.mult}x
                    <span className="text-[10px] font-normal text-slate-500 font-mono">
                      ({soloMultiplierPayout}M)
                    </span>
                  </>
                )}
              </div>
              {/* Heat bar */}
              <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    p1Telemetry.heat > 75 ? "bg-red-500" : p1Telemetry.heat > 50 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${p1Telemetry.heat}%` }}
                />
              </div>
            </div>
          </div>

          {/* Central Match Timer & Dynamic State */}
          <div className={`flex flex-col items-center px-4 py-1.5 rounded-2xl border backdrop-blur-md shadow-sm transition-all ${
            isFinalTenSeconds
              ? "bg-amber-500/15 border-amber-400/80 text-amber-950 scale-105"
              : "bg-white/90 border-black/[0.06] text-slate-900"
          }`}>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#6E4EF4]" />
              {selectedDuration}s Round • {isDeltaPositive ? "🟢 BULL LEADING" : "🔴 BEAR LEADING"}
            </div>
            <div
              className={`text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums ${
                isFinalTenSeconds ? "text-red-600 animate-pulse font-black" : "text-slate-900"
              }`}
            >
              00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </div>
          </div>

          {/* Player 2 / Opponent HUD Card */}
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border backdrop-blur-md transition-all shadow-sm ${
              p2Telemetry.overheated
                ? "bg-red-50/95 border-red-400 text-red-900 animate-pulse"
                : p2Telemetry.inZone
                ? "bg-white/95 border-emerald-400 text-slate-900 shadow-emerald-500/15"
                : "bg-white/85 border-black/[0.06] text-slate-800"
            }`}
          >
            <div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase text-right leading-none flex items-center justify-end gap-1">
                {p2Telemetry.overheated && <span className="text-red-500 font-bold">STALLED</span>}
                {gameMode === "solo" ? "HOUSE VAULT" : "P2 • " + p2Ref.current.side}
              </div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 flex items-center gap-1.5 justify-end">
                {gameMode === "versus" ? (
                  <span>POT: {p2pWinnerPayout}M</span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-600">
                    BANKER
                  </span>
                )}
              </div>
              {/* Heat bar */}
              <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden ml-auto">
                <div
                  className={`h-full transition-all ${
                    p2Telemetry.heat > 75 ? "bg-red-500" : p2Telemetry.heat > 50 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${p2Telemetry.heat}%` }}
                />
              </div>
            </div>
            <span className="text-xl">{gameMode === "solo" ? "🏦" : "🐸"}</span>
          </div>
        </div>

        {/* Start Overlay / Lobby Screen */}
        {gameState === "idle" && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="inline-flex p-3 rounded-2xl bg-[#836EF9]/10 text-[#6E4EF4] mb-2.5">
              <Flame className="w-7 h-7 text-[#836EF9]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1">
              Rocket Clash Arena
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-3 leading-relaxed">
              Dodge crypto hazards (📜 🕯️ ⛽), avoid ceiling engine stalls, and hold thrusters in your territory. At 00:00, Pyth Oracle settles the winning side!
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
                  <Users className="w-3.5 h-3.5 text-[#6E4EF4]" /> 1v1 P2P Duel
                </button>
                <button
                  onClick={() => setGameMode("solo")}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameMode === "solo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-amber-600" /> Solo vs House
                </button>
              </div>

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

              {/* Player Stance (Only in Solo Mode) */}
              {gameMode === "solo" && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <span className="text-[10px] font-medium text-slate-500 px-2">YOUR PREDICTION:</span>
                  <button
                    onClick={() => setPlayerStance("BULL")}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      playerStance === "BULL"
                        ? "bg-white text-[#14CF1C] shadow-sm font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-[#14CF1C]" />
                    BULL (UP)
                  </button>
                  <button
                    onClick={() => setPlayerStance("BEAR")}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      playerStance === "BEAR"
                        ? "bg-white text-[#FF3B30] shadow-sm font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5 text-[#FF3B30]" />
                    BEAR (DOWN)
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3 rounded-2xl bg-[#6E4EF4] hover:bg-[#5E3DE0] text-white font-semibold text-sm tracking-wide shadow-md shadow-purple-500/20 active:scale-[0.98] transition-all"
            >
              {gameMode === "versus" ? `Start 1v1 Clash (${selectedDuration}s)` : `Play Solo vs House (${selectedDuration}s)`}
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
              Pyth Oracle Final Settlement
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-1">
              {winner === "DRAW"
                ? "Exact Draw! ⚖️ Stakes Refunded"
                : winner === "P1"
                ? "P1 Won the Clash! 🎉"
                : gameMode === "versus"
                ? "P2 Won the Clash! 🐸"
                : "House Vault Won 💥"}
            </h3>

            <p className="text-xs text-slate-600 mb-4 font-mono">
              Strike: ${strikePrice.toFixed(2)} → Final: ${currentPrice.toFixed(2)} (
              <span className={winningSide === "BULL" ? "text-emerald-600 font-bold" : winningSide === "BEAR" ? "text-red-500 font-bold" : "text-slate-600"}>
                {winningSide === "BULL" ? "▲ BULL WON" : winningSide === "BEAR" ? "▼ BEAR WON" : "TIE"}
              </span>
              )
            </p>

            <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <div className="text-[10px] text-slate-500 font-mono">
                  {gameMode === "versus" ? "SETTLED POT" : "MULTIPLIER"}
                </div>
                <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                  {gameMode === "versus" ? `${totalEscrowPot} MON` : `${p1Ref.current.multiplier.toFixed(2)}x`}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <div className="text-[10px] text-slate-500 font-mono">WINNER PAYOUT</div>
                <div className="text-lg font-bold text-emerald-600 font-mono tabular-nums">
                  {winner === "DRAW"
                    ? `${stakeMon} MON (Refund)`
                    : winner === "P1"
                    ? gameMode === "versus"
                      ? `${p2pWinnerPayout} MON`
                      : `${soloMultiplierPayout} MON`
                    : gameMode === "versus"
                    ? `${p2pWinnerPayout} MON`
                    : "0.000 MON"}
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

      {/* 5. Direct Manipulation Controls */}
      <div className="w-full mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* P1 Controls Button */}
        <button
          onPointerDown={handleP1PointerDown}
          onPointerUp={handleP1PointerUp}
          onPointerLeave={handleP1PointerUp}
          onPointerCancel={handleP1PointerUp}
          className={`relative group p-4 rounded-2xl bg-white border transition-all flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.035)] cursor-pointer touch-none ${
            p1Telemetry.overheated
              ? "border-red-400 bg-red-50/50"
              : "border-black/[0.06] hover:border-black/[0.12] active:scale-[0.98]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
              p1Telemetry.overheated ? "bg-red-500/20" : "bg-[#836EF9]/15"
            }`}>
              {p1Telemetry.overheated ? "🔥" : "🟣"}
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-[#6E4EF4] flex items-center gap-1.5">
                <span>P1 ({p1Ref.current.side}) • Hold Thrusters</span>
                {p1Telemetry.overheated && <span className="text-red-500 text-[10px] font-bold">STALLED (COOLING)</span>}
              </div>
              <div className="text-xs font-mono text-slate-500">HOLD [SPACE] / [W] / TAP • Heat: {p1Telemetry.heat}%</div>
            </div>
          </div>
          <Flame className={`w-5 h-5 transition-transform ${
            p1Telemetry.overheated ? "text-red-500" : "text-amber-500 group-active:scale-125"
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
              p2Telemetry.overheated
                ? "border-red-400 bg-red-50/50"
                : "border-black/[0.06] hover:border-black/[0.12] active:scale-[0.98]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                p2Telemetry.overheated ? "bg-red-500/20" : "bg-emerald-500/15"
              }`}>
                {p2Telemetry.overheated ? "🔥" : "🐸"}
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <span>P2 ({p2Ref.current.side}) • Hold Thrusters</span>
                  {p2Telemetry.overheated && <span className="text-red-500 text-[10px] font-bold">STALLED (COOLING)</span>}
                </div>
                <div className="text-xs font-mono text-slate-500">HOLD [ARROW UP] / TAP • Heat: {p2Telemetry.heat}%</div>
              </div>
            </div>
            <Flame className={`w-5 h-5 transition-transform ${
              p2Telemetry.overheated ? "text-red-500" : "text-emerald-600 group-active:scale-125"
            }`} />
          </button>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-black/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl">
                🏦
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800">Protocol House Vault</div>
                <div className="text-xs text-slate-500 font-mono">Backing up to 5x multiplier payouts</div>
              </div>
            </div>
            <div className="text-[10px] font-mono px-2 py-1 rounded bg-amber-100 text-amber-800 font-semibold">
              LIQUIDITY ACTIVE
            </div>
          </div>
        )}
      </div>

      {/* 6. Gameplay Mechanics Info Cards */}
      <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Gauge className="w-3.5 h-3.5 text-[#6E4EF4]" />
            Engine Heat Management
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Holding thrusters continuously builds engine heat. If you hit 100%, the rocket stalls and drops into free fall!
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Anti-Camping Ionosphere
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Riding the top ceiling triggers atmospheric friction: the rocket bounces down and heat spikes dangerously.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Skull className="w-3.5 h-3.5 text-red-500" />
            Crypto Hazard Obstacles
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Dodge incoming Red Wicks (🕯️), SEC Subpoenas (📜), and MEV Snipers (⚡) that spin your rocket and drop your altitude.
          </p>
        </div>
      </div>
    </div>
  );
}
