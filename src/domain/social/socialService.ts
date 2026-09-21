import { normalizeAddress, canFollow } from "./identity.ts";
import { getDuelHistory, type DuelRecord } from "../duel/duelHistory.ts";

export interface TweetReply {
  id: string;
  authorAddress: string;
  authorName: string;
  authorInitials: string;
  content: string;
  timestamp: number;
}

export interface SocialPost {
  id: string;
  authorAddress: string;
  authorName?: string;
  authorInitials: string;
  kind: "duels" | "milestones" | "challenges" | "tweets";
  eyebrow: string;
  title: string;
  description: string;
  content?: string;
  timestamp: number;
  stakeMon?: number;
  asset?: string;
  duelId?: string;
  reactionsCount: number;
  likesCount?: number;
  isLiked?: boolean;
  repostsCount?: number;
  isReposted?: boolean;
  repliesCount?: number;
  replies?: TweetReply[];
  isLiveChallenge?: boolean;
}

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
    description: "Looking for a rival in the 30-second arena. 0.1 MON stake ready on Monad Testnet. $BTC looking volatile!",
    content: "Looking for a rival in the 30-second arena. 0.1 MON stake ready on Monad Testnet. $BTC looking volatile!",
    timestamp: 1774180000000,
    stakeMon: 0.1,
    asset: "BTC",
    reactionsCount: 14,
    likesCount: 14,
    repostsCount: 3,
    repliesCount: 1,
    replies: [
      {
        id: "reply-genesis-1",
        authorAddress: "0x836EF90000000000000000000000000000000002",
        authorName: "MonadMaster",
        authorInitials: "MM",
        content: "Accepted! Let's see your prediction reflexes on $BTC.",
        timestamp: 1774180400000,
      },
    ],
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
    description: "Ready for two-wallet on-chain duels with Pyth oracle settlement. Challenge open on $ETH.",
    content: "Ready for two-wallet on-chain duels with Pyth oracle settlement. Challenge open on $ETH.",
    timestamp: 1774176400000,
    stakeMon: 0.25,
    asset: "ETH",
    reactionsCount: 8,
    likesCount: 8,
    repostsCount: 1,
    repliesCount: 0,
    replies: [],
    isLiveChallenge: true,
  },
  {
    id: "genesis-tweet-3",
    authorAddress: "0x836EF90000000000000000000000000000000003",
    authorName: "CryptoWhale",
    authorInitials: "CW",
    kind: "tweets",
    eyebrow: "Market Alpha",
    title: "Monad sub-second finality is unmatched",
    description: "Testing $MON execution speed against Pyth oracle ticks in Duelio. 10,000 TPS makes on-chain PvP trading feel like Web2.",
    content: "Testing $MON execution speed against Pyth oracle ticks in Duelio. 10,000 TPS makes on-chain PvP trading feel like Web2.",
    timestamp: 1774170000000,
    reactionsCount: 23,
    likesCount: 23,
    repostsCount: 6,
    repliesCount: 2,
    replies: [],
  },
];

// Client-side in-memory cache — ZERO localStorage dependency
let clientPosts: SocialPost[] = [];
const clientLikes = new Map<string, Set<string>>(); // account -> Set<postId>
const clientReposts = new Map<string, Set<string>>(); // account -> Set<postId>
const clientFollows = new Map<string, Set<string>>(); // viewer -> Set<target>

export function getSocialFeed(): SocialPost[] {
  // Convert real on-chain duel records into feed events
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
      content: `Predicted ${d.direction} on $${d.asset} at $${d.strikePrice.toFixed(2)}. Settled at $${d.settledPrice.toFixed(2)}.`,
      timestamp: d.timestamp,
      stakeMon: d.stake,
      asset: d.asset,
      duelId: d.onChainDuelId || d.id,
      reactionsCount: isWin ? 5 : 1,
      likesCount: isWin ? 5 : 1,
      repostsCount: 0,
      repliesCount: 0,
      replies: [],
    };
  });

  const all = [...clientPosts, ...duelPosts, ...COMMUNITY_SEEDS];
  const unique = new Map<string, SocialPost>();
  for (const post of all) {
    if (!unique.has(post.id)) {
      unique.set(post.id, post);
    }
  }

  return Array.from(unique.values()).sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Fetches durable server feed without touching localStorage
 */
export async function fetchSocialFeed(viewerAddress?: string): Promise<SocialPost[]> {
  if (typeof window === "undefined") {
    return getSocialFeed();
  }

  try {
    const url = viewerAddress
      ? `/api/social/feed?viewerAddress=${encodeURIComponent(viewerAddress)}`
      : "/api/social/feed";
    const res = await fetch(url);
    if (!res.ok) return getSocialFeed();

    const data = await res.json();
    if (data.success && Array.isArray(data.feed)) {
      const serverPosts: SocialPost[] = data.feed.map((item: any) => ({
        id: item.id,
        authorAddress: item.authorAddress,
        authorName: item.authorName || `${item.authorAddress.slice(0, 6)}…${item.authorAddress.slice(-4)}`,
        authorInitials: item.authorInitials || item.authorAddress.slice(2, 4).toUpperCase(),
        kind: item.kind || "challenges",
        eyebrow: item.eyebrow || "Arena Challenge",
        title: item.title,
        description: item.description,
        content: item.content || item.description,
        timestamp: item.timestamp,
        stakeMon: item.stakeMon,
        asset: item.asset,
        duelId: item.duelId,
        reactionsCount: item.reactionsCount ?? item.likesCount ?? 0,
        likesCount: item.likesCount ?? item.reactionsCount ?? 0,
        isLiked: Boolean(item.isLiked),
        repostsCount: item.repostsCount ?? 0,
        isReposted: Boolean(item.isReposted),
        repliesCount: item.repliesCount ?? (item.replies ? item.replies.length : 0),
        replies: item.replies || [],
        isLiveChallenge: Boolean(item.isLiveChallenge || item.stakeMon),
      }));

      // Update in-memory cache
      clientPosts = serverPosts;

      // Also incorporate any local duel records
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
          content: `Predicted ${d.direction} on $${d.asset} at $${d.strikePrice.toFixed(2)}. Settled at $${d.settledPrice.toFixed(2)}.`,
          timestamp: d.timestamp,
          stakeMon: d.stake,
          asset: d.asset,
          duelId: d.onChainDuelId || d.id,
          reactionsCount: isWin ? 5 : 1,
          likesCount: isWin ? 5 : 1,
          repostsCount: 0,
          repliesCount: 0,
          replies: [],
        };
      });

      const merged = [...serverPosts, ...duelPosts];
      const unique = new Map<string, SocialPost>();
      for (const p of merged) {
        if (!unique.has(p.id)) unique.set(p.id, p);
      }
      return Array.from(unique.values()).sort((a, b) => b.timestamp - a.timestamp);
    }
  } catch (err) {
    console.warn("Failed to fetch server social feed:", err);
  }

  return getSocialFeed();
}

export function postChallenge(
  authorAddress: string,
  title: string,
  description: string,
  asset: string,
  stakeMon: number,
  duelId?: string
): SocialPost {
  const norm = normalizeAddress(authorAddress) || authorAddress;
  const newPost: SocialPost = {
    id: `tweet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    authorAddress: norm,
    authorName: `${norm.slice(0, 6)}…${norm.slice(-4)}`,
    authorInitials: norm.slice(2, 4).toUpperCase(),
    kind: "challenges",
    eyebrow: `${asset} 10s Duel Challenge`,
    title,
    description,
    content: description,
    timestamp: Date.now(),
    stakeMon,
    asset,
    duelId,
    reactionsCount: 0,
    likesCount: 0,
    repostsCount: 0,
    repliesCount: 0,
    replies: [],
    isLiveChallenge: true,
  };

  clientPosts.unshift(newPost);

  if (typeof window !== "undefined") {
    fetch("/api/social/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorAddress: norm,
        title,
        description,
        content: description,
        asset,
        stakeMon,
        duelId,
        kind: "challenges",
      }),
    }).catch((err) => console.warn("Failed to persist challenge to server:", err));
  }

  return newPost;
}

export function getLikedPostIds(userAddress?: string): string[] {
  const account = normalizeAddress(userAddress) || "guest";
  const likesSet = clientLikes.get(account);
  return likesSet ? Array.from(likesSet) : [];
}

export function toggleLike(postId: string, userAddress?: string): boolean {
  const account = normalizeAddress(userAddress) || "guest";
  let likesSet = clientLikes.get(account);
  if (!likesSet) {
    likesSet = new Set<string>();
    clientLikes.set(account, likesSet);
  }

  const isLiked = likesSet.has(postId);
  if (isLiked) {
    likesSet.delete(postId);
  } else {
    likesSet.add(postId);
  }

  if (typeof window !== "undefined" && userAddress) {
    fetch("/api/social/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, userAddress }),
    }).catch((err) => console.warn("Failed to sync like to server:", err));
  }

  return !isLiked;
}

export function getFollowingList(viewerAddress?: string): string[] {
  const account = normalizeAddress(viewerAddress) || "guest";
  const followsSet = clientFollows.get(account);
  return followsSet ? Array.from(followsSet) : [];
}

export async function fetchFollowingList(viewerAddress?: string): Promise<string[]> {
  const localList = getFollowingList(viewerAddress);
  if (typeof window === "undefined" || !viewerAddress) return localList;

  try {
    const res = await fetch(`/api/social/follow?viewerAddress=${encodeURIComponent(viewerAddress)}`);
    if (!res.ok) return localList;
    const data = await res.json();
    if (data.success && Array.isArray(data.following)) {
      const account = normalizeAddress(viewerAddress)!;
      clientFollows.set(account, new Set(data.following));
      return data.following;
    }
    return localList;
  } catch {
    return localList;
  }
}

export function toggleFollowUser(viewerAddress?: string, targetAddress?: string): boolean {
  if (!canFollow(viewerAddress, targetAddress)) return false;
  const viewer = normalizeAddress(viewerAddress)!;
  const target = normalizeAddress(targetAddress)!;

  let followsSet = clientFollows.get(viewer);
  if (!followsSet) {
    followsSet = new Set<string>();
    clientFollows.set(viewer, followsSet);
  }

  const isFollowing = followsSet.has(target);
  if (isFollowing) {
    followsSet.delete(target);
  } else {
    followsSet.add(target);
  }

  if (typeof window !== "undefined") {
    fetch("/api/social/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewerAddress: viewer, targetAddress: target }),
    }).catch((err) => console.warn("Failed to sync follow to server:", err));
  }

  return !isFollowing;
}

export function getRepostedPostIds(userAddress?: string): string[] {
  const account = normalizeAddress(userAddress) || "guest";
  const repostsSet = clientReposts.get(account);
  return repostsSet ? Array.from(repostsSet) : [];
}

export function toggleRepost(postId: string, userAddress?: string): boolean {
  const account = normalizeAddress(userAddress) || "guest";
  let repostsSet = clientReposts.get(account);
  if (!repostsSet) {
    repostsSet = new Set<string>();
    clientReposts.set(account, repostsSet);
  }

  const isReposted = repostsSet.has(postId);
  if (isReposted) {
    repostsSet.delete(postId);
  } else {
    repostsSet.add(postId);
  }

  if (typeof window !== "undefined" && userAddress) {
    fetch("/api/social/repost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, userAddress }),
    }).catch((err) => console.warn("Failed to sync repost to server:", err));
  }

  return !isReposted;
}

export async function postTweet(
  authorAddress: string,
  content: string,
  asset?: string,
  stakeMon?: number,
  duelId?: string
): Promise<SocialPost> {
  const norm = normalizeAddress(authorAddress) || authorAddress;
  const isChallenge = Boolean(stakeMon || duelId);

  const localPost: SocialPost = {
    id: `tweet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    authorAddress: norm,
    authorName: `${norm.slice(0, 6)}…${norm.slice(-4)}`,
    authorInitials: norm.slice(2, 4).toUpperCase(),
    kind: isChallenge ? "challenges" : "tweets",
    eyebrow: isChallenge ? `${asset || "BTC"} Duel Challenge` : "Trader Pulse",
    title: content.slice(0, 60),
    description: content,
    content,
    timestamp: Date.now(),
    stakeMon,
    asset,
    duelId,
    reactionsCount: 0,
    likesCount: 0,
    repostsCount: 0,
    repliesCount: 0,
    replies: [],
    isLiveChallenge: isChallenge,
  };

  clientPosts.unshift(localPost);

  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/social/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorAddress: norm,
          content,
          title: content.slice(0, 60),
          description: content,
          asset,
          stakeMon,
          duelId,
          kind: isChallenge ? "challenges" : "tweets",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tweet) {
          return {
            ...localPost,
            id: data.tweet.id,
            timestamp: data.tweet.timestamp,
          };
        }
      }
    } catch (err) {
      console.warn("Failed to persist tweet to server:", err);
    }
  }

  return localPost;
}

export async function postReply(
  postId: string,
  authorAddress: string,
  content: string,
  authorName?: string
): Promise<TweetReply | null> {
  const norm = normalizeAddress(authorAddress) || authorAddress;
  const reply: TweetReply = {
    id: `reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    authorAddress: norm,
    authorName: authorName || `${norm.slice(0, 6)}…${norm.slice(-4)}`,
    authorInitials: norm.slice(2, 4).toUpperCase(),
    content,
    timestamp: Date.now(),
  };

  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/social/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          authorAddress: norm,
          content,
          authorName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) return data.reply;
      }
    } catch (err) {
      console.warn("Failed to persist reply to server:", err);
    }
  }

  return reply;
}

export const publishChallenge = postChallenge;
