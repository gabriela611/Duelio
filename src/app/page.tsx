"use client";

import React, { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { MobileShell, type ActiveTab } from "@/presentation/components/mobile-shell";
import { ArenaView } from "@/presentation/components/arena/ArenaView";
import { SpectatorWidget } from "@/presentation/components/spectator/SpectatorWidget";
import { LeaderboardView } from "@/presentation/components/leaderboard/LeaderboardView";
import { ProfileBadge } from "@/presentation/components/profile/ProfileBadge";

import { HomeView } from "@/presentation/components/home/HomeView";
import type { SampleProfile } from "@/domain/social/sampleActivity";
import { canFollow, normalizeAddress, toggleFollow } from "@/domain/social/identity";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [profile, setProfile] = useState<SampleProfile | undefined>();
  const { login, logout, authenticated, ready, user } = usePrivy();

  const userAddress = authenticated ? normalizeAddress(user?.wallet?.address) : undefined;

  const identityKey = userAddress || (authenticated ? "pending-wallet" : "guest");
  const [social, setSocial] = useState<{ account: string; liked: string[]; following: string[] }>({ account: identityKey, liked: [], following: [] });
  const currentSocial = social.account === identityKey ? social : { account: identityKey, liked: [], following: [] };
  useEffect(() => { setSocial({ account: identityKey, liked: [], following: [] }); }, [identityKey]);
  const reactToStory = (id: string) => setSocial((current) => {
    const liked = current.account === identityKey ? current.liked : [];
    return { ...(current.account === identityKey ? current : { account: identityKey, following: [] }), liked: liked.includes(id) ? liked.filter((value) => value !== id) : [...liked, id] };
  });
  const followProfile = () => {
    if (!canFollow(userAddress, profile?.address)) return;
    const target = normalizeAddress(profile?.address)!;
    setSocial((current) => {
      const following = current.account === identityKey ? current.following : [];
      const next = toggleFollow(following.includes(target), userAddress, target);
      return { ...(current.account === identityKey ? current : { account: identityKey, liked: [] }), following: next ? [...following, target] : following.filter((value) => value !== target) };
    });
  };

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
      {activeTab === "home" && <HomeView liked={currentSocial.liked} onReaction={reactToStory} key={userAddress || "guest"} userAddress={userAddress} authenticated={authenticated} authReady={ready} onConnect={login} onNavigate={navigate} onProfile={(target) => { setProfile(target); setActiveTab("profile"); window.scrollTo({ top: 0, behavior: "instant" }); }} />}
      {activeTab === "arena" && <ArenaView userAddress={userAddress} />}
      {activeTab === "spectate" && <SpectatorWidget />}
      {activeTab === "leaderboard" && <LeaderboardView onBack={() => setActiveTab("arena")} />}
      {activeTab === "profile" && <ProfileBadge following={currentSocial.following.includes(normalizeAddress(profile?.address) || "")} onToggleFollow={followProfile} key={`${userAddress || "guest"}:${profile?.address || "own"}`} viewerAddress={userAddress} profile={profile} onConnect={login} onArena={() => navigate("arena")} onBack={() => navigate("home")} />}
    </MobileShell>
  );
}
