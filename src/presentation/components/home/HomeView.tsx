"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Heart,
  RefreshCw,
  Swords,
  Send,
  CheckCircle2,
  Flame,
  Share2,
  Check,
} from "lucide-react";
import { formatNativeBalance, normalizeAddress } from "@/domain/social/identity";
import { useNativeBalance } from "@/presentation/hooks/useNativeBalance";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import type { ActiveTab } from "@/presentation/components/mobile-shell";
import {
  getSocialFeed,
  publishChallenge,
  toggleLike,
  getLikedPostIds,
  getFollowingList,
  type SocialPost,
} from "@/domain/social/socialService";
import type { SampleProfile } from "@/domain/social/sampleActivity";
import { getPlayerStats } from "@/domain/duel/duelHistory";

interface HomeViewProps {
  liked?: string[];
  onReaction?: (id: string) => void;
  userAddress?: string;
  authenticated: boolean;
  authReady: boolean;
  onConnect: () => void;
  onNavigate: (tab: ActiveTab) => void;
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

  // Real social feed state
  const [feed, setFeed] = useState<SocialPost[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [followingAddrs, setFollowingAddrs] = useState<string[]>([]);

  // Challenge composer state
  const [challengeText, setChallengeText] = useState("");
  const [challengeAsset, setChallengeAsset] = useState<"BTC" | "ETH" | "SOL" | "MON">("BTC");
  const [challengeStake, setChallengeStake] = useState<number>(0.5);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadSocialData = useCallback(() => {
    setFeed(getSocialFeed());
    setLikedIds(getLikedPostIds(userAddress));
    setFollowingAddrs(getFollowingList(userAddress));
  }, [userAddress]);

  useEffect(() => {
    loadSocialData();
  }, [loadSocialData]);

  const handlePublishChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeText.trim() || !userAddress) return;
    setIsPublishing(true);

    publishChallenge(
      userAddress,
      `10s ${challengeAsset} Challenge: ${challengeStake} MON`,
      challengeText.trim(),
      challengeAsset,
      challengeStake
    );

    setChallengeText("");
    setIsPublishing(false);
    loadSocialData();
  };

  const handleLike = (postId: string) => {
    toggleLike(postId, userAddress);
    setLikedIds(getLikedPostIds(userAddress));
    setFeed((prev) =>
      prev.map((item) => {
        if (item.id === postId) {
          const wasLiked = likedIds.includes(postId);
          return {
            ...item,
            reactionsCount: Math.max(0, item.reactionsCount + (wasLiked ? -1 : 1)),
          };
        }
        return item;
      })
    );
  };

  const handleCopyPost = (id: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(`${window.location.origin}/#post-${id}`);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const openAuthorProfile = (post: SocialPost) => {
    const stats = getPlayerStats(post.authorAddress);
    onProfile({
      name: post.authorName || `${post.authorAddress.slice(0, 6)}…${post.authorAddress.slice(-4)}`,
      address: post.authorAddress,
      initials: post.authorInitials,
      wins: stats.wins,
      duels: stats.totalDuels,
      rank: 1,
      elo: stats.elo,
    });
  };

  const filters = [
    { id: "all" as const, label: "For you" },
    { id: "challenges" as const, label: "Challenges" },
    { id: "duels" as const, label: "Duels" },
    { id: "following" as const, label: "Following" },
  ];

  const filteredFeed = feed.filter((item) => {
    if (filter === "challenges") return item.kind === "challenges";
    if (filter === "duels") return item.kind === "duels";
    if (filter === "following") {
      const normAuthor = normalizeAddress(item.authorAddress);
      return normAuthor && followingAddrs.includes(normAuthor);
    }
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
    <div className="home-view mx-auto w-full max-w-2xl space-y-6 pb-6">
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
            {userAddress && (
              <button
                onClick={balance.refresh}
                disabled={balance.status === "loading"}
                aria-label="Refresh balance"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-secondary active:scale-95 transition-all disabled:opacity-40"
              >
                <RefreshCw size={16} className={balance.status === "loading" ? "animate-spin" : ""} />
              </button>
            )}
            <button
              onClick={() => setHidden(!hidden)}
              aria-label={hidden ? "Show balance" : "Hide balance"}
              aria-pressed={hidden}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-secondary active:scale-95 transition-all"
            >
              {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1" aria-live="polite" aria-atomic="true">
            <span className="balance-amount text-text-primary font-bold tracking-tight">
              {hidden
                ? "••••"
                : balance.status === "ready" && balance.value !== undefined
                ? formatNativeBalance(balance.value)
                : "0.00"}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-text-tertiary font-mono">MON</span>
          </div>
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

      {/* Interactive Arena Challenge Composer */}
      {authenticated && userAddress && (
        <section
          className="rounded-3xl border border-border bg-surface p-4 sm:p-5 shadow-soft space-y-3"
          aria-label="Post a duel challenge"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wide">
            <Swords className="w-4 h-4 text-monad-600" />
            <span>Issue a 10s Duel Challenge</span>
          </div>

          <form onSubmit={handlePublishChallenge} className="space-y-3">
            <input
              type="text"
              value={challengeText}
              onChange={(e) => setChallengeText(e.target.value)}
              placeholder="Call out the arena (e.g. Can anyone beat my 10s BTC prediction?)…"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-secondary border border-border text-xs sm:text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-monad-600 transition-colors"
              maxLength={140}
            />

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
              {/* Asset & Stake Pickers */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center bg-surface-secondary p-0.5 rounded-xl border border-border">
                  {(["BTC", "ETH", "SOL", "MON"] as const).map((ast) => (
                    <button
                      key={ast}
                      type="button"
                      onClick={() => setChallengeAsset(ast)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        challengeAsset === ast
                          ? "bg-surface text-text-primary shadow-soft"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {ast}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center bg-surface-secondary p-0.5 rounded-xl border border-border">
                  {[0.1, 0.5, 1.0].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setChallengeStake(amt)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                        challengeStake === amt
                          ? "bg-surface text-text-primary shadow-soft"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {amt} MON
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Challenge Button */}
              <button
                type="submit"
                disabled={!challengeText.trim() || isPublishing}
                className="px-4 py-2 rounded-xl bg-monad-600 hover:bg-monad-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft active:scale-95 transition-all disabled:opacity-40"
              >
                <Send size={13} />
                <span>Broadcast</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Community Feed Container */}
      <section className="space-y-4" aria-labelledby="community-heading">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 id="community-heading" className="text-xl font-bold tracking-tight text-text-primary">
              Community Pulse
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Live duelist challenges and verified Monad Testnet match settlements.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-surface border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary shadow-soft">
            Live Feed
          </span>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1" aria-label="Activity filters">
          {filters.map((item) => {
            const isActive = filter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                aria-pressed={isActive}
                className={`h-9 px-4 rounded-full text-xs font-semibold transition-all duration-120 whitespace-nowrap active:scale-95 shrink-0 ${
                  isActive
                    ? "bg-monad-600 text-white font-bold shadow-soft"
                    : "bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Real Dynamic Social Feed Cards */}
        <div className="space-y-4">
          {filteredFeed.length === 0 ? (
            <div className="py-12 px-4 rounded-3xl bg-surface border border-border text-center space-y-2">
              <p className="text-sm font-semibold text-text-primary">
                {filter === "following" ? "You are not following any duelists yet" : "No activity matching this filter"}
              </p>
              <p className="text-xs text-text-secondary">
                {filter === "following"
                  ? "Explore duelists on the leaderboard or in the arena and tap Follow to curate your feed."
                  : "Issue a new challenge or play in the 10-second arena to generate live activity."}
              </p>
            </div>
          ) : (
            filteredFeed.map((post) => {
              const isLiked = likedIds.includes(post.id);

              return (
                <article
                  key={post.id}
                  className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-soft space-y-4"
                >
                  {/* Post Header: Author Avatar & Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => openAuthorProfile(post)}
                      className="flex items-center gap-2.5 rounded-full pr-3 py-1 text-xs font-bold text-text-primary bg-surface-secondary hover:bg-neutral-200 border border-border active:scale-95 transition-all"
                      aria-label={`View profile for ${post.authorName}`}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-[11px] font-bold border border-border font-mono text-monad-700">
                        {post.authorInitials}
                      </span>
                      <span className="truncate max-w-[140px] sm:max-w-none font-mono">
                        {post.authorName}
                      </span>
                      <ArrowUpRight size={13} className="text-text-secondary shrink-0" />
                    </button>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          post.kind === "challenges"
                            ? "bg-monad-50 text-monad-700 border-monad-200"
                            : post.kind === "duels"
                            ? "bg-positive/10 text-positive border-positive/20"
                            : "bg-surface-secondary text-text-tertiary border-border"
                        }`}
                      >
                        {post.kind === "challenges" ? "Open Challenge" : post.kind === "duels" ? "Match Settled" : "Milestone"}
                      </span>
                    </div>
                  </div>

                  {/* Post Body */}
                  <div>
                    <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                      {post.eyebrow}
                    </p>
                    <h3 className="mt-1 text-lg sm:text-xl font-bold leading-snug tracking-tight text-text-primary">
                      {post.title}
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-text-secondary font-normal">
                      {post.description}
                    </p>

                    {/* Challenge Banner if live */}
                    {post.isLiveChallenge && (
                      <div className="mt-3 p-3 rounded-2xl bg-monad-50/70 border border-monad-200/60 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AssetLogo symbol={(post.asset || "BTC") as any} size={20} />
                          <div className="text-xs">
                            <span className="font-bold text-text-primary block">
                              10s Clash Stake: {post.stakeMon || 0.5} MON
                            </span>
                            <span className="text-[11px] text-text-secondary">
                              Target Asset: {post.asset || "BTC"}/USD
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => onNavigate("arena")}
                          className="px-3.5 py-1.5 rounded-xl bg-monad-600 hover:bg-monad-700 text-white text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all shadow-soft"
                        >
                          <Swords size={13} />
                          <span>Accept</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Post Footer Actions */}
                  <div className="flex items-center justify-between gap-2 border-t border-border pt-3.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLike(post.id)}
                        aria-label="Like post"
                        aria-pressed={isLiked}
                        className={`h-8 flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold active:scale-95 transition-all border ${
                          isLiked
                            ? "bg-rose-50 border-rose-200 text-rose-600"
                            : "bg-surface border-border hover:bg-surface-secondary text-text-secondary"
                        }`}
                      >
                        <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
                        <span>{post.reactionsCount}</span>
                      </button>

                      <button
                        onClick={() => handleCopyPost(post.id)}
                        aria-label="Share post"
                        className="h-8 flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold bg-surface border border-border hover:bg-surface-secondary text-text-secondary active:scale-95 transition-all"
                      >
                        {copiedId === post.id ? <Check size={13} className="text-positive" /> : <Share2 size={13} />}
                        <span>{copiedId === post.id ? "Copied" : "Share"}</span>
                      </button>
                    </div>

                    <button
                      onClick={() => onNavigate(post.kind === "duels" ? "arena" : "leaderboard")}
                      className="h-8 flex items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-text-primary bg-surface-secondary hover:bg-neutral-200 active:scale-95 transition-all"
                    >
                      <span>{post.kind === "duels" ? "Enter Arena" : "View Leaderboard"}</span>
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
