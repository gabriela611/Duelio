"use client";

import React from "react";
import { Swords, Eye, Trophy, Shield, Zap } from "lucide-react";

interface MobileShellProps {
  children: React.ReactNode;
  activeTab: "arena" | "spectate" | "leaderboard" | "profile";
  onTabChange: (tab: "arena" | "spectate" | "leaderboard" | "profile") => void;
  userAddress?: string;
  onConnect?: () => void;
  syncStatus?: { isLive: boolean; block: number };
}

export const MobileShell: React.FC<MobileShellProps> = ({
  children,
  activeTab,
  onTabChange,
  userAddress,
  onConnect,
  syncStatus,
}) => {
  return (
    <div className="min-h-screen bg-black flex justify-center items-center py-0 sm:py-6 font-sans antialiased selection:bg-monad-500 selection:text-white">
      {/* Phone container frame for mobile-first feel */}
      <div className="w-full max-w-md min-h-screen sm:min-h-[850px] sm:max-h-[920px] sm:rounded-3xl bg-duel-bg border border-duel-border shadow-2xl flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="px-4 py-3 bg-duel-surface/90 backdrop-blur-md border-b border-duel-border/60 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-monad-700 via-monad-500 to-duel-cyan flex items-center justify-center shadow-glow-monad">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-lg tracking-wider bg-gradient-to-r from-white via-slate-100 to-monad-300 bg-clip-text text-transparent">
                DUELIO
              </span>
              <div className="flex items-center gap-1.5 -mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-monad-300">
                  Monad 10143
                </span>
              </div>
            </div>
          </div>

          {/* Right Header: Envio status badge & Privy wallet button */}
          <div className="flex items-center gap-2">
            {syncStatus && (
              <div className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full bg-duel-card border border-duel-border text-[10px] text-slate-400">
                <Zap className="w-2.5 h-2.5 text-duel-cyan" />
                <span>Envio #{syncStatus.block.toString().slice(-4)}</span>
              </div>
            )}

            <button
              onClick={onConnect}
              className="px-3 py-1.5 rounded-xl bg-monad-500 hover:bg-monad-600 active:scale-95 transition-all text-xs font-bold text-white shadow-glow-monad flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>
                {userAddress
                  ? `${userAddress.slice(0, 4)}...${userAddress.slice(-3)}`
                  : "Login (Privy)"}
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Main Viewport */}
        <main className="flex-1 overflow-y-auto relative no-scrollbar pb-20">
          {children}
        </main>

        {/* Bottom Navigation Dock (Clash Royale Style) */}
        <nav className="absolute bottom-0 left-0 right-0 h-16 bg-duel-surface/95 backdrop-blur-lg border-t border-duel-border flex items-center justify-around px-2 z-30">
          <button
            onClick={() => onTabChange("arena")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === "arena"
                ? "text-monad-400 scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === "arena" ? "bg-monad-500/20 shadow-glow-monad" : ""
              }`}
            >
              <Swords className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">Arena</span>
          </button>

          <button
            onClick={() => onTabChange("spectate")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === "spectate"
                ? "text-duel-cyan scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === "spectate" ? "bg-duel-cyan/20 shadow-glow-cyan" : ""
              }`}
            >
              <Eye className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">Spectate</span>
          </button>

          <button
            onClick={() => onTabChange("leaderboard")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === "leaderboard"
                ? "text-duel-gold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === "leaderboard" ? "bg-duel-gold/20 shadow-glow-gold" : ""
              }`}
            >
              <Trophy className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">Rank</span>
          </button>

          <button
            onClick={() => onTabChange("profile")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === "profile"
                ? "text-purple-300 scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === "profile" ? "bg-purple-500/20" : ""
              }`}
            >
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
