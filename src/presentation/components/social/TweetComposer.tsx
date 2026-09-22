"use client";

import React, { useState } from "react";
import { Swords, Send, X, Sparkles } from "lucide-react";
import { AssetLogo } from "@/presentation/components/common/AssetLogo";
import { postTweet, type SocialPost } from "@/domain/social/socialService";

interface TweetComposerProps {
  userAddress?: string;
  onPostCreated?: (post: SocialPost) => void;
  mode?: "inline" | "modal";
  isOpen?: boolean;
  onClose?: () => void;
}

export const TweetComposer: React.FC<TweetComposerProps> = ({
  userAddress,
  onPostCreated,
  mode = "inline",
  isOpen = false,
  onClose,
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
      if (mode === "modal") {
        onClose?.();
      }
    } catch (err) {
      console.error("Failed to post tweet:", err);
    } finally {
      setIsPosting(false);
    }
  };

  if (!userAddress) return null;

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        {/* User Avatar */}
        <div className="shrink-0 pt-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-monad-600/10 border border-monad-500/20 text-xs font-bold font-mono text-monad-600 shadow-2xs">
            {initials}
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share market alpha, analyze 30s charts, or issue an open duel challenge..."
            rows={isChallengeMode ? 3 : 4}
            maxLength={maxLength}
            className="w-full resize-none bg-transparent text-sm sm:text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none leading-relaxed"
            autoFocus={mode === "modal"}
          />
        </div>
      </div>

      {/* Arena Challenge Configurator */}
      {isChallengeMode && (
        <div className="p-3.5 rounded-2xl bg-surface-secondary/70 border border-border/80 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
            <span className="flex items-center gap-1.5 text-monad-600 font-bold">
              <Swords size={14} />
              <span>Attach 30s Arena Duel Challenge</span>
            </span>
            <span className="text-[11px] text-text-secondary font-mono">100% Monad Escrow</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* Asset selector */}
            <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border/70 shadow-2xs">
              {(["BTC", "ETH", "SOL", "MON"] as const).map((ast) => (
                <button
                  key={ast}
                  type="button"
                  onClick={() => setChallengeAsset(ast)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
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
            <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border/70 shadow-2xs">
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

      {/* Footer / Cashtags / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
        {/* Cashtags */}
        <div className="flex items-center gap-1.5 flex-wrap">
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

          {/* Duel toggle button */}
          <button
            type="button"
            onClick={() => setIsChallengeMode(!isChallengeMode)}
            aria-pressed={isChallengeMode}
            className={`ml-1 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
              isChallengeMode
                ? "bg-monad-50 border-monad-300 text-monad-700 font-bold"
                : "bg-surface border-border/60 text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
            }`}
          >
            <Swords size={13} className={isChallengeMode ? "text-monad-600" : ""} />
            <span>{isChallengeMode ? "Duel Attached" : "Attach Duel"}</span>
          </button>
        </div>

        {/* Counter and Submit Button */}
        <div className="flex items-center gap-3 ml-auto">
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
            className="rounded-xl bg-monad-600 hover:bg-monad-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold px-4 py-2 flex items-center gap-1.5 shadow-soft active:scale-95 transition-all"
          >
            <Send size={13} />
            <span>{isPosting ? "Posting…" : "Post"}</span>
          </button>
        </div>
      </div>
    </form>
  );

  if (mode === "modal") {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="w-full max-w-lg rounded-3xl bg-surface border border-border shadow-elevated p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-text-primary">New Post</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary text-text-secondary font-mono">
                Social Feed
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              aria-label="Close composer"
            >
              <X size={18} />
            </button>
          </div>
          {formBody}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border/60 bg-surface px-4 py-3.5 sm:px-6 transition-colors">
      {formBody}
    </div>
  );
};
