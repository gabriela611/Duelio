"use client";

import React, { useState } from "react";
import {
  MessageCircle,
  Repeat2,
  Heart,
  Share2,
  Check,
  Swords,
  Send,
  MoreHorizontal,
  TrendingUp,
  ExternalLink,
  Copy,
  User,
} from "lucide-react";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import type { SocialPost, TweetReply } from "@/domain/social/socialService";
import { postReply, toggleRepost, toggleLike } from "@/domain/social/socialService";

interface TweetCardProps {
  post: SocialPost;
  userAddress?: string;
  isLiked?: boolean;
  isReposted?: boolean;
  onLike?: (id: string) => void;
  onRepost?: (id: string) => void;
  onAcceptChallenge?: (duelId?: string) => void;
  onProfileClick?: (address: string, name?: string, initials?: string) => void;
}

// Utility to highlight $CASHTAGS
function formatTweetContent(text: string) {
  const parts = text.split(/(\$[A-Z]{2,6})/g);
  return parts.map((part, index) => {
    if (part.startsWith("$") && part.length <= 6) {
      return (
        <span
          key={index}
          className="font-bold text-monad-600 hover:underline cursor-pointer"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export const TweetCard: React.FC<TweetCardProps> = ({
  post,
  userAddress,
  isLiked: initialLiked = false,
  isReposted: initialReposted = false,
  onLike,
  onRepost,
  onAcceptChallenge,
  onProfileClick,
}) => {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount || post.reactionsCount || 0);

  const [isReposted, setIsReposted] = useState(initialReposted);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount || 0);

  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<TweetReply[]>(post.replies || []);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikesCount((prev) => (isLiked ? Math.max(0, prev - 1) : prev + 1));
    toggleLike(post.id, userAddress);
    onLike?.(post.id);
  };

  const handleRepost = () => {
    setIsReposted(!isReposted);
    setRepostsCount((prev) => (isReposted ? Math.max(0, prev - 1) : prev + 1));
    toggleRepost(post.id, userAddress);
    onRepost?.(post.id);
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(`${window.location.origin}/#post-${post.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !userAddress || isSubmittingReply) return;

    setIsSubmittingReply(true);
    try {
      const newReply = await postReply(post.id, userAddress, replyText.trim());
      if (newReply) {
        setReplies((prev) => [...prev, newReply]);
        setReplyText("");
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const authorShort = post.authorName || `${post.authorAddress.slice(0, 6)}…${post.authorAddress.slice(-4)}`;
  const isChallenge = post.isLiveChallenge || post.kind === "challenges";
  const isSettledDuel = post.kind === "duels";
  const assetSymbol = (post.asset || "BTC") as "BTC" | "ETH" | "SOL" | "MON";
  const stakeMon = post.stakeMon || 0.1;

  return (
    <article
      id={`post-${post.id}`}
      className="border-b border-border/60 hover:bg-surface-secondary/25 transition-colors px-4 py-3.5 sm:px-6"
    >
      <div className="flex gap-3">
        {/* Author Avatar */}
        <div className="shrink-0 pt-0.5">
          <button
            type="button"
            onClick={() => onProfileClick?.(post.authorAddress, post.authorName, post.authorInitials)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary border border-border text-xs font-bold font-mono text-monad-700 hover:ring-2 hover:ring-monad-500/30 active:scale-95 transition-all shadow-2xs"
            aria-label={`View profile for ${authorShort}`}
          >
            {post.authorInitials}
          </button>
        </div>

        {/* Content Column */}
        <div className="flex-1 min-w-0">
          {/* Top Line: Username + Relative Time + More Actions Menu */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <button
                type="button"
                onClick={() => onProfileClick?.(post.authorAddress, post.authorName, post.authorInitials)}
                className="font-bold text-text-primary text-sm hover:underline truncate"
              >
                {authorShort}
              </button>
              <span className="text-xs text-text-tertiary">
                {formatRelativeTime(post.timestamp)}
              </span>
            </div>

            {/* Context Menu Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-secondary/60 transition-colors"
                aria-label="Post actions"
              >
                <MoreHorizontal size={16} />
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-surface border border-border shadow-elevated py-1 z-20 text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyLink();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-surface-secondary text-text-primary transition-colors"
                  >
                    <Copy size={13} />
                    <span>Copy link to post</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onProfileClick?.(post.authorAddress, post.authorName, post.authorInitials);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-surface-secondary text-text-primary transition-colors"
                  >
                    <User size={13} />
                    <span>View player profile</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Activity Headline (Zapper-style: e.g. "Bought 77M REGENT for $2,124") */}
          {isChallenge ? (
            <div className="mt-1">
              <div className="text-sm font-semibold text-text-primary flex items-center gap-1.5 flex-wrap">
                <span>Opened 30s Arena Challenge in</span>
                <span className="font-bold">{assetSymbol}/USD</span>
                <span>for</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-monad-50 text-monad-700 font-mono font-bold text-xs border border-monad-200">
                  {stakeMon} MON
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-secondary mt-0.5">
                <span className="text-monad-600 font-semibold">⚔️ Open for Rival</span>
                <span>·</span>
                <span>Monad Testnet Escrow</span>
              </div>
            </div>
          ) : isSettledDuel ? (
            <div className="mt-1">
              <div className="text-sm font-semibold text-text-primary flex items-center gap-1.5 flex-wrap">
                <span>Won 30s Duel Clash on</span>
                <span className="font-bold">{assetSymbol}</span>
                <span>for</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-positive/10 text-positive font-mono font-bold text-xs border border-positive/20">
                  +{(stakeMon * 1.95).toFixed(2)} MON
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-text-secondary mt-0.5">
                <span className="text-positive font-semibold">▲ Settled Outcome</span>
                <span>·</span>
                <span>100% On-Chain</span>
              </div>
            </div>
          ) : null}

          {/* Post Content / Alpha Description (if available) */}
          {(post.content || (!isChallenge && !isSettledDuel && (post.description || post.title))) && (
            <p className="mt-1.5 text-sm sm:text-[15px] text-text-primary leading-relaxed break-words whitespace-pre-wrap">
              {formatTweetContent(post.content || post.description || post.title || "")}
            </p>
          )}

          {/* Embedded Token / Duel Card (Zapper-style embed) */}
          {(isChallenge || isSettledDuel || post.asset) && (
            <div className="mt-2.5 p-3 rounded-2xl bg-surface-secondary/40 hover:bg-surface-secondary/70 border border-border/80 flex items-center justify-between gap-3 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface border border-border/70 flex items-center justify-center shrink-0 shadow-2xs">
                  <AssetLogo symbol={assetSymbol} size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text-primary truncate">
                      {assetSymbol}
                    </span>
                    <span className="text-[11px] font-mono text-text-tertiary">
                      30s Speed Duel
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary font-mono flex items-center gap-1.5 truncate">
                    <span>Stake: {stakeMon} MON</span>
                    <span className="text-text-tertiary">·</span>
                    <span className="text-monad-600 font-semibold">1.95x Payout</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              {isChallenge ? (
                <button
                  type="button"
                  onClick={() => onAcceptChallenge?.(post.duelId)}
                  className="px-4 py-2 rounded-xl bg-monad-600 hover:bg-monad-700 active:scale-95 text-white text-xs font-bold shadow-soft transition-all shrink-0 flex items-center gap-1.5"
                >
                  <Swords size={13} />
                  <span>Accept</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAcceptChallenge?.(post.duelId)}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-secondary border border-border text-text-primary active:scale-95 text-xs font-bold shadow-2xs transition-all shrink-0 flex items-center gap-1.5"
                >
                  <TrendingUp size={13} />
                  <span>Duel</span>
                </button>
              )}
            </div>
          )}

          {/* Social Interaction Row (Reply, Repost, Like, Share) */}
          <div className="flex items-center justify-between max-w-md pt-2 mt-1 text-text-tertiary">
            {/* 1. Reply Button */}
            <button
              type="button"
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center gap-1.5 text-xs group hover:text-sky-500 active:scale-95 transition-colors"
              aria-label="Reply"
            >
              <div className="p-1.5 rounded-full group-hover:bg-sky-50 transition-colors">
                <MessageCircle size={15} />
              </div>
              <span className={`font-mono ${showReplies ? "text-sky-500 font-bold" : ""}`}>
                {replies.length > 0 ? replies.length : ""}
              </span>
            </button>

            {/* 2. Repost Button */}
            <button
              type="button"
              onClick={handleRepost}
              className={`flex items-center gap-1.5 text-xs group transition-colors active:scale-95 ${
                isReposted ? "text-positive font-bold" : "hover:text-positive"
              }`}
              aria-label="Repost"
            >
              <div className="p-1.5 rounded-full group-hover:bg-positive/10 transition-colors">
                <Repeat2 size={16} className={isReposted ? "rotate-180 transition-transform" : ""} />
              </div>
              <span className="font-mono">{repostsCount > 0 ? repostsCount : ""}</span>
            </button>

            {/* 3. Like Button */}
            <button
              type="button"
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-xs group transition-colors active:scale-95 ${
                isLiked ? "text-rose-500 font-bold" : "hover:text-rose-500"
              }`}
              aria-label="Like"
            >
              <div className="p-1.5 rounded-full group-hover:bg-rose-50 transition-colors">
                <Heart size={15} fill={isLiked ? "currentColor" : "none"} />
              </div>
              <span className="font-mono">{likesCount > 0 ? likesCount : ""}</span>
            </button>

            {/* 4. Share Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-xs group hover:text-monad-600 active:scale-95 transition-colors"
              aria-label="Share"
            >
              <div className="p-1.5 rounded-full group-hover:bg-monad-50 transition-colors">
                {copied ? <Check size={15} className="text-positive" /> : <Share2 size={15} />}
              </div>
              <span className="text-[11px] font-medium">{copied ? "Copied" : ""}</span>
            </button>
          </div>

          {/* Inline Replies Thread */}
          {showReplies && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-3 animate-in fade-in duration-150">
              {replies.length > 0 && (
                <div className="space-y-2.5">
                  {replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2.5 text-xs">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary border border-border text-[10px] font-bold font-mono text-monad-700">
                        {reply.authorInitials}
                      </div>
                      <div className="flex-1 bg-surface-secondary/40 p-2.5 rounded-xl border border-border/50">
                        <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                          <span>{reply.authorName}</span>
                          <span className="text-[10px] text-text-tertiary">·</span>
                          <span className="text-[10px] text-text-tertiary">
                            {formatRelativeTime(reply.timestamp)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-text-secondary leading-relaxed">
                          {formatTweetContent(reply.content)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Composer Input */}
              {userAddress ? (
                <form onSubmit={handleSendReply} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Post your reply..."
                    className="flex-1 bg-surface-secondary px-3 py-1.5 rounded-full text-xs text-text-primary placeholder:text-text-tertiary border border-border/60 focus:outline-none focus:border-monad-600 transition-colors"
                    maxLength={280}
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSubmittingReply}
                    className="px-3.5 py-1.5 rounded-full bg-monad-600 hover:bg-monad-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                  >
                    <Send size={11} />
                    <span>Reply</span>
                  </button>
                </form>
              ) : (
                <p className="text-[11px] text-text-tertiary italic">
                  Connect your wallet to reply to this duel thread.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
