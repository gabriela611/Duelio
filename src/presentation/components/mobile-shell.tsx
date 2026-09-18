"use client";

import React from "react";
import {
  Swords,
  Trophy,
  Zap,
  ShieldCheck,
  User,
  Activity,
} from "lucide-react";

export type ActiveTab = "arena" | "spectate" | "leaderboard" | "profile";

interface MobileShellProps {
  children: React.ReactNode;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
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
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "arena", label: "Arena", icon: <Swords className="w-4 h-4" /> },
    { id: "spectate", label: "Predictions", icon: <Activity className="w-4 h-4" /> },
    { id: "leaderboard", label: "Rankings", icon: <Trophy className="w-4 h-4" /> },
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-text-primary font-sans antialiased selection:bg-accent selection:text-white flex flex-col">
      {/* Clean iOS-style Top Navigation */}
      <header className="sticky top-0 z-40 bg-surface border-b border-border shadow-soft">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

          {/* Brand Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onTabChange("arena")}
              className="flex items-center gap-2.5 text-left group active:scale-95 transition-transform duration-100"
            >
              <div className="w-9 h-9 rounded-xl bg-monad-600 flex items-center justify-center shadow-2xs">
                <Swords className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-text-primary block leading-tight">
                  DUELIO
                </span>
                <span className="text-[10px] font-semibold text-monad-600 tracking-tight block leading-tight">
                  Monad Arena
                </span>
              </div>
            </button>

            {/* Monad Chain Tag */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-secondary text-[11px] font-medium text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse"></span>
              <span>Testnet</span>
            </div>
          </div>

          {/* Clean Tab Navigation */}
          <nav className="flex items-center bg-surface-secondary p-1 rounded-2xl">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center gap-1.5 active:scale-95 ${
                    isActive
                      ? "bg-surface text-text-primary shadow-2xs"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <span className={isActive ? "text-monad-600" : "text-text-tertiary"}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Status & Connect Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            {syncStatus && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-secondary text-[11px] font-mono text-text-secondary">
                <Zap className="w-3 h-3 text-monad-500" />
                <span>#{syncStatus.block.toString().slice(-4)}</span>
              </div>
            )}

            <button
              onClick={onConnect}
              className="px-4 py-1.5 rounded-full bg-text-primary hover:bg-text-primary/90 active:scale-95 transition-all duration-100 text-xs font-semibold text-white shadow-2xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-monad-400" />
              <span>
                {userAddress
                  ? `${userAddress.slice(0, 4)}...${userAddress.slice(-3)}`
                  : "Connect"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        {children}
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border flex items-center justify-around px-2 z-40 pb-safe">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors duration-150 active:scale-95 ${
                isActive ? "text-monad-600" : "text-text-tertiary"
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
