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
  Coins,
  Shield,
  Percent,
  Flame,
  Radio,
  Clock,
  Sparkles,
  Award,
} from "lucide-react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { usePriceStream, SupportedAsset } from "@/infrastructure/price-feed/usePriceStream";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

// Deterministic PRNG (Mulberry32) to generate identical seeded tracks (Skillz model)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ObstaclePipe {
  id: number;
  x: number;
  topHeight: number;
  gapHeight: number;
  width: number;
  hasCoin: boolean;
  coinY: number;
  coinCollectedP1: boolean;
  coinCollectedP2: boolean;
  passedP1: boolean;
  passedP2: boolean;
  isBullish: boolean;
}

interface FlappyRocket {
  x: number;
  y: number;
  vy: number;
  tilt: number;
  isDead: boolean;
  score: number;
  pipesCleared: number;
  coinsCollected: number;
  distanceTraveled: number;
  name: string;
  avatar: string;
  color: string;
  flameColor: string;
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

interface CoinSparkle {
  x: number;
  y: number;
  alpha: number;
  text: string;
}

export function RocketClashGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Asset selection & Price Stream
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("MON");
  const priceState = usePriceStream(selectedAsset);
  const { currentPrice, isLive } = priceState;

  // Game Settings & State
  const [gameMode, setGameMode] = useState<"solo" | "versus">("solo");
  const [stakeMon, setStakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "gameover">("idle");
  const [countdown, setCountdown] = useState<number>(3);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [matchSeed, setMatchSeed] = useState<number>(1337);
  const [winner, setWinner] = useState<"P1" | "P2" | "DRAW" | null>(null);

  // Live HUD telemetry
  const [p1Telemetry, setP1Telemetry] = useState({ score: 0, pipes: 0, coins: 0, isDead: false });
  const [p2Telemetry, setP2Telemetry] = useState({ score: 0, pipes: 0, coins: 0, isDead: false });

  // Physics References
  const animFrameId = useRef<number>(0);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const worldSpeedRef = useRef<number>(2.4);

  const p1Ref = useRef<FlappyRocket>({
    x: 120,
    y: 220,
    vy: 0,
    tilt: 0,
    isDead: false,
    score: 0,
    pipesCleared: 0,
    coinsCollected: 0,
    distanceTraveled: 0,
    name: "Gmonad Alpha",
    avatar: "🟣",
    color: "#836EF9",
    flameColor: "#FF6B00",
  });

  const p2Ref = useRef<FlappyRocket>({
    x: 160,
    y: 220,
    vy: 0,
    tilt: 0,
    isDead: false,
    score: 0,
    pipesCleared: 0,
    coinsCollected: 0,
    distanceTraveled: 0,
    name: "MemeBot AI",
    avatar: "🤖",
    color: "#10B981",
    flameColor: "#059669",
  });

  const pipesRef = useRef<ObstaclePipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const coinSparklesRef = useRef<CoinSparkle[]>([]);

  // Sound toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Generate Seeded Track (Deterministic Obstacle Course)
  const generateCourse = useCallback((seed: number) => {
    const prng = mulberry32(seed);
    const pipes: ObstaclePipe[] = [];
    const totalPipes = 35;
    const startX = 480;
    const spacing = 240;
    const pipeWidth = 54;
    const gapHeight = 138;

    for (let i = 0; i < totalPipes; i++) {
      // Top height between 60 and 260px
      const topHeight = Math.floor(prng() * 190) + 60;
      const isBullish = prng() > 0.5;
      const hasCoin = prng() > 0.35; // 65% of gaps have collectible Monad coin

      pipes.push({
        id: i + 1,
        x: startX + i * spacing,
        topHeight,
        gapHeight,
        width: pipeWidth,
        hasCoin,
        coinY: topHeight + gapHeight * 0.5,
        coinCollectedP1: false,
        coinCollectedP2: false,
        passedP1: false,
        passedP2: false,
        isBullish,
      });
    }

    pipesRef.current = pipes;
  }, []);

  // Player 1 Flap Action
  const handleP1Flap = useCallback(() => {
    if (gameState !== "playing" || p1Ref.current.isDead) return;
    p1Ref.current.vy = -6.8;
    soundEngine.playFlapSound();

    // Spawn mini thrust puff
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x: p1Ref.current.x - 14,
        y: p1Ref.current.y + (Math.random() - 0.5) * 6,
        vx: -(Math.random() * 20 + 15),
        vy: (Math.random() - 0.5) * 10,
        size: Math.random() * 4 + 2,
        alpha: 0.9,
        color: "#FF6B00",
      });
    }
  }, [gameState]);

  // Player 2 Flap Action (Versus mode)
  const handleP2Flap = useCallback(() => {
    if (gameState !== "playing" || gameMode !== "versus" || p2Ref.current.isDead) return;
    p2Ref.current.vy = -6.8;
    soundEngine.playFlapSound();
  }, [gameState, gameMode]);

  // Keyboard controls with scroll prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
      }

      if (e.code === "Space" || e.code === "KeyW") {
        handleP1Flap();
      }

      if (e.code === "ArrowUp" && gameMode === "versus") {
        handleP2Flap();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleP1Flap, handleP2Flap, gameMode]);

  // Start Countdown Sequence
  const startMatchCountdown = useCallback(() => {
    setWinner(null);
    setGameState("countdown");
    setCountdown(3);
    soundEngine.playCountdownBeep(false);

    // Derive deterministic seed for this match
    const newSeed = Math.floor(Math.random() * 1000000) + 1;
    setMatchSeed(newSeed);
    generateCourse(newSeed);

    // Reset Rockets
    p1Ref.current = {
      x: 120,
      y: 220,
      vy: 0,
      tilt: 0,
      isDead: false,
      score: 0,
      pipesCleared: 0,
      coinsCollected: 0,
      distanceTraveled: 0,
      name: "Gmonad Alpha",
      avatar: "🟣",
      color: "#836EF9",
      flameColor: "#FF6B00",
    };

    p2Ref.current = {
      x: 155,
      y: 220,
      vy: 0,
      tilt: 0,
      isDead: false,
      score: 0,
      pipesCleared: 0,
      coinsCollected: 0,
      distanceTraveled: 0,
      name: gameMode === "solo" ? "MemeBot AI" : "Rival Challenger",
      avatar: gameMode === "solo" ? "🤖" : "🐸",
      color: "#10B981",
      flameColor: "#059669",
    };

    particlesRef.current = [];
    coinSparklesRef.current = [];

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
        setGameState("playing");
      }
    }, 1000);
  }, [generateCourse, gameMode]);

  // Finalize Match & Crown Winner
  const finalizeMatch = useCallback(() => {
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
          spread: 75,
          origin: { y: 0.6 },
          colors: ["#6E4EF4", "#10B981", "#F59E0B"],
        });
      } catch (_) {}
    } else {
      setWinner("P2");
      soundEngine.playStallSound();
    }
  }, []);

  // Main Canvas Game Loop
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
      const speed = worldSpeedRef.current;

      // 1. UPDATE PHYSICS & GAMEPLAY
      if (gameState === "playing") {
        const p1 = p1Ref.current;
        const p2 = p2Ref.current;
        const gravity = 0.36;

        // Move Pipes Leftward
        let allPipesOffscreen = true;
        pipesRef.current.forEach((pipe) => {
          pipe.x -= speed;
          if (pipe.x + pipe.width > 0) {
            allPipesOffscreen = false;
          }

          // --- P1 Collision & Scoring ---
          if (!p1.isDead) {
            // Check pipe pass (+100 pts)
            if (!pipe.passedP1 && pipe.x + pipe.width < p1.x) {
              pipe.passedP1 = true;
              p1.pipesCleared += 1;
              p1.score += 100;
            }

            // Check Monad Coin Pickup (+50 pts)
            if (pipe.hasCoin && !pipe.coinCollectedP1) {
              const coinX = pipe.x + pipe.width * 0.5;
              const distCoin = Math.hypot(p1.x - coinX, p1.y - pipe.coinY);
              if (distCoin < 24) {
                pipe.coinCollectedP1 = true;
                p1.coinsCollected += 1;
                p1.score += 50;
                soundEngine.playCoinSound();
                coinSparklesRef.current.push({
                  x: coinX,
                  y: pipe.coinY,
                  alpha: 1.0,
                  text: "+50 MON COIN",
                });
              }
            }

            // Hitbox Check against Top and Bottom pipes
            const rocketRadius = 14;
            const inPipeX = p1.x + rocketRadius > pipe.x && p1.x - rocketRadius < pipe.x + pipe.width;
            if (inPipeX) {
              const hitTop = p1.y - rocketRadius < pipe.topHeight;
              const hitBottom = p1.y + rocketRadius > pipe.topHeight + pipe.gapHeight;
              if (hitTop || hitBottom) {
                p1.isDead = true;
                soundEngine.playExplosionSound();
                // Spawn crash debris
                for (let i = 0; i < 20; i++) {
                  particlesRef.current.push({
                    x: p1.x,
                    y: p1.y,
                    vx: (Math.random() - 0.5) * 60,
                    vy: (Math.random() - 0.5) * 60,
                    size: Math.random() * 5 + 2,
                    alpha: 1.0,
                    color: Math.random() > 0.5 ? "#EF4444" : "#836EF9",
                  });
                }
              }
            }
          }

          // --- P2 AI (or Versus Player) Collision & Scoring ---
          if (!p2.isDead) {
            // Check pipe pass
            if (!pipe.passedP2 && pipe.x + pipe.width < p2.x) {
              pipe.passedP2 = true;
              p2.pipesCleared += 1;
              p2.score += 100;
            }

            // Check Coin Pickup
            if (pipe.hasCoin && !pipe.coinCollectedP2) {
              const coinX = pipe.x + pipe.width * 0.5;
              const distCoin = Math.hypot(p2.x - coinX, p2.y - pipe.coinY);
              if (distCoin < 24) {
                pipe.coinCollectedP2 = true;
                p2.coinsCollected += 1;
                p2.score += 50;
              }
            }

            // Hitbox Check
            const rocketRadius = 14;
            const inPipeX = p2.x + rocketRadius > pipe.x && p2.x - rocketRadius < pipe.x + pipe.width;
            if (inPipeX) {
              const hitTop = p2.y - rocketRadius < pipe.topHeight;
              const hitBottom = p2.y + rocketRadius > pipe.topHeight + pipe.gapHeight;
              if (hitTop || hitBottom) {
                p2.isDead = true;
                soundEngine.playHitSound();
              }
            }
          }
        });

        // SOLO MODE: MEMEBOT AI LOOKAHEAD BEHAVIOR
        if (gameMode === "solo" && !p2.isDead) {
          // Find next approaching pipe
          const nextPipe = pipesRef.current.find((p) => p.x + p.width > p2.x - 20);
          if (nextPipe) {
            const targetCenterY = nextPipe.topHeight + nextPipe.gapHeight * 0.5;
            // AI flaps when dipping below gap center with high human-like precision
            if (p2.y > targetCenterY + 10 && p2.vy >= 0) {
              p2.vy = -6.8;
            }
          } else {
            // Hover in middle if no pipes ahead
            if (p2.y > height * 0.5 && p2.vy >= 0) {
              p2.vy = -6.8;
            }
          }
        }

        // Apply Rocket Physics
        [p1, p2].forEach((r) => {
          if (!r.isDead) {
            r.vy += gravity;
            r.y += r.vy;
            r.distanceTraveled += speed;
            r.score += 0.2; // Continuous survival points

            // Tilt angle
            r.tilt = Math.max(-25, Math.min(65, r.vy * 4.5));

            // Boundary collision (Floor / Ceiling)
            if (r.y > height - 24 || r.y < 16) {
              r.isDead = true;
              soundEngine.playExplosionSound();
            }
          } else {
            // Dead rocket tumbles down
            if (r.y < height + 40) {
              r.vy += gravity * 1.5;
              r.y += r.vy;
              r.tilt = Math.min(90, r.tilt + 6);
            }
          }
        });

        // Sync Telemetry
        setP1Telemetry({
          score: Math.floor(p1.score),
          pipes: p1.pipesCleared,
          coins: p1.coinsCollected,
          isDead: p1.isDead,
        });
        setP2Telemetry({
          score: Math.floor(p2.score),
          pipes: p2.pipesCleared,
          coins: p2.coinsCollected,
          isDead: p2.isDead,
        });

        // Check Match Termination Condition:
        // 1. Both rockets crashed, OR
        // 2. All 35 pipes completed
        if ((p1.isDead && p2.isDead) || allPipesOffscreen) {
          finalizeMatch();
        }
      }

      // 2. CANVAS RENDERING (Apple Light Mode Aesthetic)
      ctx.clearRect(0, 0, width, height);

      // Background Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#F8FAFC");
      skyGrad.addColorStop(1, "#EFF6FF");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Distant Grid Lines (Crypto Chart Grid)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.035)";
      ctx.lineWidth = 1;
      for (let y = 40; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Render Candlestick Obstacle Pipes
      pipesRef.current.forEach((pipe) => {
        if (pipe.x + pipe.width < -20 || pipe.x > width + 20) return;

        const mainColor = pipe.isBullish ? "#10B981" : "#EF4444";
        const darkAccent = pipe.isBullish ? "#059669" : "#DC2626";

        // Top Pipe (From ceiling down to topHeight)
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.roundRect(pipe.x, 0, pipe.width, pipe.topHeight, [0, 0, 8, 8]);
        ctx.fill();
        ctx.strokeStyle = darkAccent;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Top Pipe Cap Lip
        ctx.fillStyle = darkAccent;
        ctx.beginPath();
        ctx.roundRect(pipe.x - 3, pipe.topHeight - 16, pipe.width + 6, 16, 4);
        ctx.fill();

        // Bottom Pipe (From topHeight + gapHeight to floor)
        const bottomY = pipe.topHeight + pipe.gapHeight;
        const bottomH = height - bottomY;
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.roundRect(pipe.x, bottomY, pipe.width, bottomH, [8, 8, 0, 0]);
        ctx.fill();
        ctx.strokeStyle = darkAccent;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Bottom Pipe Cap Lip
        ctx.fillStyle = darkAccent;
        ctx.beginPath();
        ctx.roundRect(pipe.x - 3, bottomY, pipe.width + 6, 16, 4);
        ctx.fill();

        // Candle Wick Lines (Top and Bottom)
        ctx.strokeStyle = darkAccent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pipe.x + pipe.width * 0.5, 0);
        ctx.lineTo(pipe.x + pipe.width * 0.5, pipe.topHeight);
        ctx.moveTo(pipe.x + pipe.width * 0.5, bottomY);
        ctx.lineTo(pipe.x + pipe.width * 0.5, height);
        ctx.stroke();

        // Collectible Monad Coin inside Gap
        if (pipe.hasCoin && !pipe.coinCollectedP1) {
          ctx.save();
          ctx.translate(pipe.x + pipe.width * 0.5, pipe.coinY);
          // Gold coin body
          ctx.fillStyle = "#F59E0B";
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#D97706";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Coin text
          ctx.font = "bold 9px monospace";
          ctx.fillStyle = "#FFFFFF";
          ctx.textAlign = "center";
          ctx.fillText("M", 0, 3);
          ctx.restore();
        }
      });

      // Render Floor
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(0, height - 12, width, 12);
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height - 12);
      ctx.lineTo(width, height - 12);
      ctx.stroke();

      // Render Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= 1.8 * dt;

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

      // Render Floating Coin Sparkles
      for (let i = coinSparklesRef.current.length - 1; i >= 0; i--) {
        const cs = coinSparklesRef.current[i];
        cs.y -= 25 * dt;
        cs.alpha -= 1.4 * dt;

        if (cs.alpha <= 0) {
          coinSparklesRef.current.splice(i, 1);
          continue;
        }

        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillStyle = "#D97706";
        ctx.globalAlpha = cs.alpha;
        ctx.textAlign = "center";
        ctx.fillText(cs.text, cs.x, cs.y);
      }
      ctx.globalAlpha = 1.0;

      // Draw Flappy Rockets
      const renderRocketSprite = (r: FlappyRocket, isP2: boolean) => {
        if (r.y > height + 50) return;

        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate((r.tilt * Math.PI) / 180);

        // If P2 in Solo, render with transparent shadow style
        if (isP2 && gameMode === "solo") {
          ctx.globalAlpha = 0.78;
        }

        // Thruster flame
        if (!r.isDead && r.vy < 0) {
          ctx.fillStyle = r.flameColor;
          ctx.beginPath();
          ctx.moveTo(-16, -4);
          ctx.lineTo(-28 - Math.random() * 8, 0);
          ctx.lineTo(-16, 4);
          ctx.closePath();
          ctx.fill();
        }

        // Rocket Fuselage
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Rocket Nosecone
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(12, -7);
        ctx.lineTo(22, 0);
        ctx.lineTo(12, 7);
        ctx.closePath();
        ctx.fill();

        // Cockpit Glass & Avatar
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(2, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.stroke();

        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(r.avatar, 2, 4);

        // Player Tag above Rocket
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillStyle = r.isDead ? "#EF4444" : "#1E293B";
        ctx.fillText(r.isDead ? "💥 CRASH" : r.name, 0, -18);

        ctx.restore();
        ctx.globalAlpha = 1.0;
      };

      // Draw P2 first, then P1 in front
      renderRocketSprite(p2Ref.current, true);
      renderRocketSprite(p1Ref.current, false);

      // Countdown Screen Overlay
      if (gameState === "countdown") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
        ctx.fillRect(0, 0, width, height);

        ctx.font = "bold 56px system-ui, sans-serif";
        ctx.fillStyle = "#6E4EF4";
        ctx.textAlign = "center";
        ctx.fillText(countdown > 0 ? String(countdown) : "FLAP!", width * 0.5, height * 0.52);

        ctx.font = "bold 14px system-ui, sans-serif";
        ctx.fillStyle = "#475569";
        ctx.fillText("Press [SPACE] or Tap Screen to Flap!", width * 0.5, height * 0.62);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, gameMode, finalizeMatch]);

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

      {/* 2. Skillz Model Ribbon & Escrow Pot */}
      <div className="w-full bg-white border border-black/[0.08] rounded-2xl p-4 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AssetLogo symbol={selectedAsset} size={32} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base">{selectedAsset}/USD Match</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-[#6E4EF4] font-mono font-semibold">
                Seed #{matchSeed}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Skillz-Model: Identical Obstacles & Physics for Both Players</span>
            </div>
          </div>
        </div>

        {/* Live Score Counter */}
        <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-slate-50 border border-black/[0.04]">
          <div>
            <div className="text-[10px] font-semibold text-slate-400">YOU (P1)</div>
            <div className="text-sm font-bold text-slate-900 font-mono">{p1Telemetry.score} pts</div>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <div className="text-[10px] font-semibold text-slate-400">{gameMode === "solo" ? "MEMEBOT AI" : "RIVAL"}</div>
            <div className="text-sm font-bold text-slate-900 font-mono">{p2Telemetry.score} pts</div>
          </div>
        </div>

        {/* Escrow Pot & Protocol Rake */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#6E4EF4]/5 border border-[#6E4EF4]/15">
          <Coins className="w-5 h-5 text-[#6E4EF4]" />
          <div>
            <div className="text-[11px] font-semibold text-[#6E4EF4] uppercase tracking-wider">Escrow Pot (5.0% Rake)</div>
            <div className="text-xs font-bold text-slate-900 font-mono">
              {(stakeMon * 2).toFixed(2)} MON • Winner: {(stakeMon * 2 * 0.95).toFixed(4)} MON
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
              <span>Local 2P Flappy Clash</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Asset Theme:</span>
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
            onClick={startMatchCountdown}
            className="px-6 py-2.5 rounded-xl bg-[#6E4EF4] text-white font-bold text-sm shadow-[0_2px_10px_rgba(110,78,244,0.3)] hover:bg-[#5b3ce0] active:scale-95 transition-all flex items-center gap-2 ml-auto"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>ENTER DUEL (0.25 MON)</span>
          </button>
        </div>
      )}

      {/* 4. Flappy Canvas Arena */}
      <div
        onClick={handleP1Flap}
        className="relative w-full rounded-2xl overflow-hidden border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] bg-slate-900 cursor-pointer"
      >
        <canvas
          ref={canvasRef}
          width={880}
          height={480}
          className="w-full h-auto block touch-none"
        />

        {/* Victory Game Over Banner */}
        {gameState === "gameover" && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 bg-white/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#6E4EF4]/10 flex items-center justify-center text-3xl mb-3 shadow-inner">
              {winner === "P1" ? "🏆" : winner === "DRAW" ? "⚖️" : "🤖"}
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {winner === "P1" ? "VICTORY! YOU OUT-SURVIVED THE RIVAL" : winner === "DRAW" ? "DEAD HEAT TIE!" : "MEMEBOT AI WINS"}
            </h2>

            <p className="text-xs text-slate-500 max-w-sm mb-4">
              {winner === "P1"
                ? `You scored ${p1Telemetry.score} pts (${p1Telemetry.pipes} pipes, ${p1Telemetry.coins} coins) vs rival's ${p2Telemetry.score} pts.`
                : winner === "DRAW"
                ? "Both players matched scores. Full escrow refunded."
                : `AI scored ${p2Telemetry.score} pts vs your ${p1Telemetry.score} pts.`}
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
                  {winner === "P1" ? `${(stakeMon * 2 * 0.95).toFixed(4)} MON` : "0.00 MON"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={startMatchCountdown}
                className="px-6 py-2.5 rounded-xl bg-[#6E4EF4] text-white font-bold text-sm hover:bg-[#5b3ce0] active:scale-95 transition-all shadow-md flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>PLAY AGAIN (NEW SEED)</span>
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

      {/* 5. Flap Button & Mobile Controls */}
      <div className="w-full mt-4 flex flex-col gap-3">
        <button
          onClick={handleP1Flap}
          disabled={gameState !== "playing" || p1Telemetry.isDead}
          className={`w-full py-4 rounded-2xl bg-white border border-black/[0.08] shadow-sm hover:border-[#6E4EF4] active:scale-[0.99] transition-all flex items-center justify-between px-6 cursor-pointer touch-none ${
            p1Telemetry.isDead ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#6E4EF4]/10 text-[#6E4EF4] flex items-center justify-center text-2xl font-bold">
              🚀
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-900">
                TAP OR PRESS [SPACE] TO FLAP
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Clear Candlestick Pipes (+100 pts) • Collect Monad Coins (+50 pts)
              </div>
            </div>
          </div>

          <Flame className="w-6 h-6 text-[#6E4EF4]" />
        </button>

        {gameMode === "versus" && (
          <button
            onClick={handleP2Flap}
            disabled={gameState !== "playing" || p2Telemetry.isDead}
            className="w-full py-3 rounded-2xl bg-slate-50 border border-black/[0.06] text-slate-700 font-bold text-xs flex items-center justify-center gap-2"
          >
            <span>P2: PRESS [ARROW UP] TO FLAP</span>
          </button>
        )}
      </div>

      {/* 6. Skillz Economic & Fair Play Rules */}
      <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Shield className="w-3.5 h-3.5 text-[#6E4EF4]" />
            Identical Shared Seed
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ambos jugadores navegan exactamente la misma pista generada por la semilla #{matchSeed}. Cero suerte, 100% habilidad.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Award className="text-amber-500 w-3.5 h-3.5" />
            Puntuación Skillz
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            +100 pts por cada vela superada, +50 pts por Monad Coin y puntos continuos por supervivencia y distancia.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Percent className="w-3.5 h-3.5 text-emerald-600" />
            5.0% Protocol Rake Garantizado
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pozo P2P de 0.50 MON. 0.025 MON de comisión fija para Duelio. La casa nunca arriesga capital propio.
          </p>
        </div>
      </div>
    </div>
  );
}
