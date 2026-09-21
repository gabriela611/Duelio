import { normalizeAddress, canFollow } from "./identity.ts";
import { getDuelHistory, type DuelRecord } from "../duel/duelHistory.ts";

export interface SocialPost {
  id: string;
  authorAddress: string;
  authorName?: string;
  authorInitials: string;
  kind: "duels" | "milestones" | "challenges";
  eyebrow: string;
  title: string;
  description: string;
  timestamp: number;
  stakeMon?: number;
  asset?: string;
  duelId?: string;
  reactionsCount: number;
  isLiveChallenge?: boolean;
}

const STORAGE_KEY_USER_POSTS = "duelio_user_challenges_v1";
const STORAGE_KEY_LIKES = "duelio_social_likes_v1";
const STORAGE_KEY_FOLLOWS = "duelio_social_follows_v1";

// Realistic arena challenge seeds on Monad Testnet without fabricated financial payouts
const COMMUNITY_SEEDS: SocialPost[] = [
  {
    id: "genesis-challenge-1",
    authorAddress: "0x836EF90000000000000000000000000000000001",
    authorName: "Duelist Alpha",
    authorInitials: "DA",
    kind: "challenges",
    eyebrow: "Open 30s Arena Challenge",
    title: "Who can predict BTC in 30s?",
    description: "Looking for a rival in the 30-second arena. 0.1 MON stake ready on Monad Testnet.",
    timestamp: Date.now() - 1000 * 60 * 18,
    stakeMon: 0.1,
    asset: "BTC",
    reactionsCount: 14,
    isLiveChallenge: true,
  },
  {
    id: "genesis-challenge-2",
    authorAddress: "0x836EF90000000000000000000000000000000002",
    authorName: "MonadMaster",
    authorInitials: "MM",
    kind: "challenges",
    eyebrow: "Monad Testnet Duel",
    title: "ETH Speed Clash Challenge",
    description: "Ready for two-wallet on-chain duels with Pyth oracle settlement. Challenge open.",
    timestamp: Date.now() - 1000 * 60 * 60,
    stakeMon: 0.25,
    asset: "ETH",
    reactionsCount: 8,
    isLiveChallenge: true,
  },
];

export function getSocialFeed(): SocialPost[] {
  const customPosts: SocialPost[] = [];
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER_POSTS);
      if (raw) customPosts.push(...JSON.parse(raw));
    } catch {
      // Ignore parsing errors
    }
  }

  // Convert real duel records into feed events
  const duels = getDuelHistory();
  const duelPosts: SocialPost[] = duels.map((d: DuelRecord) => {
    const isWin = d.outcome === "WIN";
    const short = `${d.playerAddress.slice(0, 6)}…${d.playerAddress.slice(-4)}`;
    return {
      id: `feed_duel_${d.id}`,
      authorAddress: d.playerAddress,
      authorName: short,
      authorInitials: d.playerAddress.slice(2, 4).toUpperCase(),
      kind: "duels" as const,
      eyebrow: `${d.asset}/USD 10s Clash`,
      title: isWin ? `Victory: +${(d.payout - d.stake).toFixed(2)} MON` : `Settled: ${d.outcome}`,
      description: `Predicted ${d.direction} at $${d.strikePrice.toFixed(2)} (Settled: $${d.settledPrice.toFixed(2)}). Stake: ${d.stake} MON.`,
      timestamp: d.timestamp,
      stakeMon: d.stake,
      asset: d.asset,
      duelId: d.id,
      reactionsCount: isWin ? 5 : 1,
    };
  });

  const all = [...customPosts, ...duelPosts, ...COMMUNITY_SEEDS];
  // Sort newest first
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function fetchSocialFeed(viewerAddress?: string): Promise<SocialPost[]> {
  const localFeed = getSocialFeed();
  if (typeof window === "undefined") return localFeed;

  try {
    const url = viewerAddress
      ? `/api/social/feed?viewerAddress=${encodeURIComponent(viewerAddress)}`
      : "/api/social/feed";
    const res = await fetch(url);
    if (!res.ok) return localFeed;

    const data = await res.json();
    if (!data.success || !Array.isArray(data.feed)) return localFeed;

    const serverPosts: SocialPost[] = data.feed.map((ch: any) => ({
      id: ch.id,
      authorAddress: ch.authorAddress,
      authorName: ch.authorName,
      authorInitials: ch.authorInitials || "DU",
      kind: ch.kind || "challenges",
      eyebrow: ch.eyebrow || `${ch.asset || "BTC"} Duel Challenge`,
      title: ch.title,
      description: ch.description,
      timestamp: ch.timestamp || Date.now(),
      stakeMon: ch.stakeMon,
      asset: ch.asset,
      duelId: ch.duelId,
      reactionsCount: ch.reactionsCount || 0,
      isLiveChallenge: ch.isLiveChallenge !== false,
    }));

    // Convert real duel records into feed events
    const duels = getDuelHistory();
    const duelPosts: SocialPost[] = duels.map((d: DuelRecord) => {
      const isWin = d.outcome === "WIN";
      const short = `${d.playerAddress.slice(0, 6)}…${d.playerAddress.slice(-4)}`;
      return {
        id: `feed_duel_${d.id}`,
        authorAddress: d.playerAddress,
        authorName: short,
        authorInitials: d.playerAddress.slice(2, 4).toUpperCase(),
        kind: "duels" as const,
        eyebrow: `${d.asset}/USD 10s Clash`,
        title: isWin ? `Victory: +${(d.payout - d.stake).toFixed(2)} MON` : `Settled: ${d.outcome}`,
        description: `Predicted ${d.direction} at $${d.strikePrice.toFixed(2)} (Settled: $${d.settledPrice.toFixed(2)}). Stake: ${d.stake} MON.`,
        timestamp: d.timestamp,
        stakeMon: d.stake,
        asset: d.asset,
        duelId: d.id,
        reactionsCount: isWin ? 5 : 1,
      };
    });

    const combined = [...serverPosts, ...duelPosts];
    // Deduplicate by ID
    const seen = new Set<string>();
    const deduped: SocialPost[] = [];
    for (const post of combined) {
      if (!seen.has(post.id)) {
        seen.add(post.id);
        deduped.push(post);
      }
    }

    return deduped.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn("fetchSocialFeed network error, using local feed:", err);
    return localFeed;
  }
}

export function publishChallenge(
  authorAddress: string,
  title: string,
  description: string,
  asset: string = "BTC",
  stakeMon: number = 0.5,
  duelId?: string
): SocialPost {
  const norm = normalizeAddress(authorAddress) || authorAddress;
  const newPost: SocialPost = {
    id: `challenge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    authorAddress: norm,
    authorName: `${norm.slice(0, 6)}…${norm.slice(-4)}`,
    authorInitials: norm.slice(2, 4).toUpperCase(),
    kind: "challenges",
    eyebrow: `${asset} 10s Duel Challenge`,
    title,
    description,
    timestamp: Date.now(),
    stakeMon,
    asset,
    duelId,
    reactionsCount: 0,
    isLiveChallenge: true,
  };

  if (typeof window !== "undefined") {
    try {
      const existing = localStorage.getItem(STORAGE_KEY_USER_POSTS);
      const posts: SocialPost[] = existing ? JSON.parse(existing) : [];
      localStorage.setItem(STORAGE_KEY_USER_POSTS, JSON.stringify([newPost, ...posts]));
    } catch {
      // Storage restricted
    }

    // Fire asynchronous background persist to server
    fetch("/api/social/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorAddress: norm,
        title,
        description,
        asset,
        stakeMon,
        duelId,
      }),
    }).catch((err) => console.warn("Failed to persist challenge to server:", err));
  }

  return newPost;
}

export function getLikedPostIds(userAddress?: string): string[] {
  if (typeof window === "undefined") return [];
  const account = normalizeAddress(userAddress) || "guest";
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_LIKES}_${account}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleLike(postId: string, userAddress?: string): boolean {
  if (typeof window === "undefined") return false;
  const account = normalizeAddress(userAddress) || "guest";
  const current = getLikedPostIds(userAddress);
  const isLiked = current.includes(postId);
  const updated = isLiked ? current.filter((id) => id !== postId) : [...current, postId];

  try {
    localStorage.setItem(`${STORAGE_KEY_LIKES}_${account}`, JSON.stringify(updated));
  } catch {
    // Storage restricted
  }

  // Persist to server if wallet address exists
  if (userAddress) {
    fetch("/api/social/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, userAddress }),
    }).catch((err) => console.warn("Failed to sync like to server:", err));
  }

  return !isLiked;
}

export function getFollowingList(viewerAddress?: string): string[] {
  if (typeof window === "undefined") return [];
  const account = normalizeAddress(viewerAddress) || "guest";
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_FOLLOWS}_${account}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchFollowingList(viewerAddress?: string): Promise<string[]> {
  const localList = getFollowingList(viewerAddress);
  if (typeof window === "undefined" || !viewerAddress) return localList;

  try {
    const res = await fetch(`/api/social/follow?viewerAddress=${encodeURIComponent(viewerAddress)}`);
    if (!res.ok) return localList;
    const data = await res.json();
    if (data.success && Array.isArray(data.following)) {
      const merged = Array.from(new Set([...localList, ...data.following]));
      const account = normalizeAddress(viewerAddress) || "guest";
      localStorage.setItem(`${STORAGE_KEY_FOLLOWS}_${account}`, JSON.stringify(merged));
      return merged;
    }
    return localList;
  } catch {
    return localList;
  }
}

export function toggleFollowUser(viewerAddress?: string, targetAddress?: string): boolean {
  if (typeof window === "undefined" || !canFollow(viewerAddress, targetAddress)) return false;
  const viewer = normalizeAddress(viewerAddress)!;
  const target = normalizeAddress(targetAddress)!;

  const current = getFollowingList(viewer);
  const isFollowing = current.includes(target);
  const updated = isFollowing ? current.filter((addr) => addr !== target) : [...current, target];

  try {
    localStorage.setItem(`${STORAGE_KEY_FOLLOWS}_${viewer}`, JSON.stringify(updated));
  } catch {
    // Storage restricted
  }

  fetch("/api/social/follow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ viewerAddress: viewer, targetAddress: target }),
  }).catch((err) => console.warn("Failed to sync follow to server:", err));

  return !isFollowing;
}
