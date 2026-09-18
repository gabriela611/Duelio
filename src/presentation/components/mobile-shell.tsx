"use client";

import React from "react";
import {
  Swords,
  Trophy,
  House,
  ShieldCheck,
  User,
  Activity,
} from "lucide-react";

export type ActiveTab = "home" | "arena" | "spectate" | "leaderboard" | "profile";

interface MobileShellProps {
  children: React.ReactNode;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  userAddress?: string;
  onConnect?: () => void;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  children,
  activeTab,
  onTabChange,
  userAddress,
  onConnect,
}) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <House className="w-4 h-4" /> },
    { id: "arena", label: "Arena", icon: <Swords className="w-4 h-4" /> },
    { id: "spectate", label: "Predictions", icon: <Activity className="w-4 h-4" /> },
    { id: "leaderboard", label: "Rankings", icon: <Trophy className="w-4 h-4" /> },
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="app-shell min-h-dvh bg-background text-text-primary font-sans antialiased selection:bg-accent selection:text-white flex flex-col">
      <a href="#main-content" className="skip-link">Skip to content</a>
      {/* Clean iOS-style Top Navigation */}
      <header className="app-header sticky top-0 z-40 border-b border-border shadow-soft">
        <div className="safe-inline max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

          {/* Brand Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onTabChange("home")}
              className="flex items-center gap-2.5 text-left group active:scale-95 transition-transform duration-100"
            >
              <div className="w-9 h-9 rounded-xl bg-text-primary flex items-center justify-center shadow-2xs">
                <Swords className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-text-primary block leading-tight">
                  duelio
                </span>
                <span className="text-[10px] font-semibold text-monad-600 tracking-tight block leading-tight">
                  Play. Connect. Rise.
                </span>
              </div>
            </button>

          </div>

          {/* Clean Tab Navigation */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center bg-surface-secondary/90 p-1.5 rounded-2xl border border-border/80 backdrop-blur-md">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  aria-pressed={isActive}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 active:scale-95 ${
                    isActive
                      ? "bg-slate-200/90 text-text-primary border border-slate-300 font-bold shadow-xs"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary/60"
                  }`}
                >
                  <span aria-hidden="true" className={isActive ? "text-monad-600" : "text-text-secondary"}>
                    <span aria-hidden="true" className="[&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Status & Connect Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onConnect}
              aria-label={userAddress ? "Disconnect wallet" : "Connect wallet"}
              className="px-4 py-1.5 rounded-full bg-text-primary hover:bg-text-primary/90 active:scale-95 transition-[background-color,color,transform] duration-100 text-xs font-semibold text-white shadow-2xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-monad-400" />
              <span>
                {userAddress
                  ? `${userAddress.slice(0, 4)}…${userAddress.slice(-3)}`
                  : "Connect"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main id="main-content" tabIndex={-1} className="app-content safe-inline flex-1 w-full min-w-0 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 lg:pt-6">
        <h1 className="sr-only">{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
        {children}
      </main>

      {/* Mobile Bottom Bar */}
      <nav aria-label="Main navigation" className="app-tab-bar safe-inline lg:hidden fixed bottom-0 left-0 right-0 border-t border-border grid grid-cols-5 px-1 sm:px-2 z-40">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              aria-pressed={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`flex min-w-0 flex-col justify-center items-center gap-1 py-1.5 px-0.5 rounded-2xl transition-all duration-150 active:scale-95 ${
                isActive
                  ? "bg-slate-200/90 text-text-primary border border-slate-300/80 font-bold shadow-xs"
                  : "text-text-secondary hover:bg-surface-secondary/70"
              }`}
            >
              <span aria-hidden="true" className={`[&>svg]:h-5 [&>svg]:w-5 ${isActive ? "text-monad-600" : "text-text-secondary"}`}>
                {tab.icon}
              </span>
              <span className="text-[10px] font-semibold truncate max-w-full leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
