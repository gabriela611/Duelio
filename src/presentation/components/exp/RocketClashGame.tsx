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
  TrendingUp,
  TrendingDown,
  Radio,
  Clock,
  Coins,
  CheckCircle2,
  XCircle,
  Shield,
  Percent,
  Gauge,
  Sparkles,
} from "lucide-react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { usePriceStream, SupportedAsset } from "@/infrastructure/price-feed/usePriceStream";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";

interface SurfRocket {
  altitude: number; // in meters (0 to infinity)
  velocity: number; // vertical speed m/s
  fuel: number; // 0 to 100%
  isBoosting: boolean;
  isStalled: boolean;
  stallTimeLeft: number;
  isSurfing: boolean;
  name: string;
  avatar: string;
  color: string;
  flameColor: string;
  side: "BULL" | "BEAR";
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
  state: "ANALYZING" | "SURFING" | "RECHARGING" | "CHASING" | "FINAL_SPRINT";
  thought: string;
  lastDecisionTime: number;
  boostTarget: boolean;
}

type MatchDuration = 15 | 30;

export function RocketClashGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Asset selection & Price Stream
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("MON");
  const priceState = usePriceStream(selectedAsset);
  const { currentPrice, isLive } = priceState;

  // Game settings & state
  const [gameMode, setGameMode] = useState<"versus" | "solo">("solo");
  const [selectedDuration, setSelectedDuration] = useState<MatchDuration>(15);
  const [playerSide, setPlayerSide] = useState<"BULL" | "BEAR">("BULL");
  const [stakeMon, setStakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "countdown" | "playing" | "gameover">("idle");
  const [countdown, setCountdown] = useState<number>(3);
  const [timeLeft, setTimeLeft] = useState<number>(15);
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

  // Live HUD telemetry for React rendering
  const [p1Telemetry, setP1Telemetry] = useState({ altitude: 0, fuel: 100, isBoosting: false, isSurfing: false, isStalled: false });
  const [p2Telemetry, setP2Telemetry] = useState({ altitude: 0, fuel: 100, isBoosting: false, isSurfing: false, isStalled: false });
  const [aiThought, setAiThought] = useState<string>("Analyzing chart... 📊");

  // Physics references
  const animFrameId = useRef<number>(0);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const p1Ref = useRef<SurfRocket>({
    altitude: 0,
    velocity: 0,
    fuel: 100,
    isBoosting: false,
    isStalled: false,
    stallTimeLeft: 0,
    isSurfing: false,
    name: "Gmonad Alpha",
    avatar: "🟣",
    color: "#836EF9",
    flameColor: "#FF6B00",
    side: "BULL",
  });

  const p2Ref = useRef<SurfRocket>({
    altitude: 0,
    velocity: 0,
    fuel: 100,
    isBoosting: false,
    isStalled: false,
    stallTimeLeft: 0,
    isSurfing: false,
    name: "MemeBot AI",
    avatar: "🤖",
    color: "#EF4444",
    flameColor: "#DC2626",
    side: "BEAR",
  });

  const aiBrainRef = useRef<AIBrain>({
    state: "ANALYZING",
    thought: "Watching candle ticks... 👀",
    lastDecisionTime: 0,
    boostTarget: false,
  });

  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);

  // Sound toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Generate background stars / dust particles
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 45; i++) {
      stars.push({
        x: Math.random() * 800,
        y: Math.random() * 450,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 1.5 + 0.8,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }
    starsRef.current = stars;
  }, []);

  // Keyboard controls with spacebar scroll prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
      }

      if (gameState !== "playing") return;

      if (e.code === "Space" || e.code === "KeyW") {
        const p1 = p1Ref.current;
        if (!p1.isBoosting && !p1.isStalled && p1.fuel > 5) {
          p1.isBoosting = true;
          soundEngine.startThrust(true);
        }
      }

      if (e.code === "ArrowUp" && gameMode === "versus") {
        const p2 = p2Ref.current;
        if (!p2.isBoosting && !p2.isStalled && p2.fuel > 5) {
          p2.isBoosting = true;
          soundEngine.startThrust(false);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
      }

      if (e.code === "Space" || e.code === "KeyW") {
        p1Ref.current.isBoosting = false;
        soundEngine.stopThrust();
      }

      if (e.code === "ArrowUp" && gameMode === "versus") {
        p2Ref.current.isBoosting = false;
        soundEngine.stopThrust();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState, gameMode]);

  // Launch Round Sequence with 3-2-1 Countdown
  const startLaunchSequence = useCallback(() => {
    setWinner(null);
    setGameState("countdown");
    setCountdown(3);
    soundEngine.playCountdownBeep(false);

    // Freeze strike price at exact launch start
    const lockedPrice = currentPriceRef.current;
    setStrikePrice(lockedPrice);
    strikePriceRef.current = lockedPrice;

    // Configure roles
    const p1Side = playerSide;
    const p2Side = p1Side === "BULL" ? "BEAR" : "BULL";

    p1Ref.current = {
      altitude: 0,
      velocity: 0,
      fuel: 100,
      isBoosting: false,
      isStalled: false,
      stallTimeLeft: 0,
      isSurfing: false,
      name: "Gmonad Alpha",
      avatar: p1Side === "BULL" ? "🐂" : "🐻",
      color: p1Side === "BULL" ? "#10B981" : "#EF4444",
      flameColor: "#FF6B00",
      side: p1Side,
    };

    p2Ref.current = {
      altitude: 0,
      velocity: 0,
      fuel: 100,
      isBoosting: false,
      isStalled: false,
      stallTimeLeft: 0,
      isSurfing: false,
      name: gameMode === "solo" ? "MemeBot AI" : "Rival Challenger",
      avatar: gameMode === "solo" ? (p2Side === "BULL" ? "🐂" : "🤖") : "🐸",
      color: p2Side === "BULL" ? "#10B981" : "#EF4444",
      flameColor: p2Side === "BULL" ? "#059669" : "#DC2626",
      side: p2Side,
    };

    aiBrainRef.current = {
      state: "ANALYZING",
      thought: "Analyzing market delta... 📊",
      lastDecisionTime: 0,
      boostTarget: false,
    };

    particlesRef.current = [];

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
  }, [playerSide, gameMode]);

  // Active round loop
  const startActiveGame = () => {
    setGameState("playing");
    setTimeLeft(selectedDuration);

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    let seconds = selectedDuration;
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

    const alt1 = p1Ref.current.altitude;
    const alt2 = p2Ref.current.altitude;

    if (Math.abs(alt1 - alt2) < 2) {
      setWinner("DRAW");
    } else if (alt1 > alt2) {
      setWinner("P1");
      soundEngine.playVictoryJingle();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
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

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const width = canvas.width;
      const height = canvas.height;

      const currP = currentPriceRef.current;
      const strikeP = strikePriceRef.current;
      const priceDeltaPercent = strikeP > 0 ? ((currP - strikeP) / strikeP) * 100 : 0;

      // 1. UPDATE PHYSICS & AI (WHEN PLAYING)
      if (gameState === "playing") {
        const p1 = p1Ref.current;
        const p2 = p2Ref.current;
        const brain = aiBrainRef.current;

        // AI FINITE STATE MACHINE (Evaluates every 220ms, NOT 60 times a second!)
        if (gameMode === "solo" && time - brain.lastDecisionTime > 220) {
          brain.lastDecisionTime = time;

          const aiSide = p2.side;
          const marketFavorsAI = (aiSide === "BULL" && priceDeltaPercent > 0.015) || (aiSide === "BEAR" && priceDeltaPercent < -0.015);
          const aiBehindBy = p1.altitude - p2.altitude;

          // AI State Decisions
          if (p2.isStalled || p2.fuel < 15) {
            brain.state = "RECHARGING";
            brain.thought = "Recharging nitro... ⛽";
            brain.boostTarget = false;
          } else if (timeLeft <= 3.5 && p2.fuel > 10) {
            brain.state = "FINAL_SPRINT";
            brain.thought = "ALL IN! FINAL SPRINT! 🔥";
            brain.boostTarget = true;
          } else if (marketFavorsAI && p2.fuel > 25) {
            brain.state = "SURFING";
            brain.thought = "Surfing the crypto wave! 🌊";
            brain.boostTarget = true;
          } else if (aiBehindBy > 30 && p2.fuel > 35) {
            brain.state = "CHASING";
            brain.thought = "Gotta close the gap! ⚡";
            brain.boostTarget = true;
          } else {
            brain.state = "ANALYZING";
            brain.thought = "Pacing boost reserves... 👀";
            brain.boostTarget = false;
          }

          p2.isBoosting = brain.boostTarget;
          setAiThought(brain.thought);
        }

        // UPDATE BOTH ROCKETS
        [p1, p2].forEach((r) => {
          // Check Stall Status
          if (r.isStalled) {
            r.isBoosting = false;
            r.stallTimeLeft -= dt;
            if (r.stallTimeLeft <= 0) {
              r.isStalled = false;
              r.fuel = 20; // Starts recovery
            }
          }

          // Market Surf Detection (Pyth Oracle integration)
          const marketFavors = (r.side === "BULL" && priceDeltaPercent > 0.01) || (r.side === "BEAR" && priceDeltaPercent < -0.01);
          r.isSurfing = r.isBoosting && marketFavors;

          // Fuel Consumption & Regeneration
          if (r.isBoosting && !r.isStalled) {
            r.fuel = Math.max(0, r.fuel - 24 * dt);
            if (r.fuel <= 0) {
              r.isStalled = true;
              r.stallTimeLeft = 1.3;
              r.isBoosting = false;
              soundEngine.playStallSound();
            }
          } else if (!r.isStalled && r.fuel < 100) {
            r.fuel = Math.min(100, r.fuel + 32 * dt);
          }

          // Thrust Forces
          let targetAccel = 6.0; // Base ambient drift
          if (r.isBoosting) {
            // Surfing gives massive 2.2x speed boost + audio chirp
            const boostMultiplier = r.isSurfing ? 2.2 : 1.35;
            targetAccel += 42.0 * boostMultiplier;
          }

          // Market Tailwind / Headwind
          const deltaMagnitude = Math.min(Math.abs(priceDeltaPercent), 1.5);
          if (marketFavors) {
            targetAccel += deltaMagnitude * 18.0; // Tailwind
          } else {
            targetAccel -= deltaMagnitude * 8.0; // Headwind drag
          }

          // Smooth velocity integration
          r.velocity += (targetAccel - r.velocity) * Math.min(1, 4.5 * dt);
          r.altitude += r.velocity * dt;

          // Exhaust Particles
          if (r.isBoosting) {
            const laneX = r === p1 ? width * 0.32 : width * 0.68;
            for (let i = 0; i < (r.isSurfing ? 4 : 2); i++) {
              particlesRef.current.push({
                x: laneX + (Math.random() - 0.5) * 14,
                y: height * 0.66 + 32,
                vx: (Math.random() - 0.5) * 18,
                vy: Math.random() * 45 + 50,
                size: Math.random() * 5 + 3,
                alpha: 0.9,
                color: r.isSurfing ? (Math.random() < 0.5 ? "#F59E0B" : "#10B981") : r.flameColor,
              });
            }
          }
        });

        // Sync telemetry to React state at ~20fps
        setP1Telemetry({
          altitude: Math.floor(p1.altitude),
          fuel: Math.floor(p1.fuel),
          isBoosting: p1.isBoosting,
          isSurfing: p1.isSurfing,
          isStalled: p1.isStalled,
        });
        setP2Telemetry({
          altitude: Math.floor(p2.altitude),
          fuel: Math.floor(p2.fuel),
          isBoosting: p2.isBoosting,
          isSurfing: p2.isSurfing,
          isStalled: p2.isStalled,
        });
      }

      // 2. CANVAS RENDERING (Apple Light Mode Aesthetic)
      ctx.clearRect(0, 0, width, height);

      // Canvas Background (Subtle gradient)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#F1F5F9");
      bgGrad.addColorStop(1, "#FAFAF9");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render Moving Stars / Speed Streaks (Scroll downwards to represent climb)
      const avgVel = gameState === "playing" ? (p1Ref.current.velocity + p2Ref.current.velocity) / 2 : 12;
      starsRef.current.forEach((s) => {
        s.y += (s.speed + avgVel * 0.08);
        if (s.y > height) {
          s.y = -10;
          s.x = Math.random() * width;
        }

        ctx.fillStyle = `rgba(100, 116, 139, ${s.opacity})`;
        ctx.beginPath();
        // Stretch into speed line if moving fast
        if (avgVel > 30) {
          ctx.rect(s.x, s.y, s.size, s.size + avgVel * 0.25);
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

      // Render Exhaust Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= 1.8 * dt;
        p.size = Math.max(0.5, p.size - 3 * dt);

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

      // Draw Vertical Rocket Sprites
      const renderSurfRocket = (r: SurfRocket, laneX: number) => {
        // Vertical position is dynamic: if ahead, rocket climbs towards y=160; if behind, drops towards y=300
        const altDelta = r === p1Ref.current 
          ? (p1Ref.current.altitude - p2Ref.current.altitude)
          : (p2Ref.current.altitude - p1Ref.current.altitude);
        
        const clampedDelta = Math.max(-100, Math.min(100, altDelta));
        const rocketY = (height * 0.58) - (clampedDelta * 1.2);

        ctx.save();
        ctx.translate(laneX, rocketY);

        // Surfing Aura Glow
        if (r.isSurfing) {
          ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(0, 0, 32, 48, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Thruster Flame
        if (r.isBoosting) {
          ctx.fillStyle = r.isSurfing ? "#F59E0B" : r.flameColor;
          ctx.beginPath();
          ctx.moveTo(-10, 26);
          ctx.lineTo(0, 48 + Math.random() * 16);
          ctx.lineTo(10, 26);
          ctx.closePath();
          ctx.fill();

          // Inner white flame core
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(-5, 26);
          ctx.lineTo(0, 38 + Math.random() * 8);
          ctx.lineTo(5, 26);
          ctx.closePath();
          ctx.fill();
        }

        // Rocket Main Fuselage
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.moveTo(0, -34); // Nosecone tip
        ctx.quadraticCurveTo(18, -10, 15, 24); // Right body
        ctx.lineTo(-15, 24); // Bottom base
        ctx.quadraticCurveTo(-18, -10, 0, -34); // Left body
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Rocket Wings
        ctx.fillStyle = r.flameColor;
        ctx.beginPath();
        ctx.moveTo(-15, 12);
        ctx.lineTo(-26, 26);
        ctx.lineTo(-14, 26);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(15, 12);
        ctx.lineTo(26, 26);
        ctx.lineTo(14, 26);
        ctx.closePath();
        ctx.fill();

        // Cockpit Glass & Avatar
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(0, -2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.stroke();

        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(r.avatar, 0, 3);

        // NITRO FUEL GAUGE (Floating below rocket)
        const gaugeW = 44;
        const gaugeH = 4;
        ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
        ctx.fillRect(-gaugeW / 2, 34, gaugeW, gaugeH);

        const fuelW = (r.fuel / 100) * gaugeW;
        ctx.fillStyle = r.isStalled ? "#EF4444" : r.fuel < 25 ? "#F59E0B" : "#10B981";
        ctx.fillRect(-gaugeW / 2, 34, fuelW, gaugeH);

        // Altitude Tag Badge
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-36, -58, 72, 18, 5);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#0F172A";
        ctx.fillText(`${Math.floor(r.altitude)}m`, 0, -45);

        // Stalled Warning Banner
        if (r.isStalled) {
          ctx.fillStyle = "#EF4444";
          ctx.font = "bold 9px system-ui, sans-serif";
          ctx.fillText("⚠️ STALLED", 0, -64);
        }

        // Surfing Label
        if (r.isSurfing) {
          ctx.fillStyle = "#D97706";
          ctx.font = "bold 9px system-ui, sans-serif";
          ctx.fillText("🌊 SURF 2X", 0, -64);
        }

        ctx.restore();
      };

      renderSurfRocket(p1Ref.current, width * 0.32);
      renderSurfRocket(p2Ref.current, width * 0.68);

      // AI Thought Bubble over AI Rocket
      if (gameMode === "solo" && gameState === "playing") {
        const brain = aiBrainRef.current;
        const aiLaneX = width * 0.68;
        const aiY = height * 0.38;

        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.14)";
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(aiLaneX - 85, aiY - 26, 170, 24, 12);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillStyle = "#1E293B";
        ctx.textAlign = "center";
        ctx.fillText(brain.thought, aiLaneX, aiY - 10);
        ctx.restore();
      }

      // Countdown Screen Overlay
      if (gameState === "countdown") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillRect(0, 0, width, height);

        ctx.font = "bold 56px system-ui, sans-serif";
        ctx.fillStyle = "#6E4EF4";
        ctx.textAlign = "center";
        ctx.fillText(countdown > 0 ? String(countdown) : "LAUNCH!", width * 0.5, height * 0.52);

        ctx.font = "bold 14px system-ui, sans-serif";
        ctx.fillStyle = "#475569";
        ctx.fillText("Hold [SPACE] or Tap Boost to ignite Nitro!", width * 0.5, height * 0.62);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, gameMode, selectedAsset, selectedDuration, countdown, timeLeft]);

  // Touch & Mobile Press Handlers for P1
  const handleP1PressStart = () => {
    if (gameState !== "playing") return;
    const p1 = p1Ref.current;
    if (!p1.isStalled && p1.fuel > 5) {
      p1.isBoosting = true;
      soundEngine.startThrust(true);
    }
  };

  const handleP1PressEnd = () => {
    p1Ref.current.isBoosting = false;
    soundEngine.stopThrust();
  };

  // Price delta helpers
  const priceDelta = strikePrice > 0 ? currentPrice - strikePrice : 0;
  const priceDeltaPercent = strikePrice > 0 ? (priceDelta / strikePrice) * 100 : 0;
  const marketIsBull = priceDeltaPercent > 0.01;
  const marketIsBear = priceDeltaPercent < -0.01;

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

        {/* Live Market Tailwind Indicator */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-50 border border-black/[0.04]">
          <div className="text-right">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Atmospheric Wind</div>
            <div className={`text-xs font-bold ${marketIsBull ? "text-emerald-600" : marketIsBear ? "text-red-500" : "text-slate-600"}`}>
              {marketIsBull ? "🟢 Bull Tailwind (+Surf Bonus)" : marketIsBear ? "🔴 Bear Tailwind (+Surf Bonus)" : "⚪ Neutral Air"}
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
              <span>Solo vs AI Rival</span>
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
              <span>Local 1v1 Clash</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Your Role:</span>
            <button
              onClick={() => setPlayerSide("BULL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                playerSide === "BULL"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>🐂 BULL (Long)</span>
            </button>
            <button
              onClick={() => setPlayerSide("BEAR")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                playerSide === "BEAR"
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>🐻 BEAR (Short)</span>
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
            <span>ENTER DUEL (0.25 MON)</span>
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
              {winner === "P1" ? "VICTORY! YOU OUT-CLIMBED THE RIVAL" : winner === "DRAW" ? "DEAD HEAT TIE!" : "MEMEBOT AI WINS"}
            </h2>

            <p className="text-xs text-slate-500 max-w-sm mb-4">
              {winner === "P1"
                ? `You reached ${p1Telemetry.altitude}m vs rival's ${p2Telemetry.altitude}m. Escrow payout ready!`
                : winner === "DRAW"
                ? "Both rockets tied in altitude. Full escrow stake refunded."
                : `AI reached ${p2Telemetry.altitude}m vs your ${p1Telemetry.altitude}m.`}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-black/[0.06] mb-5 flex items-center gap-6 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">YOUR ALTITUDE</span>
                <span className="font-bold text-slate-900 text-sm">{p1Telemetry.altitude}m</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px]">RIVAL ALTITUDE</span>
                <span className="font-bold text-slate-900 text-sm">{p2Telemetry.altitude}m</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px]">NET PAYOUT</span>
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

      {/* 5. Player Controls & Nitro HUD */}
      <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* P1 Primary Controls */}
        <button
          onPointerDown={handleP1PressStart}
          onPointerUp={handleP1PressEnd}
          onPointerLeave={handleP1PressEnd}
          disabled={gameState !== "playing" || p1Telemetry.isStalled}
          className={`relative group p-4 rounded-2xl bg-white border transition-all flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.035)] cursor-pointer touch-none ${
            p1Telemetry.isStalled
              ? "border-red-300 bg-red-50/50 cursor-not-allowed"
              : p1Telemetry.isSurfing
              ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20"
              : p1Telemetry.isBoosting
              ? "border-[#6E4EF4] bg-[#6E4EF4]/5"
              : "border-black/[0.06] hover:border-black/[0.12] active:scale-[0.98]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform ${
                p1Telemetry.isBoosting ? "scale-110" : ""
              } ${p1Telemetry.isSurfing ? "bg-amber-100 text-amber-700" : "bg-[#6E4EF4]/10 text-[#6E4EF4]"}`}
            >
              {p1Telemetry.isSurfing ? "⚡" : p1Telemetry.isStalled ? "⚠️" : p1Ref.current.avatar}
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>P1 ({p1Ref.current.side}) • HOLD NITRO BOOST</span>
                {p1Telemetry.isSurfing && <span className="text-amber-600 text-[10px] font-bold">SURFING 2X!</span>}
                {p1Telemetry.isStalled && <span className="text-red-500 text-[10px] font-bold">STALLED (COOLING)</span>}
              </div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">
                HOLD [SPACE] / TAP • Fuel: {p1Telemetry.fuel}% • Altitude: {p1Telemetry.altitude}m
              </div>
            </div>
          </div>

          <Flame
            className={`w-6 h-6 transition-transform ${
              p1Telemetry.isSurfing
                ? "text-amber-500 scale-125"
                : p1Telemetry.isBoosting
                ? "text-[#6E4EF4] scale-125"
                : "text-slate-400"
            }`}
          />
        </button>

        {/* Rival Status Card / P2 Controls */}
        {gameMode === "versus" ? (
          <button
            onPointerDown={() => {
              if (gameState !== "playing") return;
              p2Ref.current.isBoosting = true;
              soundEngine.startThrust(false);
            }}
            onPointerUp={() => {
              p2Ref.current.isBoosting = false;
              soundEngine.stopThrust();
            }}
            disabled={gameState !== "playing" || p2Telemetry.isStalled}
            className={`p-4 rounded-2xl bg-white border transition-all flex items-center justify-between shadow-sm touch-none ${
              p2Telemetry.isBoosting ? "border-red-400 bg-red-50/40" : "border-black/[0.06]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-2xl">
                {p2Ref.current.avatar}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">P2 ({p2Ref.current.side}) • HOLD NITRO BOOST</div>
                <div className="text-xs font-mono text-slate-500">
                  HOLD [ARROW UP] • Fuel: {p2Telemetry.fuel}% • Alt: {p2Telemetry.altitude}m
                </div>
              </div>
            </div>
            <Flame className="w-6 h-6 text-red-500" />
          </button>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-black/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-2xl">
                🤖
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>MemeBot AI ({p2Ref.current.side})</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    FSM BRAIN
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Alt: {p2Telemetry.altitude}m • Fuel: {p2Telemetry.fuel}% • Status: {aiThought}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold text-slate-400">REACTION</div>
              <div className="text-xs font-mono font-bold text-slate-700">220ms</div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Game Economics & Rules */}
      <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Pyth Market Wave Surfing
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Time your Nitro when Pyth flashes a favorable price tick to trigger a 2.2x Surge Bonus and golden exhaust!
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Gauge className="w-3.5 h-3.5 text-[#6E4EF4]" />
            Nitro Fuel Management
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Holding burns fuel fast. If you run out, your engine stalls! Release boost strategically to recharge.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
            <Percent className="w-3.5 h-3.5 text-emerald-600" />
            3.5% Protocol Fee
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            0.50 MON total escrow. 3.5% (0.0175 MON) protocol fee deposited into the Treasury on every duel.
          </p>
        </div>
      </div>
    </div>
  );
}
