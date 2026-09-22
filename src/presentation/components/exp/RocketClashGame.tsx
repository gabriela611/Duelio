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
  Sparkles,
  Flame,
  Activity,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { usePriceStream, SupportedAsset } from "@/infrastructure/price-feed/usePriceStream";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

interface TrajectoryPoint {
  x: number;
  y: number;
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
}

interface ResolvedRound {
  roundNumber: number;
  openPrice: number;
  closePrice: number;
  marketOutcome: "UP" | "DOWN" | "DRAW";
  p1FinalZone: "UP" | "DOWN";
  p2FinalZone: "UP" | "DOWN";
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
  const [stakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "gameover">("idle");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [matchWinner, setMatchWinner] = useState<"P1" | "P2" | "DRAW" | null>(null);

  // 4-Round Match State (5s per round = 20s match)
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [roundTimeLeft, setRoundTimeLeft] = useState<number>(5.0);
  const [p1Score, setP1Score] = useState<number>(0);
  const [p2Score, setP2Score] = useState<number>(0);
  const [resolvedRounds, setResolvedRounds] = useState<ResolvedRound[]>([]);

  // Telemetry HUD state
  const [p1CurrentZone, setP1CurrentZone] = useState<"UP" | "DOWN">("UP");
  const [p2CurrentZone, setP2CurrentZone] = useState<"UP" | "DOWN">("DOWN");
  const [currentDeltaPct, setCurrentDeltaPct] = useState<number>(0);
  const [aiThought, setAiThought] = useState<string>("Reading market tape... 📊");

  // Round prices
  const roundOpenPriceRef = useRef<number>(currentPrice);
  const currentPriceRef = useRef<number>(currentPrice);
  const [, setRoundOpenPrice] = useState<number>(currentPrice);

  useEffect(() => {
    currentPriceRef.current = currentPrice;
    if (gameState === "playing") {
      const openP = roundOpenPriceRef.current;
      if (openP > 0) {
        const delta = ((currentPrice - openP) / openP) * 100;
        setCurrentDeltaPct(delta);
      }
    }
  }, [currentPrice, gameState]);

  // Physics & Animation refs
  const animFrameId = useRef<number>(0);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const screenShakeRef = useRef<number>(0);

  // Physical Rocket States (Hold-to-Thrust physics as in cc62825)
  const p1Ref = useRef({
    x: 140,
    y: 210,
    vy: 0,
    thrusting: false,
    tilt: 0,
    flameColor: "#6E4EF4",
  });

  const p2Ref = useRef({
    x: 140,
    y: 210,
    vy: 0,
    thrusting: false,
    tilt: 0,
    flameColor: "#10B981",
  });

  // Trajectory history for drawing arrows
  const p1TrailRef = useRef<TrajectoryPoint[]>([]);
  const p2TrailRef = useRef<TrajectoryPoint[]>([]);
  const pythTrailRef = useRef<TrajectoryPoint[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Sound toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Keyboard controls: Hold to thrust UP, release to drop DOWN
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") {
        e.preventDefault();
        if (gameState === "playing" && !p1Ref.current.thrusting) {
          p1Ref.current.thrusting = true;
          soundEngine.startThrust(true);
        }
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        if (gameState === "playing") {
          p1Ref.current.thrusting = false;
          soundEngine.stopThrust();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") {
        e.preventDefault();
        if (p1Ref.current.thrusting) {
          p1Ref.current.thrusting = false;
          soundEngine.stopThrust();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  // Touch & Pointer controls for mobile & mouse
  const handleP1ThrustStart = () => {
    if (gameState !== "playing") return;
    p1Ref.current.thrusting = true;
    soundEngine.startThrust(true);
  };

  const handleP1ThrustEnd = () => {
    p1Ref.current.thrusting = false;
    soundEngine.stopThrust();
  };

  // Start 4-Round Blitz Match
  const startMatch = useCallback(() => {
    setMatchWinner(null);
    setGameState("countdown");
    setResolvedRounds([]);
    setCurrentRound(1);
    setP1Score(0);
    setP2Score(0);
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
    soundEngine.stopThrust();

    // Snapshot Open Price
    const openP = currentPriceRef.current;
    roundOpenPriceRef.current = openP;
    setRoundOpenPrice(openP);

    // Reset rocket positions and trails to starting gate
    p1Ref.current.x = 140;
    p1Ref.current.y = 210;
    p1Ref.current.vy = 0;
    p1Ref.current.thrusting = false;
    p1Ref.current.tilt = 0;

    p2Ref.current.x = 140;
    p2Ref.current.y = 210;
    p2Ref.current.vy = 0;
    p2Ref.current.thrusting = false;
    p2Ref.current.tilt = 0;

    p1TrailRef.current = [{ x: 140, y: 210 }];
    p2TrailRef.current = [{ x: 140, y: 210 }];
    pythTrailRef.current = [{ x: 140, y: 210 }];

    // AI Prediction Decision in Solo mode
    if (gameMode === "solo") {
      setAiThought("Calibrating thruster trajectory... 👀");
      const aiTargetUp = Math.random() > 0.48;
      setTimeout(() => {
        setAiThought(
          aiTargetUp
            ? "Momentum spike! Steering UP 🟢↗️"
            : "Resistance wall! Steering DOWN 🔴↘️"
        );
      }, 1000);
    }

    // 5.0-second round clock
    let timeLeftMs = 5000;
    const intervalTime = 100;

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    roundTimerRef.current = setInterval(() => {
      timeLeftMs -= intervalTime;
      const secLeft = Number((timeLeftMs / 1000).toFixed(1));
      setRoundTimeLeft(secLeft);

      // AI Bot Thrust Logic: steers its rocket to target zone
      if (gameMode === "solo") {
        const p2 = p2Ref.current;
        const currentDelta =
          roundOpenPriceRef.current > 0
            ? ((currentPriceRef.current - roundOpenPriceRef.current) / roundOpenPriceRef.current) * 100
            : 0;

        // Bot reads trend with subtle jitter
        const targetZoneY = currentDelta >= 0 ? 130 : 290;
        if (p2.y > targetZoneY + 12) {
          p2.thrusting = true;
        } else if (p2.y < targetZoneY - 12) {
          p2.thrusting = false;
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

  // Evaluate Round Result at 5s
  const resolveRound = (roundNum: number, currentP1Score: number, currentP2Score: number) => {
    const openP = roundOpenPriceRef.current;
    const closeP = currentPriceRef.current;
    const baselineY = 210;

    let marketOutcome: "UP" | "DOWN" | "DRAW" = "DRAW";
    if (closeP > openP) marketOutcome = "UP";
    else if (closeP < openP) marketOutcome = "DOWN";

    // Did P1 arrow end up above or below the baseline?
    const p1FinalZone: "UP" | "DOWN" = p1Ref.current.y < baselineY ? "UP" : "DOWN";
    const p2FinalZone: "UP" | "DOWN" = p2Ref.current.y < baselineY ? "UP" : "DOWN";

    const p1Won = marketOutcome !== "DRAW" && p1FinalZone === marketOutcome;
    const p2Won = marketOutcome !== "DRAW" && p2FinalZone === marketOutcome;

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

    const roundResult: ResolvedRound = {
      roundNumber: roundNum,
      openPrice: openP,
      closePrice: closeP,
      marketOutcome,
      p1FinalZone,
      p2FinalZone,
      p1Won,
      p2Won,
    };

    setResolvedRounds((prev) => [...prev, roundResult]);

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
          particleCount: 95,
          spread: 80,
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

  // Main 60fps Canvas Loop: Hold-to-Thrust Arrow Physics + Pyth Trajectory
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
      const baselineY = height * 0.5; // 210px

      // Screen shake
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

      // Subtle background grid lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.035)";
      ctx.lineWidth = 1;
      for (let y = 30; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. CHECKPOINT TRACK (Top of Canvas)
      const trackY = 44;
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

      // 3. TARGET QUADRANTS (Upper: SUBE 🟢 / Lower: BAJA 🔴)
      // Upper SUBE Tint
      ctx.fillStyle = "rgba(16, 185, 129, 0.03)";
      ctx.fillRect(30, 75, width - 60, baselineY - 75);

      // Lower BAJA Tint
      ctx.fillStyle = "rgba(239, 68, 68, 0.03)";
      ctx.fillRect(30, baselineY, width - 60, height - 100);

      // Strike Price Reference Baseline
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(30, baselineY);
      ctx.lineTo(width - 30, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Baseline Price Badge
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(30, baselineY - 11, 120, 22, 5);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 9.5px monospace";
      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.fillText(
        `OPEN: $${roundOpenPriceRef.current.toFixed(selectedAsset === "BTC" ? 1 : 2)}`,
        90,
        baselineY + 4
      );

      // Quadrant Watermark Labels
      ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(16, 185, 129, 0.6)";
      ctx.textAlign = "right";
      ctx.fillText("🟢 SUBE (BULL ZONE)", width - 40, baselineY - 45);

      ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
      ctx.fillText("🔴 BAJA (BEAR ZONE)", width - 40, baselineY + 55);

      // 4. PHYSICS UPDATE DURING ACTIVE ROUND
      if (gameState === "playing") {
        const startX = 140;
        const finishX = width - 100;
        const progress = Math.min(1.0, (5.0 - roundTimeLeft) / 5.0);
        const currentX = startX + progress * (finishX - startX);

        // Update P1 Hold-to-Thrust Physics (as in cc62825)
        const gravity = 0.38;
        const thrust = -0.78;

        const p1 = p1Ref.current;
        p1.x = currentX;

        if (p1.thrusting) {
          p1.vy += thrust;
          // Spawn exhaust particles
          for (let i = 0; i < 2; i++) {
            particlesRef.current.push({
              x: p1.x - 24,
              y: p1.y + (Math.random() - 0.5) * 6,
              vx: -4 - Math.random() * 2,
              vy: (Math.random() - 0.5) * 2,
              life: 0,
              maxLife: 16,
              color: Math.random() > 0.3 ? "#6E4EF4" : "#38BDF8",
              size: 2.5 + Math.random() * 2,
            });
          }
        } else {
          p1.vy += gravity;
        }

        p1.vy *= 0.96; // air damping
        p1.y += p1.vy;

        // Arena vertical clamp
        if (p1.y < 85) {
          p1.y = 85;
          p1.vy = 0;
        } else if (p1.y > height - 35) {
          p1.y = height - 35;
          p1.vy = 0;
        }

        p1.tilt = Math.max(-28, Math.min(28, p1.vy * 3.2));
        p1TrailRef.current.push({ x: p1.x, y: p1.y });
        setP1CurrentZone(p1.y < baselineY ? "UP" : "DOWN");

        // Update P2 (MemeBot AI) Physics
        const p2 = p2Ref.current;
        p2.x = currentX;

        if (p2.thrusting) {
          p2.vy += thrust;
          for (let i = 0; i < 2; i++) {
            particlesRef.current.push({
              x: p2.x - 24,
              y: p2.y + (Math.random() - 0.5) * 6,
              vx: -4 - Math.random() * 2,
              vy: (Math.random() - 0.5) * 2,
              life: 0,
              maxLife: 16,
              color: "#10B981",
              size: 2.5 + Math.random() * 2,
            });
          }
        } else {
          p2.vy += gravity;
        }

        p2.vy *= 0.96;
        p2.y += p2.vy;

        if (p2.y < 85) {
          p2.y = 85;
          p2.vy = 0;
        } else if (p2.y > height - 35) {
          p2.y = height - 35;
          p2.vy = 0;
        }

        p2.tilt = Math.max(-28, Math.min(28, p2.vy * 3.2));
        p2TrailRef.current.push({ x: p2.x, y: p2.y });
        setP2CurrentZone(p2.y < baselineY ? "UP" : "DOWN");

        // Update Real-Time Pyth Oracle Price Ribbon
        const openP = roundOpenPriceRef.current;
        const currP = currentPriceRef.current;
        const delta = openP > 0 ? ((currP - openP) / openP) * 100 : 0;
        const targetPythY = baselineY - delta * 450;
        const clampedPythY = Math.max(85, Math.min(height - 35, targetPythY));
        pythTrailRef.current.push({ x: currentX, y: clampedPythY });
      }

      // 5. DRAW PYTH ORACLE BENCHMARK SPLINE
      if (pythTrailRef.current.length > 1) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        pythTrailRef.current.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Live Pyth Price Pin
        const lastPt = pythTrailRef.current[pythTrailRef.current.length - 1];
        ctx.fillStyle = currentDeltaPct >= 0 ? "#10B981" : "#EF4444";
        ctx.beginPath();
        ctx.arc(lastPt.x, lastPt.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 9px monospace";
        ctx.fillText(
          `${currentDeltaPct >= 0 ? "+" : ""}${currentDeltaPct.toFixed(3)}%`,
          lastPt.x + 8,
          lastPt.y + 3
        );
      }

      // 6. DRAW P2 (RIVAL) TRAJECTORY ARROW RIBBON
      if (p2TrailRef.current.length > 1) {
        ctx.strokeStyle = "rgba(15, 23, 42, 0.4)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        p2TrailRef.current.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      }

      // 7. DRAW P1 (PLAYER) TRAJECTORY ARROW RIBBON
      if (p1TrailRef.current.length > 1) {
        const isUp = p1Ref.current.y < baselineY;
        const ribbonColor = isUp ? "#10B981" : "#EF4444";

        const ribbonGrad = ctx.createLinearGradient(140, 0, p1Ref.current.x, 0);
        ribbonGrad.addColorStop(0, "rgba(110, 78, 244, 0.3)");
        ribbonGrad.addColorStop(1, ribbonColor);

        ctx.strokeStyle = ribbonGrad;
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        p1TrailRef.current.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      }

      // 8. RENDER PARTICLES
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

      // 9. HELPER TO DRAW VECTOR ROCKET WITH ARROWHEAD
      const renderSpaceship = (
        r: { x: number; y: number; tilt: number; thrusting: boolean },
        colorPrimary: string,
        colorSecondary: string,
        label: string,
        isP1: boolean
      ) => {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate((r.tilt * Math.PI) / 180);

        // Thruster flame
        if (r.thrusting) {
          const flameLength = 16 + Math.random() * 10;
          ctx.fillStyle = isP1 ? "#6E4EF4" : "#10B981";
          ctx.beginPath();
          ctx.moveTo(-18, -4);
          ctx.lineTo(-18 - flameLength, 0);
          ctx.lineTo(-18, 4);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(-18, -2);
          ctx.lineTo(-18 - flameLength * 0.5, 0);
          ctx.lineTo(-18, 2);
          ctx.closePath();
          ctx.fill();
        }

        // Soft drop shadow
        ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        // Fuselage Body
        ctx.fillStyle = colorPrimary;
        ctx.beginPath();
        ctx.moveTo(22, 0); // Nose cone
        ctx.lineTo(4, -8);
        ctx.lineTo(-16, -11);
        ctx.lineTo(-14, -4);
        ctx.lineTo(-18, -3);
        ctx.lineTo(-18, 3);
        ctx.lineTo(-14, 4);
        ctx.lineTo(-16, 11);
        ctx.lineTo(4, 8);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = "transparent";

        // Cockpit Glass
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.ellipse(4, 0, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Label Badge Floating Above Rocket
        ctx.restore();
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.fillStyle = colorSecondary;
        ctx.beginPath();
        ctx.roundRect(-30, -26, 60, 15, 3);
        ctx.fill();

        ctx.font = "bold 8px system-ui, sans-serif";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(label, 0, -15);
        ctx.restore();
      };

      // Render P2 (Rival) Rocket
      renderSpaceship(
        p2Ref.current,
        "#0F172A",
        "#1E293B",
        `${gameMode === "solo" ? "MEMEBOT" : "RIVAL"}`,
        false
      );

      // Render P1 (Player) Rocket
      renderSpaceship(
        p1Ref.current,
        "#6E4EF4",
        "#4F46E5",
        `YOU (${p1CurrentZone === "UP" ? "SUBE 🟢" : "BAJA 🔴"})`,
        true
      );

      ctx.restore();
      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [
    gameState,
    currentRound,
    roundTimeLeft,
    p1CurrentZone,
    p2CurrentZone,
    currentDeltaPct,
    selectedAsset,
    gameMode,
  ]);

  const totalPot = (stakeMon * 2).toFixed(2);
  const netPayout = (stakeMon * 2 * 0.95).toFixed(4);

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-6 font-sans select-none text-slate-900">
      {/* 1. Top Navigation & Oracle Status */}
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
            <span>Pyth Hermes Real-Time Stream</span>
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

      {/* 3. Canvas Arrow Prediction Arena */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] bg-white">
        <canvas
          ref={canvasRef}
          width={880}
          height={420}
          className="w-full h-auto block touch-none cursor-pointer"
          onPointerDown={handleP1ThrustStart}
          onPointerUp={handleP1ThrustEnd}
          onPointerLeave={handleP1ThrustEnd}
        />

        {/* Live Round Timer */}
        {gameState === "playing" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/95 border border-black/[0.08] shadow-sm flex items-center gap-2 text-xs font-bold text-slate-800 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#6E4EF4]" />
            <span>ROUND {currentRound} • {roundTimeLeft}s LEFT</span>
          </div>
        )}

        {/* Pre-Match Overlay */}
        {gameState === "idle" && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#6E4EF4]/10 text-[#6E4EF4] flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1.5">
              Rocket Clash: 4-Round Arrow Prediction
            </h2>

            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              4 asaltos de 5s. Mantén presionado `[Espacio]` o `[↑]` para subir a la zona 🟢 SUBE o suelta para caer a 🔴 BAJA. ¡Dibuja tu flecha y acierta hacia dónde cierra la vela de Pyth!
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
              Start 4-Round Arrow Match (0.25 MON)
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
                ? "Victory! You Out-Predicted the Market 🏆"
                : matchWinner === "P2"
                ? "Rival Won the Arrow Showdown 🤖"
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

      {/* 4. Live Telemetry & Quadrant Posture */}
      {gameState === "playing" && (
        <div className="w-full mt-3 grid grid-cols-3 gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200/60 flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-[#6E4EF4]" />
            <div>
              <div className="text-[10px] font-semibold text-purple-600 uppercase">Your Arrow Posture</div>
              <div className="text-xs font-bold font-mono">
                {p1CurrentZone === "UP" ? (
                  <span className="text-emerald-600 font-black">🟢 SUBE (BULL)</span>
                ) : (
                  <span className="text-rose-600 font-black">🔴 BAJA (BEAR)</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-black/[0.06] flex items-center gap-2.5 text-center justify-center">
            <Activity className="w-4 h-4 text-slate-500" />
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Pyth Price Delta</div>
              <div className="text-xs font-bold font-mono">
                {currentDeltaPct >= 0 ? (
                  <span className="text-emerald-600 font-black">+{currentDeltaPct.toFixed(3)}% 🟢</span>
                ) : (
                  <span className="text-rose-600 font-black">{currentDeltaPct.toFixed(3)}% 🔴</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-black/[0.06] flex items-center gap-2.5">
            <div className="w-4 h-4 text-slate-600 text-xs">🤖</div>
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Rival Arrow Posture</div>
              <div className="text-xs font-bold font-mono">
                {p2CurrentZone === "UP" ? (
                  <span className="text-emerald-600 font-black">🟢 SUBE (BULL)</span>
                ) : (
                  <span className="text-rose-600 font-black">🔴 BAJA (BEAR)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Physical Hold-to-Thrust Interactive Touch Bar */}
      <div className="w-full mt-3 flex flex-col gap-2">
        <button
          onPointerDown={handleP1ThrustStart}
          onPointerUp={handleP1ThrustEnd}
          onPointerLeave={handleP1ThrustEnd}
          disabled={gameState !== "playing"}
          className={`w-full py-5 px-6 rounded-2xl border transition-all flex items-center justify-between cursor-pointer select-none active:scale-[0.99] ${
            p1Ref.current.thrusting
              ? "bg-[#6E4EF4] text-white border-[#6E4EF4] shadow-lg shadow-purple-600/30 ring-4 ring-purple-500/20"
              : "bg-white border-black/[0.1] text-slate-800 hover:border-black/[0.2]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all ${
                p1Ref.current.thrusting ? "bg-white text-[#6E4EF4]" : "bg-purple-50 text-[#6E4EF4]"
              }`}
            >
              <ArrowUp className="w-6 h-6" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold flex items-center gap-2">
                <span>MANTÉN PULSADO PARA SUBIR 🟢 • SUELTA PARA BAJAR 🔴</span>
              </div>
              <div className="text-xs opacity-75 font-mono">
                Teclas: [Espacio] / [W] / [↑] para propulsar hacia arriba • Suelta o [↓] para descender
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs font-bold">
            {p1Ref.current.thrusting ? (
              <span className="px-3 py-1 rounded-full bg-white/20 text-white animate-pulse">
                PROPULSORES ACTIVOS (SUBIENDO)
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                PLANEO / GRAVEDAD (BAJANDO)
              </span>
            )}
          </div>
        </button>
      </div>

      {/* 6. Apple Design System Rules & Economics Cards */}
      <div className="w-full mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Flame className="w-3.5 h-3.5 text-[#6E4EF4]" />
            Control Físico Hold-to-Thrust
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Mantén pulsado para volar hacia arriba y soltar para descender. Tú dibujas activamente la trayectoria de tu flecha.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            4 Asaltos de 5 Segundos
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            En cada asalto, si tu flecha termina en el cuadrante hacia donde cerró el precio real de Pyth, ganas el asalto.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Percent className="w-3.5 h-3.5 text-[#6E4EF4]" />
            5.0% Protocol Rake Garantizado
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pozo P2P de 0.50 MON. 0.025 MON fijo a la tesorería de Duelio. 0.475 MON directo al ganador del duelo.
          </p>
        </div>
      </div>
    </div>
  );
}
