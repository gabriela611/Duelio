"use client";

import React, { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { MobileShell } from "@/presentation/components/mobile-shell";
import { ArenaView } from "@/presentation/components/arena/ArenaView";
import { SpectatorWidget } from "@/presentation/components/spectator/SpectatorWidget";
import { LeaderboardView } from "@/presentation/components/leaderboard/LeaderboardView";
import { ProfileBadge } from "@/presentation/components/profile/ProfileBadge";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"arena" | "spectate" | "leaderboard" | "profile">("arena");
  const { login, logout, authenticated, user } = usePrivy();

  const userAddress = user?.wallet?.address || (authenticated ? "0x836E...0001" : undefined);

  const handleConnect = () => {
    if (authenticated) {
      logout();
    } else {
      login();
    }
  };

  return (
    <MobileShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userAddress={userAddress}
      onConnect={handleConnect}
      syncStatus={{ isLive: true, block: 1014388 }}
    >
      {activeTab === "arena" && <ArenaView userAddress={userAddress} />}
      {activeTab === "spectate" && <SpectatorWidget />}
      {activeTab === "leaderboard" && <LeaderboardView />}
      {activeTab === "profile" && <ProfileBadge />}
    </MobileShell>
  );
}
