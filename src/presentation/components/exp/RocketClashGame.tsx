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
  TrendingUp,
  TrendingDown,
  Radio,
  Clock,
  Coins,
  Shield,
  Percent,
  Sparkles,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { usePriceStream, SupportedAsset } from "@/infrastructure/price-feed/usePriceStream";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

type Stance = "LONG" | "SHORT";

interface SurferRocket {
  altitude: number;
  velocity: number;
  score: number;
  combo: number;
  stance: Stance;
  matchesTrend: boolean;
  accuracyTicks: number;
  totalTicks: number;
  name: string;
  avatar: string;
}

interface FloatingScore {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
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

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

interface AIBrain {
  currentStance: Stance;
  lastReactionTime: number;
  thought: string;
  reactionDelayMs: number;
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
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "gameover">("idle");
  const [countdown, setCountdown] = useState<number>(3);
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [winner, setWinner] = useState<"P1" | "P2" | "DRAW" | null>(null);

  // Price history and momentum tracking
  const [strikePrice, setStrikePrice] = useState<number>(currentPrice);
  const strikePriceRef = useRef<number>(currentPrice);
  const currentPriceRef = useRef<number>(currentPrice);
  const prevPriceRef = useRef<number>(currentPrice);
  const momentumRef = useRef<"PUMP" | "DUMP" | "FLAT">("FLAT");
  const [marketMomentum, setMarketMomentum] = useState<"PUMP" | "DUMP" | "FLAT">("FLAT");

  useEffect(() => {
    const prev = currentPriceRef.current;
    currentPriceRef.current = currentPrice;
    prevPriceRef.current = prev;

    if (gameState === "idle") {
      setStrikePrice(currentPrice);
      strikePriceRef.current = currentPrice;
    }

    if (currentPrice > prev + 0.0001) {
      momentumRef.current = "PUMP";
      setMarketMomentum("PUMP");
    } else if (currentPrice < prev - 0.0001) {
      momentumRef.current = "DUMP";
      setMarketMomentum("DUMP");
    }
  }, [currentPrice, gameState]);

  // Live HUD telemetry
  const [p1Telemetry, setP1Telemetry] = useState({
    score: 0,
    combo: 1.0,
    stance: "LONG" as Stance,
    matches: false,
    accuracy: 100,
  });
  const [p2Telemetry, setP2Telemetry] = useState({
    score: 0,
    combo: 1.0,
    stance: "SHORT" as Stance,
    matches: false,
    accuracy: 100,
  });
  const [aiThought, setAiThought] = useState<string>("Analyzing trend momentum... 📊");

  // Physics & Animation references
  const animFrameId = useRef<number>(0);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const p1Ref = useRef<SurferRocket>({
    altitude: 0,
    velocity: 15,
    score: 0,
    combo: 1.0,
    stance: "LONG",
    matchesTrend: false,
    accuracyTicks: 0,
    totalTicks: 0,
    name: "Gmonad Alpha",
    avatar: "🟣",
  });

  const p2Ref = useRef<SurferRocket>({
    altitude: 0,
    velocity: 15,
    score: 0,
    combo: 1.0,
    stance: "SHORT",
    matchesTrend: false,
    accuracyTicks: 0,
    totalTicks: 0,
    name: "MemeBot AI",
    avatar: "🤖",
  });

  const aiBrainRef = useRef<AIBrain>({
    currentStance: "SHORT",
    lastReactionTime: 0,
    thought: "Analyzing trend momentum... 📊",
    reactionDelayMs: 320,
  });

  const particlesRef = useRef<Particle[]>([]);
  const floatingScoresRef = useRef<FloatingScore[]>([]);
  const starsRef = useRef<Star[]>([]);

  // Sound toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Generate background stars
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * 880,
        y: Math.random() * 480,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.2,
      });
    }
    starsRef.current = stars;
  }, []);

  // Stance Switch Action (P1)
  const switchP1Stance = useCallback((newStance: Stance) => {
    if (gameState !== "playing") return;
    if (p1Ref.current.stance === newStance) return;

    p1Ref.current.stance = newStance;
    soundEngine.playStanceSwitchSound(newStance === "LONG");

    // Push switch particle burst
    const laneX = 880 * 0.32;
    for (let i = 0; i < 14; i++) {
      particlesRef.current.push({
        x: laneX + (Math.random() - 0.5) * 20,
        y: 280,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        size: Math.random() * 4 + 2,
        alpha: 1.0,
        color: newStance === "LONG" ? "#10B981" : "#EF4444",
      });
    }

    setP1Telemetry((prev) => ({ ...prev, stance: newStance }));
  }, [gameState]);

  // Stance Switch Action (P2 in Versus)
  const switchP2Stance = useCallback((newStance: Stance) => {
    if (gameState !== "playing" || gameMode !== "versus") return;
    if (p2Ref.current.stance === newStance) return;

    p2Ref.current.stance = newStance;
    soundEngine.playStanceSwitchSound(newStance === "LONG");
    setP2Telemetry((prev) => ({ ...prev, stance: newStance }));
  }, [gameState, gameMode]);

  // Keyboard controls with scroll prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "KeyA" ||
        e.code === "KeyD"
      ) {
        e.preventDefault();
      }

      if (gameState !== "playing") return;

      // P1 Controls
      if (e.code === "KeyA" || e.code === "ArrowLeft") {
        switchP1Stance("LONG");
      } else if (e.code === "KeyD" || e.code === "ArrowRight") {
        switchP1Stance("SHORT");
      } else if (e.code === "Space") {
        // Spacebar toggles stance
        const current = p1Ref.current.stance;
        switchP1Stance(current === "LONG" ? "SHORT" : "LONG");
      }

      // P2 Controls in Versus Mode
      if (gameMode === "versus") {
        if (e.code === "ArrowUp") {
          switchP2Stance("LONG");
        } else if (e.code === "ArrowDown") {
          switchP2Stance("SHORT");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, gameMode, switchP1Stance, switchP2Stance]);

  // Launch Round Sequence with 3-2-1 Countdown
  const startLaunchSequence = useCallback(() => {
    setWinner(null);
    setGameState("countdown");
    setCountdown(3);
    soundEngine.playCountdownBeep(false);

    // Lock strike price
    const lockedPrice = currentPriceRef.current;
    setStrikePrice(lockedPrice);
    strikePriceRef.current = lockedPrice;

    // Reset Surfers
    p1Ref.current = {
      altitude: 0,
      velocity: 15,
      score: 0,
      combo: 1.0,
      stance: "LONG",
      matchesTrend: false,
      accuracyTicks: 0,
      totalTicks: 0,
      name: "Gmonad Alpha",
      avatar: "🟣",
    };

    p2Ref.current = {
      altitude: 0,
      velocity: 15,
      score: 0,
      combo: 1.0,
      stance: "SHORT",
      matchesTrend: false,
      accuracyTicks: 0,
      totalTicks: 0,
      name: gameMode === "solo" ? "MemeBot AI" : "Rival Challenger",
      avatar: gameMode === "solo" ? "🤖" : "🐸",
    };

    aiBrainRef.current = {
      currentStance: "SHORT",
      lastReactionTime: 0,
      thought: "Analyzing initial price ticks... 📊",
      reactionDelayMs: 320,
    };

    particlesRef.current = [];
    floatingScoresRef.current = [];

    let c = 3;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      c--;
      if (c > 0) {
        setCountdown(c);
        soundEngine.playCountdownBeep(false);
      } else {
        clearInterval(countdownTimerRef.current!);
        setCountdown(0);
        soundEngine.playCountdownBeep(true);
        startActiveGame();
      }
    }, 1000);
  }, [gameMode]);

  // Active round timer
  const startActiveGame = () => {
    setGameState("playing");
    setTimeLeft(20);

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    let seconds = 20;
    roundTimerRef.current = setInterval(() => {
      seconds--;
      setTimeLeft(seconds);
      if (seconds <= 0) {
        clearInterval(roundTimerRef.current!);
        finalizeWinner();
      }
    }, 1000);
  };

  // Finalize round when timer expires
  const finalizeWinner = useCallback(() => {
    soundEngine.stopThrust();
    setGameState("gameover");

    const s1 = p1Ref.current.score;
    const s2 = p2Ref.current.score;

    if (s1 === s2) {
      setWinner("DRAW");
    } else if (s1 > s2) {
      setWinner("P1");
      soundEngine.playVictoryJingle();
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#6E4EF4", "#10B981", "#F59E0B"],
        });
      } catch (_) {}
    } else {
      setWinner("P2");
      soundEngine.playStallSound();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
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
    let scoreAccumulator = 0;

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const width = canvas.width;
      const height = canvas.height;

      const currP = currentPriceRef.current;
      const strikeP = strikePriceRef.current;
      const priceDeltaPercent = strikeP > 0 ? ((currP - strikeP) / strikeP) * 100 : 0;

      // 1. UPDATE PHYSICS & SCORING WHEN PLAYING
      if (gameState === "playing") {
        const p1 = p1Ref.current;
        const p2 = p2Ref.current;
        const brain = aiBrainRef.current;

        // Current real-time market trend
        // If overall delta from strike > 0, trend is LONG; if < 0, SHORT
        const activeTrend: Stance = priceDeltaPercent >= 0 ? "LONG" : "SHORT";

        // AI REFLEX LOGIC (Evaluates every 280-350ms, mimicking human visual reflex)
        if (gameMode === "solo" && time - brain.lastReactionTime > brain.reactionDelayMs) {
          brain.lastReactionTime = time;

          // AI follows the market trend with slight human-like hesitation / error rate
          const shouldFlip = p2.stance !== activeTrend;
          if (shouldFlip) {
            // 90% chance to flip correctly after delay
            if (Math.random() < 0.92) {
              p2.stance = activeTrend;
              brain.currentStance = activeTrend;
              brain.thought = activeTrend === "LONG" ? "PUMP DETECTED! Flipping LONG! 🟢" : "DUMP DETECTED! Flipping SHORT! 🔴";
            } else {
              brain.thought = "Fakeout candle?! Hesitating... 🤔";
            }
          } else {
            brain.thought = activeTrend === "LONG" ? "Riding the Bull Surge! 🚀" : "Surfing the Bear Dump! 🐻";
          }
          setAiThought(brain.thought);
        }

        // SCORING ENGINE (Ticks every 100ms)
        scoreAccumulator += dt;
        if (scoreAccumulator >= 0.1) {
          scoreAccumulator = 0;

          [p1, p2].forEach((r, idx) => {
            r.totalTicks += 1;
            const laneX = idx === 0 ? width * 0.32 : width * 0.68;

            if (r.stance === activeTrend) {
              r.matchesTrend = true;
              r.accuracyTicks += 1;

              // Build Combo
              r.combo = Math.min(3.0, Number((r.combo + 0.05).toFixed(2)));
              const pointsEarned = Math.round(10 * r.combo);
              r.score += pointsEarned;

              // Spawn floaty score text occasionally
              if (Math.random() < 0.25) {
                floatingScoresRef.current.push({
                  x: laneX + (Math.random() - 0.5) * 30,
                  y: height * 0.54,
                  text: `+${pointsEarned}`,
                  color: r.stance === "LONG" ? "#10B981" : "#EF4444",
                  alpha: 1.0,
                  vy: -40,
                });
                if (idx === 0) soundEngine.playScoreTickSound();
              }
            } else {
              r.matchesTrend = false;
              // Reset Combo on mismatch
              r.combo = 1.0;
            }
          });

          // Sync Telemetry for React UI
          setP1Telemetry({
            score: p1.score,
            combo: p1.combo,
            stance: p1.stance,
            matches: p1.matchesTrend,
            accuracy: p1.totalTicks > 0 ? Math.round((p1.accuracyTicks / p1.totalTicks) * 100) : 100,
          });

          setP2Telemetry({
            score: p2.score,
            combo: p2.combo,
            stance: p2.stance,
            matches: p2.matchesTrend,
            accuracy: p2.totalTicks > 0 ? Math.round((p2.accuracyTicks / p2.totalTicks) * 100) : 100,
          });
        }

        // UPDATE VELOCITY & ALTITUDE
        [p1, p2].forEach((r, idx) => {
          const laneX = idx === 0 ? width * 0.32 : width * 0.68;
          const targetVel = r.matchesTrend ? 55 * r.combo : 15;
          r.velocity += (targetVel - r.velocity) * Math.min(1, 5 * dt);
          r.altitude += r.velocity * dt;

          // Exhaust particles
          const color = r.stance === "LONG" ? "#10B981" : "#EF4444";
          particlesRef.current.push({
            x: laneX + (Math.random() - 0.5) * 12,
            y: height * 0.62 + 28,
            vx: (Math.random() - 0.5) * 16,
            vy: Math.random() * 40 + 40,
            size: Math.random() * 4 + 2,
            alpha: 0.85,
            color: r.matchesTrend ? color : "#94A3B8",
          });
        });
      }

      // 2. CANVAS RENDERING
      ctx.clearRect(0, 0, width, height);

      // Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#F8FAFC");
      bgGrad.addColorStop(1, "#F1F5F9");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render Moving Starfield / Speed lines
      const avgVel = gameState === "playing" ? (p1Ref.current.velocity + p2Ref.current.velocity) / 2 : 15;
      starsRef.current.forEach((s) => {
        s.y += (s.speed + avgVel * 0.08);
        if (s.y > height) {
          s.y = -10;
          s.x = Math.random() * width;
        }

        ctx.fillStyle = `rgba(148, 163, 184, ${s.opacity})`;
        ctx.beginPath();
        if (avgVel > 35) {
          ctx.rect(s.x, s.y, s.size, s.size + avgVel * 0.22);
        } else {
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        }
        ctx.fill();
      });

      // Racing Lanes Divider
      ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(width * 0.5, 0);
      ctx.lineTo(width * 0.5, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Lane Headers
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#64748B";
      ctx.fillText("LANE 1: YOU", width * 0.32, 28);
      ctx.fillText(gameMode === "solo" ? "LANE 2: MEMEBOT AI" : "LANE 2: RIVAL", width * 0.68, 28);

      // Update & Render Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= 2.0 * dt;
        p.size = Math.max(0.5, p.size - 2.5 * dt);

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Update & Render Floating Score Badges (+10, +20, etc.)
      for (let i = floatingScoresRef.current.length - 1; i >= 0; i--) {
        const fs = floatingScoresRef.current[i];
        fs.y += fs.vy * dt;
        fs.alpha -= 1.6 * dt;

        if (fs.alpha <= 0) {
          floatingScoresRef.current.splice(i, 1);
          continue;
        }

        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillStyle = fs.color;
        ctx.globalAlpha = fs.alpha;
        ctx.textAlign = "center";
        ctx.fillText(fs.text, fs.x, fs.y);
      }
      ctx.globalAlpha = 1.0;

      // Draw Surfer Rocket Sprites
      const renderSurferRocket = (r: SurferRocket, laneX: number) => {
        // Vertical dynamic altitude tilt: leader moves slightly higher
        const scoreDelta = r === p1Ref.current ? (p1Ref.current.score - p2Ref.current.score) : (p2Ref.current.score - p1Ref.current.score);
        const clampedDelta = Math.max(-120, Math.min(120, scoreDelta));
        const rocketY = height * 0.6 - (clampedDelta * 0.5);

        ctx.save();
        ctx.translate(laneX, rocketY);

        const isLong = r.stance === "LONG";
        const mainColor = isLong ? "#10B981" : "#EF4444";
        const accentColor = isLong ? "#059669" : "#DC2626";

        // Matching Aura Glow
        if (r.matchesTrend) {
          ctx.strokeStyle = isLong ? "rgba(16, 185, 129, 0.45)" : "rgba(239, 68, 68, 0.45)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(0, 0, 34, 48, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Thruster Flames
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(-10, 24);
        ctx.lineTo(0, 44 + Math.random() * (r.matchesTrend ? 18 : 8));
        ctx.lineTo(10, 24);
        ctx.closePath();
        ctx.fill();

        // Inner white flame core
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(-5, 24);
        ctx.lineTo(0, 34 + Math.random() * 8);
        ctx.lineTo(5, 24);
        ctx.closePath();
        ctx.fill();

        // Rocket Fuselage
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.moveTo(0, -32); // Tip
        ctx.quadraticCurveTo(18, -8, 14, 24);
        ctx.lineTo(-14, 24);
        ctx.quadraticCurveTo(-18, -8, 0, -32);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Fins (Horns for Bull / Spikes for Bear)
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(-14, 10);
        ctx.lineTo(-24, 24);
        ctx.lineTo(-12, 24);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(14, 10);
        ctx.lineTo(24, 24);
        ctx.lineTo(12, 24);
        ctx.closePath();
        ctx.fill();

        // Cockpit Glass & Avatar
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, -2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.stroke();

        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(r.avatar, 0, 3);

        // Active Stance Pill Badge above Rocket
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.roundRect(-42, -58, 84, 20, 10);
        ctx.fill();

        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(isLong ? "🟢 LONG (SUBE)" : "🔴 SHORT (BAJA)", 0, -44);

        // Matching indicator star
        if (r.matchesTrend) {
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.fillStyle = "#F59E0B";
          ctx.fillText(`🔥 ${r.combo.toFixed(1)}x COMBO`, 0, -66);
        } else {
          ctx.font = "bold 9px system-ui, sans-serif";
          ctx.fillStyle = "#94A3B8";
          ctx.fillText("MISMATCH (0 pts)", 0, -66);
        }

        // Floating Score Pill below Rocket
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-45, 34, 90, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#0F172A";
        ctx.fillText(`${r.score} PTS`, 0, 48);

        ctx.restore();
      };

      renderSurferRocket(p1Ref.current, width * 0.32);
      renderSurferRocket(p2Ref.current, width * 0.68);

      // AI Thought Bubble over AI Rocket
      if (gameMode === "solo" && gameState === "playing") {
        const brain = aiBrainRef.current;
        const aiLaneX = width * 0.68;
        const aiY = height * 0.34;

        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(aiLaneX - 90, aiY - 24, 180, 24, 12);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillStyle = "#1E293B";
        ctx.textAlign = "center";
        ctx.fillText(brain.thought, aiLaneX, aiY - 8);
        ctx.restore();
      }

      // Countdown Screen Overlay
      if (gameState === "countdown") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
        ctx.fillRect(0, 0, width, height);

        ctx.font = "bold 56px system-ui, sans-serif";
        ctx.fillStyle = "#6E4EF4";
        ctx.textAlign = "center";
        ctx.fillText(countdown > 0 ? String(countdown) : "SURF!", width * 0.5, height * 0.52);

        ctx.font = "bold 14px system-ui, sans-serif";
        ctx.fillStyle = "#475569";
        ctx.fillText("Match the market trend to stack combos!", width * 0.5, height * 0.62);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, gameMode, selectedAsset]);

  // Price delta helper
  const priceDelta = strikePrice > 0 ? currentPrice - strikePrice : 0;
  const priceDeltaPercent = strikePrice > 0 ? (priceDelta / strikePrice) * 100 : 0;

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-6 font-sans select-none">
      {/* 1. Header & Navigation */}
      <div className="w-full flex items-center justify-between mb-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors p-2 rounded-xl hover:bg-black/[0.04]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Arena</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-black/[0.06] shadow-sm text-xs font-medium text-slate-600">
            <Radio className={`w-3.5 h-3.5 ${isLive ? "text-emerald-500 animate-pulse" : "text-amber-500"}`} />
            <span>Pyth Oracle Live</span>
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

      {/* 2. Oracle Market Ribbon & Pot Banner */}
      <div className="w-full bg-white border border-black/[0.08] rounded-2xl p-4 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AssetLogo symbol={selectedAsset} size={32} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base">{selectedAsset}/USD</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                Strike: ${strikePrice.toFixed(selectedAsset === "BTC" ? 1 : 3)}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Now: ${currentPrice.toFixed(selectedAsset === "BTC" ? 1 : 3)}</span>
              <span
                className={`font-mono font-bold flex items-center gap-0.5 ${
                  priceDeltaPercent >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {priceDeltaPercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {priceDeltaPercent >= 0 ? "+" : ""}
                {priceDeltaPercent.toFixed(3)}%
              </span>
            </div>
          </div>
        </div>

        {/* Live Market Momentum Badge */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-50 border border-black/[0.04]">
          <div className="text-right">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Market Trend</div>
            <div
              className={`text-xs font-bold flex items-center gap-1 ${
                priceDeltaPercent >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {priceDeltaPercent >= 0 ? (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>🟢 PUMPING (Longs Score)</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4" />
                  <span>🔴 DUMPING (Shorts Score)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Escrow Pot & Protocol Rake */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#6E4EF4]/5 border border-[#6E4EF4]/15">
          <Coins className="w-5 h-5 text-[#6E4EF4]" />
          <div>
            <div className="text-[11px] font-semibold text-[#6E4EF4] uppercase tracking-wider">Escrow Pot (3.5% Rake)</div>
            <div className="text-xs font-bold text-slate-900 font-mono">
              {(stakeMon * 2).toFixed(2)} MON • Winner: {(stakeMon * 2 * 0.965).toFixed(4)} MON
            </div>
          </div>
        </div>
      </div>

      {/* 3. Game Settings (Pre-flight configuration) */}
      {gameState === "idle" && (
        <div className="w-full bg-white border border-black/[0.06] rounded-2xl p-4 mb-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Mode:</span>
            <button
              onClick={() => setGameMode("solo")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                gameMode === "solo"
                  ? "bg-[#6E4EF4] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Solo vs MemeBot AI</span>
            </button>
            <button
              onClick={() => setGameMode("versus")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                gameMode === "versus"
                  ? "bg-[#6E4EF4] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Local 2P Reflex Clash</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
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
            onClick={startLaunchSequence}
            className="px-6 py-2.5 rounded-xl bg-[#6E4EF4] text-white font-bold text-sm shadow-[0_2px_10px_rgba(110,78,244,0.3)] hover:bg-[#5b3ce0] active:scale-95 transition-all flex items-center gap-2 ml-auto"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>START DUEL (0.25 MON)</span>
          </button>
        </div>
      )}

      {/* 4. Canvas Arena */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] bg-slate-900">
        <canvas
          ref={canvasRef}
          width={880}
          height={480}
          className="w-full h-auto block touch-none"
        />

        {/* Live Timer Pill */}
        {gameState === "playing" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/95 border border-black/[0.1] shadow-md flex items-center gap-2 text-sm font-bold text-slate-900 font-mono">
            <Clock className="w-4 h-4 text-[#6E4EF4]" />
            <span>{timeLeft}s</span>
          </div>
        )}

        {/* Victory Game Over Banner */}
        {gameState === "gameover" && (
          <div className="absolute inset-0 bg-white/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-[#6E4EF4]/10 flex items-center justify-center text-3xl mb-3 shadow-inner">
              {winner === "P1" ? "🏆" : winner === "DRAW" ? "⚖️" : "🤖"}
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {winner === "P1" ? "VICTORY! YOU OUT-PREDICTED THE RIVAL" : winner === "DRAW" ? "DEAD HEAT TIE!" : "MEMEBOT AI WINS"}
            </h2>

            <p className="text-xs text-slate-500 max-w-sm mb-4">
              {winner === "P1"
                ? `You scored ${p1Telemetry.score} pts (${p1Telemetry.accuracy}% accuracy) vs rival's ${p2Telemetry.score} pts.`
                : winner === "DRAW"
                ? "Both players matched exact scores. Full escrow refunded."
                : `AI scored ${p2Telemetry.score} pts (${p2Telemetry.accuracy}% accuracy) vs your ${p1Telemetry.score} pts.`}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-black/[0.06] mb-5 flex items-center gap-6 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">YOUR SCORE</span>
                <span className="font-bold text-slate-900 text-sm">{p1Telemetry.score} pts</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px]">RIVAL SCORE</span>
                <span className="font-bold text-slate-900 text-sm">{p2Telemetry.score} pts</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px]">NET ESCROW PAYOUT</span>
                <span className="font-bold text-[#6E4EF4] text-sm">
                  {winner === "P1" ? `${(stakeMon * 2 * 0.965).toFixed(4)} MON` : "0.00 MON"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={startLaunchSequence}
                className="px-6 py-2.5 rounded-xl bg-[#6E4EF4] text-white font-bold text-sm hover:bg-[#5b3ce0] active:scale-95 transition-all shadow-md flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>PLAY AGAIN (REMATCH)</span>
              </button>
              <button
                onClick={() => setGameState("idle")}
                className="px-4 py-2.5 rounded-xl bg-white border border-black/[0.08] text-slate-700 font-medium text-sm hover:bg-slate-50 active:scale-95 transition-all"
              >
                Change Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Real-Time Stance Switch Buttons (The Core Gameplay!) */}
      <div className="w-full mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#6E4EF4]" />
            <span>Switch Stance in Real Time (Hotkeys: [A / ←] & [D / →] or [SPACE] to toggle)</span>
          </div>
          <div className="text-xs font-mono text-slate-500">
            Score: <span className="font-bold text-slate-900">{p1Telemetry.score} pts</span> • Combo:{" "}
            <span className="font-bold text-[#6E4EF4]">{p1Telemetry.combo.toFixed(1)}x</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* SUBE / LONG BUTTON */}
          <button
            onClick={() => switchP1Stance("LONG")}
            disabled={gameState !== "playing"}
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${
              p1Telemetry.stance === "LONG"
                ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                : "bg-white border-black/[0.08] hover:border-black/[0.15] opacity-75"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                  p1Telemetry.stance === "LONG"
                    ? "bg-emerald-600 text-white shadow-sm scale-105"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                🟢
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>SUBE (LONG)</span>
                  {p1Telemetry.stance === "LONG" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Press [A] or [←] • Scores during Bull Ticks
                </div>
              </div>
            </div>

            <ArrowUpRight
              className={`w-6 h-6 transition-transform ${
                p1Telemetry.stance === "LONG" ? "text-emerald-600 scale-125" : "text-slate-400"
              }`}
            />
          </button>

          {/* BAJA / SHORT BUTTON */}
          <button
            onClick={() => switchP1Stance("SHORT")}
            disabled={gameState !== "playing"}
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${
              p1Telemetry.stance === "SHORT"
                ? "bg-red-500/10 border-red-500 ring-2 ring-red-500/20 shadow-md"
                : "bg-white border-black/[0.08] hover:border-black/[0.15] opacity-75"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                  p1Telemetry.stance === "SHORT"
                    ? "bg-red-600 text-white shadow-sm scale-105"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                🔴
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>BAJA (SHORT)</span>
                  {p1Telemetry.stance === "SHORT" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Press [D] or [→] • Scores during Bear Dumps
                </div>
              </div>
            </div>

            <ArrowDownRight
              className={`w-6 h-6 transition-transform ${
                p1Telemetry.stance === "SHORT" ? "text-red-600 scale-125" : "text-slate-400"
              }`}
            />
          </button>
        </div>

        {/* Rival Stance Indicator / Versus Controls */}
        {gameMode === "versus" ? (
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              onClick={() => switchP2Stance("LONG")}
              disabled={gameState !== "playing"}
              className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                p2Telemetry.stance === "LONG"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white border-black/[0.08] text-slate-600"
              }`}
            >
              <span>P2: SUBE [↑]</span>
            </button>
            <button
              onClick={() => switchP2Stance("SHORT")}
              disabled={gameState !== "playing"}
              className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                p2Telemetry.stance === "SHORT"
                  ? "bg-red-600 text-white border-red-600 shadow-sm"
                  : "bg-white border-black/[0.08] text-slate-600"
              }`}
            >
              <span>P2: BAJA [↓]</span>
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-50 border border-black/[0.04] flex items-center justify-between mt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-base">
                🤖
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900">MemeBot AI Stance: </span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded ${
                    p2Telemetry.stance === "LONG" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {p2Telemetry.stance === "LONG" ? "🟢 SUBE (LONG)" : "🔴 BAJA (SHORT)"}
                </span>
                <span className="text-slate-500 ml-2 font-mono">• Score: {p2Telemetry.score} pts</span>
              </div>
            </div>
            <div className="text-xs font-mono text-slate-500 italic">
              &quot;{aiThought}&quot;
            </div>
          </div>
        )}
      </div>

      {/* 6. Game Economics & Rules */}
      <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Zero Paradojas (Reflex Score)
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Cambia entre SUBE y BAJA tantas veces como quieras. Gana quien acumule más puntos acertando los ticks de Pyth.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Flame className="w-3.5 h-3.5 text-[#6E4EF4]" />
            Multiplicador de Racha (x3)
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Mantener la postura correcta encadena combos de hasta x3. Si el mercado se da vuelta y no reaccionas, pierdes la racha.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Percent className="w-3.5 h-3.5 text-emerald-600" />
            3.5% Protocol Fee (Garantizado)
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pozo P2P de 0.50 MON. 0.0175 MON para la tesorería de Duelio en cada partida. 100% solvente y rentable.
          </p>
        </div>
      </div>
    </div>
  );
}
