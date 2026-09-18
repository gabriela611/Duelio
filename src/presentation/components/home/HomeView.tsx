"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Heart, MessageCircle, RefreshCw, Swords, Trophy, Sparkles } from "lucide-react";
import { formatNativeBalance } from "@/domain/social/identity";
import { sampleActivity, type SampleProfile } from "@/domain/social/sampleActivity";
import { useNativeBalance } from "@/presentation/hooks/useNativeBalance";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import type { ActiveTab } from "@/presentation/components/mobile-shell";

interface HomeViewProps {
  liked: string[];
  onReaction: (id: string) => void;
  userAddress?: string;
  authenticated: boolean;
  authReady: boolean;
  onConnect: () => void;
  onNavigate: (tab: ActiveTab) => void;
  onProfile: (profile: SampleProfile) => void;
}

export function HomeView({ liked, onReaction, userAddress, authenticated, authReady, onConnect, onNavigate, onProfile }: HomeViewProps) {
  const balance = useNativeBalance(userAddress);
  const [hidden, setHidden] = useState(false);
  const [filter, setFilter] = useState("all");
  const filters = [{ id: "all", label: "For you" }, { id: "duels", label: "Duels" }, { id: "milestones", label: "Milestones" }];
  const balanceLabel = !authReady ? "Getting ready…" : !authenticated ? "Your next move starts here"
    : !userAddress ? "Your wallet is getting ready" : balance.status === "loading" ? "Checking your balance…"
    : balance.status === "error" ? "Balance unavailable" : "Ready for your next duel";

  return (
    <div className="home-view mx-auto w-full max-w-2xl space-y-6 sm:space-y-8 pb-4">
      {/* Wallet / Practice Balance Card */}
      <section className="rounded-3xl bg-surface p-5 sm:p-7 border border-border shadow-card space-y-5" aria-label="Wallet balance">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <AssetLogo symbol="MON" size={22} />
            <span>Practice Balance</span>
          </div>
          <div className="flex items-center gap-1">
            {userAddress && (
              <button
                onClick={balance.refresh}
                disabled={balance.status === "loading"}
                aria-label="Refresh balance"
                className="w-10 h-10 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-secondary active:scale-95 transition-all disabled:opacity-40"
              >
                <RefreshCw size={17} className={balance.status === "loading" ? "animate-spin" : ""} />
              </button>
            )}
            <button
              onClick={() => setHidden(!hidden)}
              aria-label={hidden ? "Show balance" : "Hide balance"}
              aria-pressed={hidden}
              className="w-10 h-10 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-secondary active:scale-95 transition-all"
            >
              {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1" aria-live="polite" aria-atomic="true">
            <span className="balance-amount text-text-primary">
              {hidden ? "••••" : balance.status === "ready" && balance.value !== undefined ? formatNativeBalance(balance.value) : "128.50"}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-text-tertiary font-mono">MON</span>
          </div>
          <p className="mt-2 text-sm text-text-secondary font-medium" role="status">{balanceLabel}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">Practice tokens on Monad Testnet. No cash value.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1">
          <button
            onClick={() => (authenticated ? onNavigate("arena") : onConnect())}
            disabled={!authReady}
            className="home-action bg-monad-600 hover:bg-monad-700 text-white shadow-card active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {authenticated ? <Swords size={18} /> : <ArrowDownLeft size={18} />}
            <span>{authenticated ? "Start a duel" : "Connect wallet"}</span>
          </button>
          <button
            onClick={() => onNavigate("spectate")}
            className="home-action border border-border bg-surface hover:bg-surface-secondary text-text-primary shadow-card active:scale-[0.97] transition-all"
          >
            <ArrowUpRight size={18} />
            <span>Explore duels</span>
          </button>
        </div>
      </section>

      {/* Community Activity Section */}
      <section aria-labelledby="community-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="community-heading" className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
              Your people. Your arena.
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Sample community stories. Reactions and follows stay in this session.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-surface border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-monad-600 shadow-2xs">
            Live Feed
          </span>
        </div>

        {/* Horizontal Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1" aria-label="Activity filters">
          {filters.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`h-9 sm:h-10 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                filter === item.id
                  ? "bg-slate-200/90 text-text-primary border border-slate-300 font-bold shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Stories Feed */}
        <div className="space-y-4">
          {sampleActivity.filter((item) => filter === "all" || filter === item.kind).map((item, index) => (
            <div key={item.id} className="space-y-4">
              <article className={`social-card social-card-${item.theme}`}>
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => onProfile(item.profile)}
                    className="flex items-center gap-2.5 rounded-full pr-3 py-1 text-sm font-bold text-text-primary bg-white/70 hover:bg-white/90 backdrop-blur-md shadow-2xs active:scale-95 transition-all"
                    aria-label={`View ${item.profile.name}'s sample profile`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold shadow-2xs">
                      {item.profile.initials}
                    </span>
                    <span className="truncate max-w-[140px] sm:max-w-none">{item.profile.name}</span>
                    <ArrowUpRight size={14} className="text-text-secondary shrink-0" />
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 bg-white/50 backdrop-blur-xs px-2.5 py-1 rounded-full border border-black/5 shrink-0">
                    Sample story
                  </span>
                </div>

                <div className="relative mt-6 sm:mt-7">
                  <p className="relative z-10 text-xs font-bold uppercase tracking-wider text-neutral-700">{item.eyebrow}</p>
                  <h3 className="relative z-10 mt-1.5 whitespace-pre-line text-2xl sm:text-4xl font-bold leading-[1.12] tracking-tight text-neutral-900">
                    {item.title}
                  </h3>
                  <span aria-hidden="true" className="social-emblem">
                    {item.kind === "duels" ? <Swords /> : <Trophy />}
                  </span>
                </div>

                <p className="relative mt-4 max-w-xl text-xs sm:text-sm leading-relaxed text-neutral-800 font-medium">
                  {item.description}
                </p>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-black/10 pt-3 flex-wrap">
                  <button
                    onClick={() => onReaction(item.id)}
                    aria-label={`Celebrate ${item.profile.name}`}
                    aria-pressed={liked.includes(item.id)}
                    className={`h-9 sm:h-10 flex items-center gap-2 rounded-full px-3.5 text-xs sm:text-sm font-bold active:scale-95 transition-all shadow-2xs backdrop-blur-md ${
                      liked.includes(item.id)
                        ? "bg-white text-rose-600"
                        : "bg-white/80 hover:bg-white text-neutral-800"
                    }`}
                  >
                    <Heart size={16} fill={liked.includes(item.id) ? "currentColor" : "none"} className={liked.includes(item.id) ? "text-rose-500 scale-110" : ""} />
                    <span>{item.reactions + Number(liked.includes(item.id))}</span>
                  </button>
                  <button
                    onClick={() => onNavigate(item.kind === "duels" ? "arena" : "leaderboard")}
                    className="h-9 sm:h-10 flex items-center gap-1.5 rounded-full px-3 text-xs sm:text-sm font-bold text-neutral-900 bg-white/60 hover:bg-white/90 backdrop-blur-xs active:scale-95 transition-all"
                  >
                    <span>{item.kind === "duels" ? "Find your next duel" : "Explore rankings"}</span>
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </article>

              {index === 0 && filter === "all" && (
                <div className="space-y-4">
                  {/* Social Conversation Message Card */}
                  <article className="rounded-3xl border border-border bg-surface p-4 sm:p-5 shadow-card space-y-3.5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-monad-50 text-monad-600 border border-monad-200 shadow-2xs">
                        <MessageCircle size={18} />
                      </span>
                      <div className="min-w-0 space-y-2.5 flex-1">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-text-primary">
                              Juan <span className="ml-1 text-xs font-normal text-text-tertiary">· duel challenge</span>
                            </p>
                            <span className="text-[10px] font-semibold text-text-tertiary">2m ago</span>
                          </div>
                          <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-text-secondary">
                            “Good game earlier, Pepe! But our rematch is live right now. Let&apos;s see who has the best tactical allocation ⚔️”
                          </p>
                        </div>

                        <div className="pt-2.5 border-t border-border/70">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-text-primary">
                              Pepe <span className="ml-1 text-xs font-normal text-text-tertiary">· response</span>
                            </p>
                            <span className="text-[10px] font-semibold text-text-tertiary">Just now</span>
                          </div>
                          <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-text-secondary">
                            “Challenge accepted! Staked 10 MON on SOL momentum. Good luck! 🚀”
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>

                  {/* Live Clash Spectate & Bet Card */}
                  <article className="rounded-3xl border-2 border-monad-500/30 bg-gradient-to-br from-monad-50/80 via-surface to-surface p-5 sm:p-6 shadow-card space-y-4">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-[11px] font-bold tracking-wide uppercase">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span>Live Clash</span>
                        </span>
                        <span className="text-xs font-mono font-semibold text-text-secondary">
                          Speed Clash (1m) • Duel #104
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-mono font-bold text-monad-700 bg-monad-100/80 px-2.5 py-0.5 rounded-full">
                        <AssetLogo symbol="MON" size={13} />
                        <span>24.70 MON Pool</span>
                      </div>
                    </div>

                    {/* Head-to-Head Duelists */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1">
                      {/* Fighter 1: Juan */}
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-2xl bg-monad-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            <AssetLogo symbol="MON" size={24} />
                          </div>
                          <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded bg-monad-700 text-[8px] font-bold text-white tracking-wider">
                            1.65x
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-text-primary truncate">Juan</div>
                          <div className="text-xs text-text-tertiary flex items-center gap-1 font-mono">
                            <span>1890 ELO</span>
                          </div>
                        </div>
                      </div>

                      {/* VS Divider */}
                      <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center shadow-xs shrink-0">
                        <Swords className="w-4 h-4 text-text-secondary" />
                      </div>

                      {/* Fighter 2: Pepe */}
                      <div className="flex items-center justify-end gap-2.5 sm:gap-3 min-w-0 text-right">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-text-primary truncate">Pepe</div>
                          <div className="text-xs text-text-tertiary flex items-center justify-end gap-1 font-mono">
                            <span>1820 ELO</span>
                          </div>
                        </div>
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            <AssetLogo symbol="SOL" size={24} />
                          </div>
                          <span className="absolute -bottom-1 -left-1 px-1 py-0.2 rounded bg-slate-800 text-[8px] font-bold text-slate-200 tracking-wider">
                            2.25x
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Live Odds Progress Bar */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="w-full h-3 bg-surface-secondary rounded-full overflow-hidden flex border border-border">
                        <div
                          className="h-full bg-monad-600 flex items-center justify-start pl-2 text-[10px] font-bold text-white font-mono"
                          style={{ width: "58%" }}
                        >
                          58%
                        </div>
                        <div
                          className="h-full bg-slate-900 flex items-center justify-end pr-2 text-[10px] font-bold text-white font-mono"
                          style={{ width: "42%" }}
                        >
                          42%
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary">
                        <span className="text-monad-700 font-semibold">Pool Juan: 14.50 MON (1.65x)</span>
                        <span className="text-slate-700 font-semibold">Pool Pepe: 10.20 MON (2.25x)</span>
                      </div>
                    </div>

                    {/* Action Buttons: Spectate and Bet */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        onClick={() => onNavigate("spectate")}
                        className="home-action border border-border bg-surface hover:bg-surface-secondary text-text-primary shadow-xs active:scale-95 transition-all text-xs sm:text-sm font-bold"
                      >
                        <Eye size={17} className="text-monad-600" />
                        <span>Spectate Live Duel</span>
                      </button>
                      <button
                        onClick={() => onNavigate("spectate")}
                        className="home-action bg-monad-600 hover:bg-monad-700 text-white shadow-card active:scale-95 transition-all text-xs sm:text-sm font-bold"
                      >
                        <Sparkles size={17} className="text-amber-300" />
                        <span>Stake & Bet on Winner</span>
                      </button>
                    </div>
                  </article>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 py-4 text-xs font-medium text-text-tertiary">
          <Swords size={14} className="text-monad-500" />
          <span>A little competition. A lot of connection.</span>
        </div>
      </section>
    </div>
  );
}
