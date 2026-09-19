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
    <div className="app-shell min-h-dvh bg-background text-text-primary font-sans antialiased selection:bg-text-primary selection:text-white flex flex-col">
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Clean iOS-Style Top Navigation per design.md Section 12 */}
      <header className="sticky top-0 z-40 bg-surface border-b border-border shadow-soft">
        <div className="safe-inline max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">

          {/* Brand Logo - Native & Disciplined */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onTabChange("home")}
              className="flex items-center gap-2.5 text-left group active:scale-95 transition-transform duration-100"
              aria-label="Duelio Home"
            >
              <div className="w-8 h-8 rounded-xl bg-monad-600 flex items-center justify-center text-white shadow-soft">
                <Swords className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base tracking-tight text-text-primary block leading-none">
                duelio
              </span>
            </button>
          </div>

          {/* Desktop Textual Tabs with Thin Underline per design.md Section 13 */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-8 h-full">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  aria-pressed={isActive}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative h-full flex items-center gap-1.5 text-sm font-semibold transition-colors duration-150 ${
                    isActive
                      ? "text-text-primary font-bold"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <span aria-hidden="true" className={isActive ? "text-monad-600" : "text-text-secondary"}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-monad-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Primary Action Connect Button in Monad Purple */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onConnect}
              aria-label={userAddress ? "Disconnect wallet" : "Connect wallet"}
              className="h-10 px-4 rounded-xl bg-monad-600 hover:bg-monad-700 active:scale-95 transition-all text-xs font-semibold text-white shadow-soft flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              <span>
                {userAddress
                  ? `${userAddress.slice(0, 5)}…${userAddress.slice(-4)}`
                  : "Connect Wallet"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="app-content safe-inline flex-1 w-full min-w-0 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 lg:pt-6">
        <h1 className="sr-only">{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
        {children}
      </main>

      {/* Clean Mobile iOS Bottom Tab Bar per design.md Section 12 */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 z-40"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              aria-pressed={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`flex min-w-0 flex-col justify-center items-center gap-1 py-1 px-0.5 transition-colors active:scale-95 ${
                isActive ? "text-monad-600 font-bold" : "text-text-secondary"
              }`}
            >
              <span aria-hidden="true" className={isActive ? "text-monad-600" : "text-text-secondary"}>
                {tab.icon}
              </span>
              <span className="text-[11px] leading-tight truncate max-w-full font-medium">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
