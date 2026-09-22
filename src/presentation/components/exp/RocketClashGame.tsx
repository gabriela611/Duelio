"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { soundEngine } from "./gameAudio";
import { Flame, Trophy, Volume2, VolumeX, RefreshCw, Zap, Users, User, ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

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
  twinkle: number;
  speed: number;
}

interface FloatingMeme {
  text: string;
  x: number;
  y: number;
  speed: number;
  color: string;
}

export function RocketClashGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game configuration & round state
  const [gameMode, setGameMode] = useState<"solo" | "versus">("solo");
  const [stakeMon, setStakeMon] = useState<number>(0.25);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [winner, setWinner] = useState<"P1" | "P2" | "DRAW" | null>(null);

  // Live HUD telemetry
  const [p1Telemetry, setP1Telemetry] = useState({ score: 0, mult: 1.0, inZone: false });
  const [p2Telemetry, setP2Telemetry] = useState({ score: 0, mult: 1.0, inZone: false });

  // Physics & Animation references
  const animFrameId = useRef<number>(0);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic corridor oscillation
  const corridorRef = useRef({
    topY: 140,
    bottomY: 260,
    targetY: 180,
    speed: 0.03,
    phase: 0,
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
    flameColor: "#00FFA3",
  });

  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const memesRef = useRef<FloatingMeme[]>([
    { text: "gmonad ⚡", x: 700, y: 80, speed: 1.2, color: "#836EF9" },
    { text: "10,000 TPS 🚀", x: 950, y: 120, speed: 1.5, color: "#00FFA3" },
    { text: "PYTH ORACLE 👁️", x: 1200, y: 60, speed: 1.0, color: "#EC4899" },
    { text: "WAGMI ✨", x: 1450, y: 150, speed: 1.3, color: "#FBBF24" },
    { text: "LONG $MON 50x", x: 1700, y: 90, speed: 1.4, color: "#3B82F6" },
  ]);

  // Sound toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Star generation on mount
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 50; i++) {
      stars.push({
        x: Math.random() * 800,
        y: Math.random() * 400,
        size: Math.random() * 2 + 1,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.05 + 0.02,
      });
    }
    starsRef.current = stars;
  }, []);

  // Keyboard controls listener
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

  // Round management
  const startGame = useCallback(() => {
    setWinner(null);
    setTimeLeft(20);
    setGameState("playing");

    p1Ref.current = {
      ...p1Ref.current,
      y: 200,
      vy: 0,
      tilt: 0,
      thrusting: false,
      score: 0,
      multiplier: 1.0,
      liquidated: false,
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
    };

    particlesRef.current = [];

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);

    let seconds = 20;
    roundTimerRef.current = setInterval(() => {
      seconds--;
      setTimeLeft(seconds);

      if (seconds <= 0) {
        clearInterval(roundTimerRef.current!);
        setGameState("gameover");
        soundEngine.stopThrust();
        soundEngine.playVictoryJingle();

        const s1 = p1Ref.current.score * p1Ref.current.multiplier;
        const s2 = p2Ref.current.score * p2Ref.current.multiplier;
        if (s1 > s2) setWinner("P1");
        else if (s2 > s1) setWinner("P2");
        else setWinner("DRAW");
      }
    }, 1000);
  }, []);

  // Main 60fps Game Loop
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
        // Corridor movement (Pyth oracle volatile oscillation)
        const corr = corridorRef.current;
        corr.phase += corr.speed;
        const targetCenter = height * 0.48 + Math.sin(corr.phase) * (height * 0.28) + (Math.sin(corr.phase * 2.5) * 20);
        corr.targetY = targetCenter;
        const corridorHeight = 110;
        corr.topY = targetCenter - corridorHeight / 2;
        corr.bottomY = targetCenter + corridorHeight / 2;

        // Bot AI behavior in Solo mode
        if (gameMode === "solo") {
          const p2 = p2Ref.current;
          const desiredY = targetCenter + Math.sin(time * 0.003) * 15;
          const distance = p2.y - desiredY;
          // React with slight jitter
          if (distance > 8 && p2.vy > -1.2) {
            p2.thrusting = true;
          } else if (distance < -8 && p2.vy < 1.0) {
            p2.thrusting = false;
          }
        }

        // Update Rockets
        [p1Ref.current, p2Ref.current].forEach((r, idx) => {
          if (r.liquidated) return;

          const gravity = 0.38;
          const thrust = -0.82;

          if (r.thrusting) {
            r.vy += thrust;
            // Spawn exhaust particles
            for (let i = 0; i < 2; i++) {
              particlesRef.current.push({
                x: idx === 0 ? width * 0.28 : width * 0.44,
                y: r.y + 16,
                vx: (Math.random() - 0.5) * 1.5 - 2,
                vy: Math.random() * 2 + 1,
                size: Math.random() * 5 + 3,
                alpha: 0.9,
                color: r.flameColor,
              });
            }
          }

          r.vy += gravity;
          r.vy *= 0.965; // air drag
          r.y += r.vy;

          // Tilt calculation
          r.tilt = Math.max(-25, Math.min(30, r.vy * 3.2));

          // Boundary checks & Liquidation warning
          if (r.y < 25) {
            r.y = 25;
            r.vy = 1;
            soundEngine.playLiquidationWarning();
          }
          if (r.y > height - 35) {
            r.y = height - 35;
            r.vy = -1;
            soundEngine.playLiquidationWarning();
          }

          // In-Corridor scoring
          if (r.y >= corr.topY && r.y <= corr.bottomY) {
            r.inCorridor = true;
            r.score += 1.5;
            r.multiplier = Math.min(5.0, r.multiplier + 0.004);
            if (Math.random() < 0.08) soundEngine.playScorePing();
          } else {
            r.inCorridor = false;
            r.multiplier = Math.max(1.0, r.multiplier - 0.006);
          }
        });

        // Update particle physics
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.025;
          p.size = Math.max(0, p.size - 0.1);
        });
        particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0);

        // Update floating meme banners
        memesRef.current.forEach((m) => {
          m.x -= m.speed;
          if (m.x < -180) m.x = width + 50;
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

      // 2. RENDER SCENE

      // Dark Monad Void Canvas
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#090014");
      bgGrad.addColorStop(0.5, "#140029");
      bgGrad.addColorStop(1, "#200052");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Distant Neon Grid lines
      ctx.strokeStyle = "rgba(131, 110, 249, 0.08)";
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Render Stars
      starsRef.current.forEach((s) => {
        s.twinkle += s.speed;
        const alpha = 0.4 + Math.sin(s.twinkle) * 0.35;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Background Candlestick Skyline (Crypto Easter Egg)
      const candleColors = ["#00FFA3", "#00FFA3", "#FF3B69", "#00FFA3", "#FF3B69", "#00FFA3", "#00FFA3"];
      const candleHeights = [90, 130, 80, 160, 110, 140, 180];
      candleHeights.forEach((ch, i) => {
        const cx = 80 + i * 110;
        const cy = height - ch;
        // Wick
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 14, cy - 25);
        ctx.lineTo(cx + 14, height - 10);
        ctx.stroke();

        // Body
        ctx.fillStyle = candleColors[i % candleColors.length] + "22";
        ctx.strokeStyle = candleColors[i % candleColors.length] + "55";
        ctx.lineWidth = 1.5;
        ctx.fillRect(cx, cy, 28, ch - 20);
        ctx.strokeRect(cx, cy, 28, ch - 20);
      });

      // Monad Moon with Pepe Astronaut
      const moonX = width - 110;
      const moonY = 80;
      const moonGrad = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 55);
      moonGrad.addColorStop(0, "#C4B5FD");
      moonGrad.addColorStop(0.7, "#836EF9");
      moonGrad.addColorStop(1, "rgba(131, 110, 249, 0)");
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 55, 0, Math.PI * 2);
      ctx.fill();

      // Draw Cartoon Pepe on the Moon
      ctx.font = "26px sans-serif";
      ctx.fillText("🐸", moonX - 16, moonY + 8);
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "#A78BFA";
      ctx.fillText("MONAD MOON", moonX - 28, moonY + 34);

      // Floating Meme Banners
      memesRef.current.forEach((m) => {
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = m.color;
        ctx.fillText(m.text, m.x, m.y);
      });

      // Render Dynamic Pyth Oracle Green Target Corridor
      const corr = corridorRef.current;
      const corridorGrad = ctx.createLinearGradient(0, corr.topY, 0, corr.bottomY);
      corridorGrad.addColorStop(0, "rgba(0, 255, 163, 0.03)");
      corridorGrad.addColorStop(0.5, "rgba(0, 255, 163, 0.12)");
      corridorGrad.addColorStop(1, "rgba(0, 255, 163, 0.03)");

      ctx.fillStyle = corridorGrad;
      ctx.fillRect(0, corr.topY, width, corr.bottomY - corr.topY);

      // Corridor neon boundaries
      ctx.strokeStyle = "rgba(0, 255, 163, 0.75)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);

      ctx.beginPath();
      ctx.moveTo(0, corr.topY);
      ctx.lineTo(width, corr.topY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, corr.bottomY);
      ctx.lineTo(width, corr.bottomY);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Corridor label
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#00FFA3";
      ctx.fillText("⚡ PYTH GREEN CORRIDOR (+MULTIPLIER ZONE) ⚡", 18, corr.topY + 16);

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

        // Thruster flame if firing
        if (r.thrusting) {
          ctx.fillStyle = r.flameColor;
          ctx.beginPath();
          ctx.moveTo(-16, -4);
          ctx.lineTo(-32 - Math.random() * 8, 0);
          ctx.lineTo(-16, 4);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#FFF";
          ctx.beginPath();
          ctx.moveTo(-16, -2);
          ctx.lineTo(-24, 0);
          ctx.lineTo(-16, 2);
          ctx.closePath();
          ctx.fill();
        }

        // Rocket Body
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Rocket Nosecone
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(14, -8);
        ctx.lineTo(24, 0);
        ctx.lineTo(14, 8);
        ctx.closePath();
        ctx.fill();

        // Rocket Tail Fin
        ctx.fillStyle = "#4C1D95";
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
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(2, 0, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "11px sans-serif";
        ctx.fillText(r.avatar, -3, 4);

        // Player Tag & Multiplier
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = r.inCorridor ? "#00FFA3" : "#FFFFFF";
        ctx.fillText(`${r.name} (${r.multiplier.toFixed(1)}x)`, -24, -18);

        ctx.restore();
      };

      renderRocket(p1Ref.current, width * 0.28);
      renderRocket(p2Ref.current, width * 0.44);

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId.current);
  }, [gameState, gameMode]);

  // Touch & Pointer handlers for frictionless mobile inputs
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

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center select-none">
      {/* Top Navigation & Status Bar */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-[#13062B]/80 backdrop-blur-md rounded-2xl border border-purple-500/20 mb-4 shadow-xl shadow-purple-950/30">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-mono text-purple-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-purple-950/60 border border-purple-500/20 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Arena
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-sm font-bold tracking-wider text-white uppercase flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-purple-400" />
              Rocket Clash <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">EXP</span>
            </h1>
          </div>
        </div>

        {/* Stake Selector & Audio Toggle */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 bg-purple-950/80 p-1 rounded-xl border border-purple-500/20 text-xs">
            <span className="text-purple-300 text-[10px] px-1.5 font-mono">STAKE:</span>
            {[0.1, 0.25, 0.5, 1.0].map((amt) => (
              <button
                key={amt}
                onClick={() => setStakeMon(amt)}
                disabled={gameState === "playing"}
                className={`px-2 py-0.5 rounded-lg font-mono transition-all ${
                  stakeMon === amt
                    ? "bg-[#836EF9] text-white font-bold shadow-sm shadow-purple-500/50"
                    : "text-purple-300/70 hover:text-white"
                }`}
              >
                {amt}M
              </button>
            ))}
          </div>

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/20 text-purple-300 hover:text-white transition-colors"
            title={isMuted ? "Unmute sound" : "Mute sound"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Main Game Canvas Arena */}
      <div className="relative w-full aspect-[16/9] max-h-[500px] rounded-3xl overflow-hidden border-2 border-purple-500/30 shadow-2xl shadow-purple-900/50 bg-[#0B001A]">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full block"
        />

        {/* Floating Top HUD: Time & Prize Pool */}
        <div className="absolute top-3 left-0 right-0 px-6 flex items-center justify-between pointer-events-none">
          {/* Player 1 HUD */}
          <div className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border backdrop-blur-md transition-all ${
            p1Telemetry.inZone ? "bg-purple-900/70 border-emerald-400/60 shadow-lg shadow-emerald-500/20" : "bg-purple-950/60 border-purple-500/20"
          }`}>
            <span className="text-xl">🟣</span>
            <div>
              <div className="text-[10px] font-mono text-purple-300 uppercase leading-none">P1 • Gmonad</div>
              <div className="text-sm font-black font-mono text-white flex items-center gap-1.5">
                {p1Telemetry.score} pts
                <span className="text-xs px-1 rounded bg-purple-500/30 text-emerald-300 font-mono">
                  {p1Telemetry.mult}x
                </span>
              </div>
            </div>
          </div>

          {/* Central Match Timer & Dynamic Pot */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-mono tracking-widest text-purple-300 uppercase">
              POT: <span className="text-emerald-400 font-bold">{totalPot} MON</span>
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${
              timeLeft <= 5 ? "text-red-400 animate-bounce" : "text-white"
            }`}>
              00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </div>
          </div>

          {/* Player 2 / Bot HUD */}
          <div className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border backdrop-blur-md transition-all ${
            p2Telemetry.inZone ? "bg-emerald-950/70 border-emerald-400/60 shadow-lg shadow-emerald-500/20" : "bg-purple-950/60 border-purple-500/20"
          }`}>
            <div>
              <div className="text-[10px] font-mono text-emerald-300 uppercase text-right leading-none">
                {gameMode === "solo" ? "AI ORACLE" : "P2 • PEPE"}
              </div>
              <div className="text-sm font-black font-mono text-white flex items-center gap-1.5 justify-end">
                <span className="text-xs px-1 rounded bg-emerald-500/30 text-emerald-300 font-mono">
                  {p2Telemetry.mult}x
                </span>
                {p2Telemetry.score} pts
              </div>
            </div>
            <span className="text-xl">🐸</span>
          </div>
        </div>

        {/* Start Overlay / Lobby Screen */}
        {gameState === "idle" && (
          <div className="absolute inset-0 bg-[#090014]/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="inline-flex p-3 rounded-2xl bg-purple-900/40 border border-purple-500/30 text-purple-400 mb-3 animate-pulse">
              <Flame className="w-8 h-8 text-orange-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider mb-2">
              Monad Rocket Clash
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/80 max-w-md mb-6 leading-relaxed">
              Hold to fire thrusters, release to dive with gravity. Hover inside the <span className="text-emerald-400 font-bold">Pyth Green Corridor</span> to boost altitude multipliers up to 5x!
            </p>

            {/* Mode selection */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setGameMode("solo")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                  gameMode === "solo"
                    ? "bg-[#836EF9] text-white shadow-lg shadow-purple-600/50"
                    : "bg-purple-950/80 text-purple-300 border border-purple-500/20 hover:text-white"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Solo vs Oracle AI
              </button>
              <button
                onClick={() => setGameMode("versus")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                  gameMode === "versus"
                    ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/50"
                    : "bg-purple-950/80 text-purple-300 border border-purple-500/20 hover:text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                1v1 Dual Split
              </button>
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#836EF9] to-[#6344E7] text-white font-mono font-bold text-sm tracking-widest uppercase hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-purple-600/40"
            >
              Launch Clash Round (20s)
            </button>
          </div>
        )}

        {/* Game Over Settlement Modal */}
        {gameState === "gameover" && (
          <div className="absolute inset-0 bg-[#090014]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 mb-3 shadow-lg shadow-amber-500/30">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="text-xs font-mono text-purple-300 uppercase tracking-widest mb-1">
              Round Complete
            </div>

            <h3 className="text-3xl font-black text-white uppercase mb-2">
              {winner === "P1" ? "Gmonad Alpha Wins! 🎉" : winner === "P2" ? "Pepe Rocket Wins! 🐸" : "Tie Clash! 🤝"}
            </h3>

            <p className="text-xs text-purple-200/80 mb-5 font-mono">
              Payout: <span className="text-emerald-400 font-bold">{totalPot} MON</span> • 2.5% Protocol Fee to House Treasury
            </p>

            <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-6">
              <div className="p-3 rounded-xl bg-purple-950/80 border border-purple-500/30 text-center">
                <div className="text-[10px] text-purple-300 font-mono">P1 SCORE</div>
                <div className="text-lg font-black text-white font-mono">
                  {Math.floor(p1Ref.current.score * p1Ref.current.multiplier)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-purple-950/80 border border-purple-500/30 text-center">
                <div className="text-[10px] text-emerald-300 font-mono">P2 SCORE</div>
                <div className="text-lg font-black text-white font-mono">
                  {Math.floor(p2Ref.current.score * p2Ref.current.multiplier)}
                </div>
              </div>
            </div>

            <button
              onClick={startGame}
              className="flex items-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-[#836EF9] to-[#00FFA3] text-slate-950 font-mono font-bold text-sm tracking-wider uppercase hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-purple-600/30"
            >
              <RefreshCw className="w-4 h-4" />
              Play Rematch
            </button>
          </div>
        )}
      </div>

      {/* Direct Manipulation Physical Controls (Mobile / Touch friendly) */}
      <div className="w-full mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* P1 Controls Button */}
        <button
          onPointerDown={handleP1PointerDown}
          onPointerUp={handleP1PointerUp}
          onPointerLeave={handleP1PointerUp}
          onPointerCancel={handleP1PointerUp}
          className="relative group p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-900/60 to-purple-950/90 border-2 border-purple-500/30 hover:border-purple-400 active:scale-[0.98] transition-all flex items-center justify-between shadow-lg shadow-purple-950/40 cursor-pointer touch-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#836EF9]/30 border border-purple-400/40 flex items-center justify-center text-xl">
              🟣
            </div>
            <div className="text-left">
              <div className="text-xs font-mono text-purple-300 uppercase">P1 • Hold to Thrust</div>
              <div className="text-sm font-black text-white font-mono">HOLD [SPACE] / [W]</div>
            </div>
          </div>
          <Flame className="w-6 h-6 text-orange-400 group-active:scale-125 transition-transform" />
        </button>

        {/* P2 Controls Button (Versus mode or Auto AI in Solo) */}
        {gameMode === "versus" ? (
          <button
            onPointerDown={handleP2PointerDown}
            onPointerUp={handleP2PointerUp}
            onPointerLeave={handleP2PointerUp}
            onPointerCancel={handleP2PointerUp}
            className="relative group p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-teal-950/90 border-2 border-emerald-500/30 hover:border-emerald-400 active:scale-[0.98] transition-all flex items-center justify-between shadow-lg shadow-emerald-950/40 cursor-pointer touch-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center text-xl">
                🐸
              </div>
              <div className="text-left">
                <div className="text-xs font-mono text-emerald-300 uppercase">P2 • Hold to Thrust</div>
                <div className="text-sm font-black text-white font-mono">HOLD [ARROW UP]</div>
              </div>
            </div>
            <Flame className="w-6 h-6 text-emerald-400 group-active:scale-125 transition-transform" />
          </button>
        ) : (
          <div className="p-4 sm:p-5 rounded-2xl bg-purple-950/40 border border-purple-500/10 flex items-center justify-between opacity-80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <div className="text-xs font-mono text-purple-300 uppercase">AI Oracle Opponent</div>
                <div className="text-xs text-purple-300/70 font-mono">Auto-tracking Pyth target channel</div>
              </div>
            </div>
            <div className="text-[10px] font-mono px-2 py-1 rounded bg-purple-900/60 text-emerald-300">
              BOT ACTIVE
            </div>
          </div>
        )}
      </div>

      {/* Behavioral Psychology & Hackathon Viability Panel */}
      <div className="w-full mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/20">
          <div className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            10,000 TPS Velocity
          </div>
          <p className="text-[11px] text-purple-300/70 leading-relaxed">
            High-frequency 20s rounds settled seamlessly on Monad testnet with sub-second finality and near-zero gas.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/20">
          <div className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
            Risk / Reward Hovering
          </div>
          <p className="text-[11px] text-purple-300/70 leading-relaxed">
            Near-miss boundary physics trigger dopamine rushes as players balance gravity to hold 5x leverage multipliers.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/20">
          <div className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
            <Trophy className="w-3.5 h-3.5 text-emerald-400" />
            House Monetization
          </div>
          <p className="text-[11px] text-purple-300/70 leading-relaxed">
            2.5% protocol cut flows automatically to the Treasury contract on each clash settlement.
          </p>
        </div>
      </div>
    </div>
  );
}
