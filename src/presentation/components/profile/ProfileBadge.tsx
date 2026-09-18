"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState } from "react";
import {
  ChevronLeft,
  Bell,
  CheckCircle2,
  Share2,
  Clock,
  Swords,
  Trophy,
  Calendar,
  Key,
  AlertTriangle,
  Zap,
  TrendingUp,
  ShieldCheck,
  Flame,
  ArrowUpRight,
} from "lucide-react";
import { DUELIO_SESSION_POLICY } from "@/infrastructure/web3/privyConfig";

interface ProfileBadgeProps {
  onBack?: () => void;
}

export const ProfileBadge: React.FC<ProfileBadgeProps> = ({ onBack }) => {
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "30d">("7d");
  const [isFollowing, setIsFollowing] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);

  const handleToggleSession = () => {
    setSessionActive((prev) => !prev);
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Clean Profile Header Card */}
      <div className="rounded-3xl overflow-hidden bg-surface shadow-card border border-border">
        {/* Header Area with Metrics */}
        <div className="relative h-44 sm:h-52 w-full bg-gradient-to-br from-monad-700 to-monad-500 px-4 sm:px-6 pt-4 pb-5 flex flex-col justify-between">
          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between text-white">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl bg-white/10 hover:bg-white/20 text-white active:scale-95 transition-[background-color,color,transform] duration-100"
              aria-label="Back to Arena"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/90 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse"></span>
                <span>Monad</span>
              </div>

              <div className="relative p-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer active:scale-95 transition-[background-color,color,transform] duration-100">
                <Bell className="w-4 h-4 text-white" />
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent"></div>
              </div>
            </div>
          </div>

          {/* Bottom: Stats & Avatar */}
          <div className="relative z-10 flex items-end justify-between">
            <div className="flex items-center gap-5 text-white">
              <div>
                <span className="font-mono font-bold text-xl leading-tight block">
                  1,845
                </span>
                <span className="text-xs text-white/80 font-medium">
                  Master ELO
                </span>
              </div>
              <div>
                <span className="font-mono font-bold text-xl leading-tight block text-positive">
                  82.9%
                </span>
                <span className="text-xs text-white/80 font-medium">
                  Win Rate
                </span>
              </div>
              <div className="hidden sm:block">
                <span className="font-mono font-bold text-xl leading-tight block">
                  #302
                </span>
                <span className="text-xs text-white/80 font-medium">
                  Rank
                </span>
              </div>
            </div>

            {/* Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-1 bg-surface shadow-elevated -mb-10 sm:-mb-12 shrink-0">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face"
                width={80}
                height={80}
                alt="MonadWhale"
                className="w-full h-full rounded-xl object-cover"
              />
            </div>
          </div>
        </div>

        {/* User Identity */}
        <div className="px-4 sm:px-8 pt-10 sm:pt-12 pb-6 space-y-3 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
                MonadWhale
              </h2>
              <div className="w-5 h-5 rounded-full bg-monad-600 text-white flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <Share2 className="w-4 h-4 text-text-tertiary hover:text-text-primary cursor-pointer ml-1 active:scale-90 transition-[background-color,color,transform] duration-100" />
            </div>

            <button
              onClick={() => setIsFollowing(!isFollowing)}
              aria-pressed={isFollowing}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-[background-color,color,transform] duration-100 active:scale-95 ${
                isFollowing
                  ? "bg-surface-secondary text-text-primary"
                  : "bg-text-primary text-white"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>

          <div className="break-words text-sm font-mono font-semibold text-monad-700">
            $monadwhale • 0x836E...0001
          </div>

          <p className="text-sm text-text-secondary font-medium leading-relaxed max-w-2xl">
            High-frequency PvP trader on Monad Testnet. Specializing in sub-minute tactical allocation clashes.
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-4 sm:gap-6 pt-1 text-xs text-text-secondary font-medium flex-wrap">
            <div className="flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-monad-500" />
              <span>82 Duels</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>5x Streak</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Avg: 60s</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Since Sep 2026</span>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Left: Balance & Chart */}
          <div className="min-w-0 p-4 sm:p-8 space-y-5">
            <div className="flex flex-col items-start gap-4">
              <div>
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide block">
                  Total Equity
                </span>
                <div className="flex items-baseline text-text-primary font-bold tracking-tight mt-1">
                  <span className="text-4xl sm:text-5xl font-mono">
                    358.50
                  </span>
                  <span className="text-xl font-semibold text-monad-600 ml-2">
                    MON
                  </span>
                </div>
                <div className="text-sm font-mono font-semibold text-positive mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+48.20 MON (+15.6%)</span>
                </div>
              </div>

              {/* Timeframe Selector */}
              <div className="flex items-center bg-surface-secondary p-1 rounded-xl text-xs font-semibold">
                {(["24h", "7d", "30d"] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    aria-pressed={timeframe === tf}
                    className={`px-3 py-1 rounded-lg transition-[background-color,color,transform] duration-150 active:scale-95 ${
                      timeframe === tf
                        ? "bg-slate-200/90 text-text-primary border border-slate-300 font-bold shadow-xs"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean Chart */}
            <div className="w-full h-32 my-2 relative">
              <svg
                className="w-full h-full overflow-visible"
                viewBox="0 0 320 80"
                preserveAspectRatio="none"
                role="img"
                aria-label="Equity trend rising over the selected period"
              >
                <path
                  d="M 0 65 Q 40 55, 80 50 T 160 38 T 240 28 T 320 18"
                  fill="none"
                  stroke="#14CF1C"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle
                  cx="320"
                  cy="18"
                  r="4"
                  fill="#14CF1C"
                />
              </svg>
            </div>

            {/* Breakdown */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-secondary">
                  Active Escrow
                </span>
                <span className="font-mono font-semibold text-text-primary">
                  128.50 MON
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-secondary">
                  Wallet Balance
                </span>
                <span className="font-mono font-semibold text-text-primary">
                  230.00 MON
                </span>
              </div>
            </div>
          </div>

          {/* Right: Positions & Session */}
          <div className="min-w-0 p-4 sm:p-8 space-y-6">
            {/* Positions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wide">
                  Positions
                </h4>
                <span className="text-xs font-mono text-text-tertiary">
                  4 Assets
                </span>
              </div>

              <div className="space-y-2">
                {/* Monad */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-monad-600 flex items-center justify-center text-white font-bold text-xs">
                      M
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary">
                        Monad
                      </div>
                      <div className="text-xs text-text-secondary font-mono">
                        120.0 MON
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-text-primary">
                      $2,286
                    </div>
                    <div className="text-xs font-mono font-semibold text-positive">
                      +9.34%
                    </div>
                  </div>
                </div>

                {/* Bitcoin */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white font-bold text-xs">
                      ₿
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary">
                        Bitcoin
                      </div>
                      <div className="text-xs text-text-secondary font-mono">
                        0.05 BTC
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-text-primary">
                      $4,840
                    </div>
                    <div className="text-xs font-mono font-semibold text-positive">
                      +2.76%
                    </div>
                  </div>
                </div>

                {/* Ethereum */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
                      Ξ
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary">
                        Ethereum
                      </div>
                      <div className="text-xs text-text-secondary font-mono">
                        0.85 ETH
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-text-primary">
                      $2,303
                    </div>
                    <div className="text-xs font-mono font-semibold text-positive">
                      +2.65%
                    </div>
                  </div>
                </div>

                {/* Solana */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-teal-400 flex items-center justify-center text-white font-bold text-xs">
                      S
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary">
                        Solana
                      </div>
                      <div className="text-xs text-text-secondary font-mono">
                        8.50 SOL
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-text-primary">
                      $1,547
                    </div>
                    <div className="text-xs font-mono font-semibold text-positive">
                      +6.00%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Session Key Card */}
            <div className="p-4 rounded-2xl bg-surface border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-monad-600" />
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">
                    Session Key
                  </h4>
                </div>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                    sessionActive
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {sessionActive ? "ACTIVE" : "REVOKED"}
                </span>
              </div>

              <div className="space-y-1 text-xs font-mono text-text-secondary bg-surface-secondary p-2.5 rounded-xl">
                <div className="flex justify-between">
                  <span>Chain:</span>
                  <span className="font-semibold text-text-primary">
                    Monad {DUELIO_SESSION_POLICY.chainId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Contract:</span>
                  <span className="font-semibold text-monad-600">DuelArena</span>
                </div>
                <div className="flex justify-between">
                  <span>Limit:</span>
                  <span className="font-semibold text-text-primary">
                    {DUELIO_SESSION_POLICY.maxSpendMon} MON
                  </span>
                </div>
              </div>

              <button
                onClick={handleToggleSession}
                className={`w-full py-2 rounded-xl text-xs font-semibold transition-[background-color,color,transform] duration-100 active:scale-95 flex items-center justify-center gap-1.5 ${
                  sessionActive
                    ? "bg-red-50 text-red-600 border border-red-200"
                    : "bg-monad-50 text-monad-700 border border-monad-200"
                }`}
              >
                {sessionActive ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Revoke</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Authorize</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
