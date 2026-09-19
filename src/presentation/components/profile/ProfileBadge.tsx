"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  CheckCircle2,
  Swords,
  ShieldCheck,
  Flame,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  Key,
} from "lucide-react";
import { DUELIO_SESSION_POLICY } from "@/infrastructure/web3/privyConfig";
import { DUEL_ARENA_CONTRACT_ADDRESS, HOUSE_TREASURY_ADDRESS } from "@/infrastructure/web3/monadChain";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import { useNativeBalance } from "@/presentation/hooks/useNativeBalance";
import { formatNativeBalance, normalizeAddress } from "@/domain/social/identity";
import { getPlayerStats, getDuelHistory } from "@/domain/duel/duelHistory";
import { toggleFollowUser, getFollowingList } from "@/domain/social/socialService";
import type { SampleProfile } from "@/domain/social/sampleActivity";

interface ProfileBadgeProps {
  following?: boolean;
  onToggleFollow?: () => void;
  viewerAddress?: string;
  profile?: SampleProfile;
  onConnect?: () => void;
  onArena?: () => void;
  onBack?: () => void;
}

export const ProfileBadge: React.FC<ProfileBadgeProps> = ({
  onBack,
  viewerAddress,
  profile,
  onConnect,
  onArena,
  onToggleFollow,
}) => {
  const [copied, setCopied] = useState(false);
  const targetAddress = profile?.address || viewerAddress;
  const isConnected = Boolean(viewerAddress);
  const isOwnProfile = !profile || profile.address === viewerAddress;

  const [followingList, setFollowingList] = useState<string[]>(() => getFollowingList(viewerAddress));
  const isFollowing = targetAddress ? followingList.includes(normalizeAddress(targetAddress) || "") : false;

  const handleToggleFollow = () => {
    if (!viewerAddress || !targetAddress) return;
    toggleFollowUser(viewerAddress, targetAddress);
    setFollowingList(getFollowingList(viewerAddress));
    onToggleFollow?.();
  };

  const nativeBalance = useNativeBalance(targetAddress);
  const stats = getPlayerStats(targetAddress);
  const matchHistory = getDuelHistory(targetAddress);

  const displayAddress = targetAddress
    ? `${targetAddress.slice(0, 6)}…${targetAddress.slice(-4)}`
    : "Not Connected";

  const handleCopy = () => {
    if (!targetAddress) return;
    navigator.clipboard.writeText(targetAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const balanceFormatted =
    targetAddress && nativeBalance.status === "ready" && nativeBalance.value !== undefined
      ? formatNativeBalance(nativeBalance.value)
      : targetAddress && nativeBalance.status === "loading"
      ? "Checking…"
      : targetAddress && nativeBalance.status === "error"
      ? "Unavailable"
      : null;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 pb-8">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary active:scale-95 transition-all rounded-xl hover:bg-surface-secondary flex items-center gap-1 text-sm font-semibold"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="text-xs font-mono font-semibold text-text-secondary">
            Monad Testnet • 10143
          </span>
        </div>
      </div>

      {/* Hero Profile Surface per design.md Section 3.1 & 8 */}
      <section
        className="rounded-3xl overflow-hidden bg-surface shadow-soft border border-border"
        aria-label="Duelist Profile"
      >
        {/* Monad Purple Header Banner */}
        <div className="relative h-40 sm:h-44 w-full bg-gradient-to-br from-monad-700 via-monad-600 to-monad-800 p-5 sm:p-6 flex flex-col justify-between text-white">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-sm">
              {isOwnProfile ? "Your Duelist Profile" : "Rival Duelist Profile"}
            </span>

            {targetAddress && (
              <a
                href={`https://testnet.monadscan.com/address/${targetAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold backdrop-blur-sm transition-all flex items-center gap-1"
              >
                <span>Monadscan</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Quick Metrics Bar on Banner */}
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-5 sm:gap-7">
              <div>
                <span className="font-mono font-bold text-xl sm:text-2xl leading-tight block">
                  {stats.elo}
                </span>
                <span className="text-[11px] text-white/80 font-medium uppercase tracking-wider">
                  ELO Rating
                </span>
              </div>
              <div>
                <span className="font-mono font-bold text-xl sm:text-2xl leading-tight block text-positive">
                  {stats.totalDuels > 0 ? `${(stats.winRate * 100).toFixed(0)}%` : "—"}
                </span>
                <span className="text-[11px] text-white/80 font-medium uppercase tracking-wider">
                  Win Rate
                </span>
              </div>
              <div>
                <span className="font-mono font-bold text-xl sm:text-2xl leading-tight block flex items-center gap-1">
                  <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>{stats.streak}</span>
                </span>
                <span className="text-[11px] text-white/80 font-medium uppercase tracking-wider">
                  Streak
                </span>
              </div>
            </div>

            {/* Apple-style Monogram Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-surface border-4 border-surface shadow-soft -mb-10 sm:-mb-12 shrink-0 flex items-center justify-center relative">
              <div className="w-full h-full rounded-xl bg-surface-secondary flex items-center justify-center font-mono font-bold text-xl sm:text-2xl text-monad-700">
                {targetAddress ? targetAddress.slice(2, 4).toUpperCase() : "??"}
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-positive border-2 border-surface" />
            </div>
          </div>
        </div>

        {/* Identity & Actions Container */}
        <div className="px-5 sm:px-7 pt-12 pb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
                  {profile?.name || (targetAddress ? `Duelist ${targetAddress.slice(2, 6)}` : "Guest Duelist")}
                </h2>
                <div className="w-5 h-5 rounded-full bg-monad-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
              </div>

              {targetAddress ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs font-semibold text-text-secondary">
                    {displayAddress}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-text-tertiary hover:text-text-primary transition-colors p-1 rounded hover:bg-surface-secondary"
                    aria-label="Copy wallet address"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-positive" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-text-secondary mt-1">
                  Connect your wallet to participate on Monad Testnet
                </p>
              )}
            </div>

            {/* Header Call to Actions */}
            {/* Header Call to Actions */}
            <div className="flex items-center gap-2">
              {!isOwnProfile && targetAddress && isConnected && (
                <button
                  onClick={handleToggleFollow}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all shadow-soft flex items-center gap-1 ${
                    isFollowing
                      ? "bg-surface border border-border text-text-primary hover:bg-surface-secondary"
                      : "bg-monad-600 hover:bg-monad-700 text-white"
                  }`}
                >
                  <span>{isFollowing ? "Following" : "Follow"}</span>
                </button>
              )}
              {isConnected ? (
                <>
                  <a
                    href="https://testnet.monad.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-secondary border border-border text-xs font-semibold text-text-primary flex items-center gap-1.5 active:scale-95 transition-all shadow-soft"
                  >
                    <span>Get MON</span>
                    <ExternalLink className="w-3 h-3 text-text-tertiary" />
                  </a>
                  {onArena && (
                    <button
                      onClick={onArena}
                      className="px-4 py-2 rounded-xl bg-monad-600 hover:bg-monad-700 text-xs font-semibold text-white flex items-center gap-1.5 active:scale-95 transition-all shadow-soft"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>{isOwnProfile ? "Enter Arena" : "Challenge"}</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={onConnect}
                  className="px-4 py-2 rounded-xl bg-monad-600 hover:bg-monad-700 text-xs font-semibold text-white flex items-center gap-1.5 active:scale-95 transition-all shadow-soft"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-surface-secondary border border-border space-y-1">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">
                Total Duels
              </span>
              <span className="font-mono font-bold text-lg text-text-primary">
                {stats.totalDuels}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-secondary border border-border space-y-1">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">
                Combat Record
              </span>
              <span className="font-mono font-bold text-lg text-text-primary">
                {stats.wins}W · {stats.losses}L
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-secondary border border-border space-y-1">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">
                Best Streak
              </span>
              <span className="font-mono font-bold text-lg text-amber-600">
                {stats.bestStreak}x
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-secondary border border-border space-y-1">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">
                Total MON Won
              </span>
              <span className="font-mono font-bold text-lg text-positive">
                +{stats.totalMonWon.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Two Column Section: Real On-Chain Wallet Balance & Session Security Policy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Real On-Chain Monad Balance Surface */}
        <section
          className="rounded-3xl bg-surface p-5 sm:p-6 border border-border shadow-soft space-y-4"
          aria-label="Monad Testnet Balance"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AssetLogo symbol="MON" size={24} />
              <h3 className="text-sm font-bold text-text-primary">
                Monad Testnet Wallet
              </h3>
            </div>
            {targetAddress && (
              <button
                onClick={nativeBalance.refresh}
                disabled={nativeBalance.status === "loading"}
                aria-label="Refresh balance"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-secondary active:scale-95 transition-all disabled:opacity-40"
              >
                <RefreshCw size={14} className={nativeBalance.status === "loading" ? "animate-spin" : ""} />
              </button>
            )}
          </div>

          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">
              Available Native Balance
            </span>
            {targetAddress && balanceFormatted !== null ? (
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-mono font-bold text-text-primary tracking-tight">
                  {balanceFormatted}
                </span>
                <span className="text-lg font-bold text-text-tertiary font-mono">
                  MON
                </span>
              </div>
            ) : (
              <div className="mt-1.5">
                <span className="text-sm font-semibold text-text-secondary">
                  Connect wallet to view live on-chain balance
                </span>
              </div>
            )}
            <p className="mt-1.5 text-xs text-text-secondary">
              Verified live on-chain against RPC https://testnet-rpc.monad.xyz
            </p>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
            <span className="text-text-secondary">Chain ID:</span>
            <span className="font-mono font-semibold text-text-primary">10143 (Testnet)</span>
          </div>
        </section>

        {/* Active Privy Session Signer & Escrow Security Policy */}
        <section
          className="rounded-3xl bg-surface p-5 sm:p-6 border border-border shadow-soft space-y-4"
          aria-label="Session Security Policy"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-monad-600" />
              <h3 className="text-sm font-bold text-text-primary">
                Privy Session Policy
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-positive/10 text-positive text-[11px] font-semibold font-mono border border-positive/20">
              ACTIVE
            </span>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">
            Duelio uses scoped delegated actions to submit 10-second clash outcomes without repeated wallet signature popups.
          </p>

          <div className="space-y-2 bg-surface-secondary p-3 rounded-2xl text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-text-tertiary">Max Spend / Clash:</span>
              <span className="font-semibold text-text-primary">{DUELIO_SESSION_POLICY.maxSpendMon} MON</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-tertiary">Session TTL:</span>
              <span className="font-semibold text-text-primary">{DUELIO_SESSION_POLICY.expiresInSeconds / 60} minutes</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-tertiary">Target Arena:</span>
              <span className="font-semibold text-monad-600 truncate max-w-[180px]">
                {DUEL_ARENA_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000" ? "Pending Deployment" : DUEL_ARENA_CONTRACT_ADDRESS}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/50 pt-2">
              <span className="text-text-tertiary">House Treasury:</span>
              <a
                href={`https://testnet.monadscan.com/address/${HOUSE_TREASURY_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-monad-600 hover:underline inline-flex items-center gap-1"
                title="View House Treasury on Monadscan"
              >
                <span>{HOUSE_TREASURY_ADDRESS.slice(0, 6)}…{HOUSE_TREASURY_ADDRESS.slice(-4)}</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* Recent 10-Second Duel History Section */}
      <section
        className="rounded-3xl bg-surface p-5 sm:p-6 border border-border shadow-soft space-y-4"
        aria-label="Duel Match History"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-tertiary" />
            <h3 className="text-sm font-bold text-text-primary">
              Recent 10s Clashes
            </h3>
          </div>
          <span className="text-xs font-mono text-text-tertiary">
            {matchHistory.length} Recorded
          </span>
        </div>

        {matchHistory.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-xs text-text-secondary">
              No recent duels recorded on this device yet.
            </p>
            {onArena && (
              <button
                onClick={onArena}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-monad-600 hover:text-monad-700"
              >
                <span>Play your first duel in the Arena →</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {matchHistory.slice(0, 8).map((duel) => {
              const isWin = duel.outcome === "WIN";
              const isLoss = duel.outcome === "LOSS";

              return (
                <div
                  key={duel.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AssetLogo symbol={duel.asset as any} size={24} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-text-primary">
                        <span>{duel.asset}/USD</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            duel.direction === "HIGHER"
                              ? "bg-positive/10 text-positive"
                              : "bg-negative/10 text-negative"
                          }`}
                        >
                          {duel.direction}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-text-tertiary">
                        Strike: ${duel.strikePrice.toFixed(2)} → Final: ${duel.settledPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono font-bold text-sm ${
                        isWin
                          ? "text-positive"
                          : isLoss
                          ? "text-negative"
                          : "text-text-secondary"
                      }`}
                    >
                      {isWin
                        ? `+${(duel.payout - duel.stake).toFixed(2)} MON`
                        : isLoss
                        ? `-${duel.stake.toFixed(2)} MON`
                        : "DRAW"}
                    </div>
                    <div className="text-[10px] font-mono text-text-tertiary">
                      {duel.eloDelta > 0 ? `+${duel.eloDelta}` : duel.eloDelta} ELO
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
