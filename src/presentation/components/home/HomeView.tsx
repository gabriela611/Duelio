"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  RefreshCw,
  Swords,
  Plus,
} from "lucide-react";
import { formatNativeBalance, normalizeAddress } from "@/domain/social/identity";
import { useNativeBalance } from "@/presentation/hooks/useNativeBalance";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import type { ActiveTab } from "@/presentation/components/mobile-shell";
import {
  getSocialFeed,
  fetchSocialFeed,
  type SocialPost,
  getLikedPostIds,
  getRepostedPostIds,
  getFollowingList,
  fetchFollowingList,
} from "@/domain/social/socialService";
import type { SampleProfile } from "@/domain/social/sampleActivity";
import { getPlayerStats } from "@/domain/duel/duelHistory";
import { TweetComposer } from "@/presentation/components/social/TweetComposer";
import { TweetCard } from "@/presentation/components/social/TweetCard";

interface HomeViewProps {
  liked?: string[];
  onReaction?: (id: string) => void;
  userAddress?: string;
  authenticated: boolean;
  authReady: boolean;
  onConnect: () => void;
  onNavigate: (tab: ActiveTab, duelId?: string) => void;
  onProfile: (profile: SampleProfile) => void;
}

export function HomeView({
  userAddress,
  authenticated,
  authReady,
  onConnect,
  onNavigate,
  onProfile,
}: HomeViewProps) {
  const balance = useNativeBalance(userAddress);
  const [hidden, setHidden] = useState(false);
  const [filter, setFilter] = useState<"all" | "challenges" | "duels" | "following">("all");
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Real social feed state
  const [feed, setFeed] = useState<SocialPost[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [repostedIds, setRepostedIds] = useState<string[]>([]);
  const [followingAddrs, setFollowingAddrs] = useState<string[]>([]);

  const loadSocialData = useCallback(async () => {
    // Immediate local cache
    setFeed(getSocialFeed());
    setLikedIds(getLikedPostIds(userAddress));
    setRepostedIds(getRepostedPostIds(userAddress));
    setFollowingAddrs(getFollowingList(userAddress));

    // Server-side persistent sync
    try {
      const [serverFeed, serverFollowing] = await Promise.all([
        fetchSocialFeed(userAddress),
        fetchFollowingList(userAddress),
      ]);
      setFeed(serverFeed);
      setFollowingAddrs(serverFollowing);
      setLikedIds(getLikedPostIds(userAddress));
      setRepostedIds(getRepostedPostIds(userAddress));
    } catch {
      // Keep local feed on network error
    }
  }, [userAddress]);

  useEffect(() => {
    loadSocialData();
  }, [loadSocialData]);

  const handlePostCreated = (post: SocialPost) => {
    setFeed((prev) => [post, ...prev]);
    loadSocialData();
  };

  const handleLike = () => {
    setLikedIds(getLikedPostIds(userAddress));
  };

  const handleRepost = () => {
    setRepostedIds(getRepostedPostIds(userAddress));
  };

  const openAuthorProfile = (address: string, name?: string, initials?: string) => {
    const stats = getPlayerStats(address);
    onProfile({
      name: name || `${address.slice(0, 6)}…${address.slice(-4)}`,
      address,
      initials: initials || address.slice(2, 4).toUpperCase(),
      wins: stats.wins,
      duels: stats.totalDuels,
      rank: 1,
      elo: stats.elo,
    });
  };

  const filteredFeed = feed.filter((item) => {
    if (filter === "following") {
      const normAuthor = normalizeAddress(item.authorAddress);
      return normAuthor && followingAddrs.includes(normAuthor);
    }
    if (filter === "challenges") return item.kind === "challenges" || item.isLiveChallenge;
    if (filter === "duels") return item.kind === "duels";
    return true;
  });

  const balanceLabel = !authReady
    ? "Connecting to Monad Testnet…"
    : !authenticated
    ? "Connect your wallet to enter the arena"
    : !userAddress
    ? "Wallet initializing…"
    : balance.status === "loading"
    ? "Querying on-chain balance…"
    : balance.status === "error"
    ? "Balance unavailable"
    : "Live on Monad Testnet";

  return (
    <div className="home-view mx-auto w-full max-w-2xl space-y-6 pb-12 relative">
      {/* Primary Balance Surface per design.md Section 3.3 */}
      <section
        className="rounded-3xl bg-surface p-5 sm:p-7 border border-border shadow-soft space-y-5"
        aria-label="Wallet balance"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <AssetLogo symbol="MON" size={22} />
            <span>Monad Account</span>
          </div>
          <div className="flex items-center gap-1">
            {authenticated && userAddress && (
              <>
                <button
                  onClick={balance.refresh}
                  disabled={balance.status === "loading"}
                  aria-label="Refresh balance"
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-secondary active:scale-95 transition-all disabled:opacity-40"
                >
                  <RefreshCw size={16} className={balance.status === "loading" ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setHidden(!hidden)}
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                  aria-pressed={hidden}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-secondary active:scale-95 transition-all"
                >
                  {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          {authenticated && userAddress ? (
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1" aria-live="polite" aria-atomic="true">
              <span className="balance-amount text-text-primary font-bold tracking-tight">
                {hidden
                  ? "••••"
                  : balance.status === "ready" && balance.value !== undefined
                  ? formatNativeBalance(balance.value)
                  : "—"}
              </span>
              <span className="text-xl sm:text-2xl font-bold text-text-tertiary font-mono">MON</span>
            </div>
          ) : (
            <div className="py-1">
              <span className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight block">
                Session Not Started
              </span>
            </div>
          )}
          <p className="mt-2 text-sm text-text-secondary font-medium" role="status">
            {balanceLabel}
          </p>
          <p className="mt-0.5 text-xs text-text-tertiary">
            Monad Testnet • Chain ID 10143
          </p>
        </div>

        {/* Primary and Secondary Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => (authenticated ? onNavigate("arena") : onConnect())}
            disabled={!authReady}
            className="h-12 rounded-2xl bg-monad-600 hover:bg-monad-700 text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-soft disabled:opacity-50"
          >
            {authenticated ? <Swords size={17} /> : <ArrowDownLeft size={17} />}
            <span>{authenticated ? "Enter 10s Arena" : "Connect Wallet"}</span>
          </button>
          <button
            onClick={() => onNavigate("spectate")}
            className="h-12 rounded-2xl border border-border bg-surface hover:bg-surface-secondary text-text-primary font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-soft"
          >
            <ArrowUpRight size={17} />
            <span>Spectate & Predict</span>
          </button>
        </div>
      </section>

      {/* Zapper-Inspired Social Feed Container */}
      <section className="rounded-3xl border border-border bg-surface overflow-hidden shadow-soft" aria-label="Timeline feed">
        {/* Sticky Header: Brand Title & Account Pill */}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-border/70">
          <div className="flex items-center justify-between px-5 pt-3.5 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-text-primary">
                duelio
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-monad-50 text-monad-700 border border-monad-200">
                Feed
              </span>
            </div>

            {/* Top Right Mini Account Pill (Zapper style: avatar + balance) */}
            {authenticated && userAddress ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-secondary/70 border border-border/70 shadow-2xs text-xs font-semibold">
                <div className="w-5 h-5 rounded-full bg-monad-600 text-white flex items-center justify-center text-[10px] font-mono font-bold">
                  {userAddress.slice(2, 4).toUpperCase()}
                </div>
                <span className="font-mono text-text-primary">
                  {balance.status === "ready" && balance.value !== undefined
                    ? `${formatNativeBalance(balance.value)} MON`
                    : "0.00 MON"}
                </span>
              </div>
            ) : (
              <button
                onClick={onConnect}
                className="px-3 py-1 rounded-full bg-monad-600/10 hover:bg-monad-600/20 text-monad-700 text-xs font-bold transition-colors"
              >
                Connect
              </button>
            )}
          </div>

          {/* Segmented Navigation Tabs (For You / Duels / Settled / Following) with Underline */}
          <div className="flex items-center border-t border-border/40 px-2 overflow-x-auto no-scrollbar">
            {(
              [
                { id: "all", label: "For You" },
                { id: "challenges", label: "Open Duels" },
                { id: "duels", label: "Settled" },
                { id: "following", label: "Following" },
              ] as const
            ).map((tab) => {
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`relative py-3 px-4 text-sm font-semibold whitespace-nowrap transition-colors active:scale-95 ${
                    isActive
                      ? "text-text-primary font-bold"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-monad-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Continuous Stream of Cards */}
        <div className="divide-y divide-border/60">
          {filteredFeed.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <p className="text-sm font-semibold text-text-primary">
                {filter === "following"
                  ? "You aren't following anyone yet."
                  : filter === "challenges"
                  ? "No open arena challenges right now."
                  : "No posts in this stream."}
              </p>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                {filter === "following"
                  ? "When you follow traders from duel matches or the leaderboard, their alpha and challenges will appear here."
                  : "Tap the + button below to share market alpha or issue an open 30s arena duel challenge!"}
              </p>
            </div>
          ) : (
            filteredFeed.map((post) => (
              <TweetCard
                key={post.id}
                post={post}
                userAddress={userAddress}
                isLiked={likedIds.includes(post.id)}
                isReposted={repostedIds.includes(post.id)}
                onLike={handleLike}
                onRepost={handleRepost}
                onAcceptChallenge={(duelId) => onNavigate("arena", duelId)}
                onProfileClick={(addr, name, initials) => openAuthorProfile(addr, name, initials)}
              />
            ))
          )}
        </div>
      </section>

      {/* Floating Action Button (FAB) - Zapper style lilac/purple rounded squircle */}
      {authenticated && userAddress && (
        <button
          type="button"
          onClick={() => setIsComposerOpen(true)}
          aria-label="New post or duel challenge"
          className="fixed bottom-20 right-5 lg:bottom-8 lg:right-10 z-30 w-12 h-12 rounded-2xl bg-monad-600 hover:bg-monad-700 active:scale-90 text-white shadow-elevated flex items-center justify-center transition-all group"
        >
          <Plus size={22} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-200" />
        </button>
      )}

      {/* Modal Composer Popup */}
      <TweetComposer
        userAddress={userAddress}
        onPostCreated={handlePostCreated}
        mode="modal"
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
      />
    </div>
  );
}
