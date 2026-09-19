import { normalizeAddress, canFollow } from "@/domain/social/identity";
import { getDuelHistory, DuelRecord } from "@/domain/duel/duelHistory";

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

// Default community seeds on Monad Testnet
const COMMUNITY_SEEDS: SocialPost[] = [
  {
    id: "genesis-challenge-1",
    authorAddress: "0x836EF90000000000000000000000000000000001",
    authorName: "Duelist Alpha",
    authorInitials: "DA",
    kind: "challenges",
    eyebrow: "Open 10s Arena Challenge",
    title: "Who can predict BTC in 10s?",
    description: "Looking for a rival in the 10-second arena. 0.5 MON stake ready. Let's see who has the best reflexes.",
    timestamp: Date.now() - 1000 * 60 * 18,
    stakeMon: 0.5,
    asset: "BTC",
    reactionsCount: 14,
    isLiveChallenge: true,
  },
  {
    id: "genesis-duel-1",
    authorAddress: "0x836EF90000000000000000000000000000000002",
    authorName: "SpeedRunner",
    authorInitials: "SR",
    kind: "duels",
    eyebrow: "Settled Speed Clash",
    title: "SOL/USD 10s Clash Victory",
    description: "Called HIGHER at $142.10 right before the hermes oracle tick. Net payout +0.98 MON on Monad Testnet.",
    timestamp: Date.now() - 1000 * 60 * 45,
    stakeMon: 0.5,
    asset: "SOL",
    reactionsCount: 29,
  },
  {
    id: "genesis-milestone-1",
    authorAddress: "0x836EF90000000000000000000000000000000003",
    authorName: "MonadMaster",
    authorInitials: "MM",
    kind: "milestones",
    eyebrow: "Arena Milestone",
    title: "5x Win Streak Unlocked",
    description: "Maintained a 100% win rate across 5 consecutive directional clashes. Climbing the rankings.",
    timestamp: Date.now() - 1000 * 60 * 120,
    reactionsCount: 42,
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

export function publishChallenge(
  authorAddress: string,
  title: string,
  description: string,
  asset: string = "BTC",
  stakeMon: number = 0.5
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

  return !isFollowing;
}
