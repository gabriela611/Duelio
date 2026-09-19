"use client";

import React, { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { MobileShell, type ActiveTab } from "@/presentation/components/mobile-shell";
import { ArenaView } from "@/presentation/components/arena/ArenaView";
import { SpectatorWidget } from "@/presentation/components/spectator/SpectatorWidget";
import { LeaderboardView } from "@/presentation/components/leaderboard/LeaderboardView";
import { ProfileBadge } from "@/presentation/components/profile/ProfileBadge";

import { HomeView } from "@/presentation/components/home/HomeView";
import type { SampleProfile } from "@/domain/social/sampleActivity";
import { normalizeAddress } from "@/domain/social/identity";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [profile, setProfile] = useState<SampleProfile | undefined>();
  const { login, logout, authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();

  const activeWalletAddress =
    wallets?.[0]?.address ||
    user?.wallet?.address ||
    (user?.linkedAccounts?.find((account) => account.type === "wallet") as { address?: string } | undefined)?.address;

  const userAddress = authenticated ? normalizeAddress(activeWalletAddress) : undefined;

  const handleConnect = () => {
    if (authenticated) {
      logout();
    } else {
      login();
    }
  };

  const navigate = (tab: ActiveTab) => {
    setProfile(undefined);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <MobileShell
      activeTab={activeTab}
      onTabChange={navigate}
      userAddress={userAddress}
      onConnect={handleConnect}
    >
      {activeTab === "home" && <HomeView key={userAddress || "guest"} userAddress={userAddress} authenticated={authenticated} authReady={ready} onConnect={login} onNavigate={navigate} onProfile={(target) => { setProfile(target); setActiveTab("profile"); window.scrollTo({ top: 0, behavior: "instant" }); }} />}
      {activeTab === "arena" && <ArenaView userAddress={userAddress} onConnect={handleConnect} />}
      {activeTab === "spectate" && <SpectatorWidget />}
      {activeTab === "leaderboard" && <LeaderboardView userAddress={userAddress} onBack={() => setActiveTab("arena")} />}
      {activeTab === "profile" && <ProfileBadge key={`${userAddress || "guest"}:${profile?.address || "own"}`} viewerAddress={userAddress} profile={profile} onConnect={login} onArena={() => navigate("arena")} onBack={() => navigate("home")} />}
    </MobileShell>
  );
}
