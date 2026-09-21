"use client";

import React, { useState } from "react";
import { Swords, Send, Sparkles } from "lucide-react";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import { postTweet, type SocialPost } from "@/domain/social/socialService";

interface TweetComposerProps {
  userAddress?: string;
  onPostCreated?: (post: SocialPost) => void;
}

export const TweetComposer: React.FC<TweetComposerProps> = ({
  userAddress,
  onPostCreated,
}) => {
  const [content, setContent] = useState("");
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const [challengeAsset, setChallengeAsset] = useState<"BTC" | "ETH" | "SOL" | "MON">("BTC");
  const [challengeStake, setChallengeStake] = useState<number>(0.1);
  const [isPosting, setIsPosting] = useState(false);

  const initials = userAddress ? userAddress.slice(2, 4).toUpperCase() : "ME";
  const maxLength = 280;
  const charsRemaining = maxLength - content.length;

  const handleAddCashtag = (tag: string) => {
    setContent((prev) => (prev ? `${prev.trim()} $${tag} ` : `$${tag} `));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !userAddress || isPosting) return;

    setIsPosting(true);
    try {
      const created = await postTweet(
        userAddress,
        content.trim(),
        isChallengeMode ? challengeAsset : undefined,
        isChallengeMode ? challengeStake : undefined
      );
      setContent("");
      setIsChallengeMode(false);
      onPostCreated?.(created);
    } catch (err) {
      console.error("Failed to post tweet:", err);
    } finally {
      setIsPosting(false);
    }
  };

  if (!userAddress) return null;

  return (
    <div className="border-b border-border/70 bg-surface px-4 py-3.5 sm:px-6 transition-colors">
      <form onSubmit={handleSubmit} className="flex gap-3">
        {/* User Avatar */}
        <div className="shrink-0 pt-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-monad-600/10 border border-monad-500/20 text-xs font-bold font-mono text-monad-600 shadow-sm">
            {initials}
          </div>
        </div>

        {/* Input & Controls */}
        <div className="flex-1 space-y-2.5">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening in the arena? Share alpha or call out a rival..."
            rows={isChallengeMode ? 2 : 3}
            maxLength={maxLength}
            className="w-full resize-none bg-transparent text-sm sm:text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none leading-relaxed"
          />

          {/* Arena Challenge Drawer if toggled */}
          {isChallengeMode && (
            <div className="p-3 rounded-2xl bg-surface-secondary/70 border border-border/70 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
                <span className="flex items-center gap-1.5 text-monad-600 font-bold">
                  <Swords size={14} />
                  <span>Attach 30s Arena Duel Challenge</span>
                </span>
                <span className="text-[11px] text-text-secondary">Direct Monad Escrow</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {/* Asset selector */}
                <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border/60">
                  {(["BTC", "ETH", "SOL", "MON"] as const).map((ast) => (
                    <button
                      key={ast}
                      type="button"
                      onClick={() => setChallengeAsset(ast)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        challengeAsset === ast
                          ? "bg-monad-600 text-white shadow-sm"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <AssetLogo symbol={ast} size={14} />
                      <span>{ast}</span>
                    </button>
                  ))}
                </div>

                {/* Stake amount selector */}
                <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border/60">
                  {[0.05, 0.1, 0.25, 0.5].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setChallengeStake(amt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        challengeStake === amt
                          ? "bg-monad-600 text-white shadow-sm"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {amt} MON
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Cashtag & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
            {/* Quick Cashtags */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-tertiary font-medium hidden sm:inline">Tag:</span>
              {(["BTC", "ETH", "SOL", "MON"] as const).map((coin) => (
                <button
                  key={coin}
                  type="button"
                  onClick={() => handleAddCashtag(coin)}
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-surface-secondary hover:bg-neutral-200 border border-border/60 text-text-secondary hover:text-text-primary active:scale-95 transition-all"
                >
                  ${coin}
                </button>
              ))}

              {/* Challenge Toggle Button */}
              <button
                type="button"
                onClick={() => setIsChallengeMode(!isChallengeMode)}
                aria-pressed={isChallengeMode}
                className={`ml-1 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
                  isChallengeMode
                    ? "bg-monad-50 border-monad-300 text-monad-700 font-bold"
                    : "bg-surface border-border/60 text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
                }`}
              >
                <Swords size={13} className={isChallengeMode ? "text-monad-600" : ""} />
                <span>{isChallengeMode ? "Duel Attached" : "Add Duel"}</span>
              </button>
            </div>

            {/* Right: Counter + Post button */}
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-mono ${
                  charsRemaining < 20
                    ? "text-rose-500 font-bold"
                    : charsRemaining < 50
                    ? "text-amber-500"
                    : "text-text-tertiary"
                }`}
              >
                {charsRemaining}
              </span>

              <button
                type="submit"
                disabled={!content.trim() || isPosting}
                className="rounded-full bg-monad-600 hover:bg-monad-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold px-4 py-1.5 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Send size={13} />
                <span>{isPosting ? "Posting…" : "Post"}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
