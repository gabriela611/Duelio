import { normalizeAddress, canFollow } from "../../domain/social/identity.ts";

export interface TweetReply {
  id: string;
  authorAddress: string;
  authorName: string;
  authorInitials: string;
  content: string;
  timestamp: number;
}

export interface SocialChallengeRecord {
  id: string;
  authorAddress: string;
  authorName?: string;
  authorInitials: string;
  kind: "challenges" | "duels" | "tweets";
  eyebrow: string;
  title: string;
  description: string;
  content?: string;
  timestamp: number;
  stakeMon?: number;
  asset?: string;
  duelId?: string;
  isLiveChallenge?: boolean;
  replies?: TweetReply[];
}

// In-memory persistent state across API invocations in server process
const INITIAL_CHALLENGES: SocialChallengeRecord[] = [
  {
    id: "genesis-challenge-1",
    authorAddress: "0x836EF90000000000000000000000000000000001",
    authorName: "Duelist Alpha",
    authorInitials: "DA",
    kind: "challenges",
    eyebrow: "Open 30s Arena Challenge",
    title: "Who can predict BTC in 30s?",
    description: "Looking for a rival in the 30-second arena. 0.1 MON stake ready on Monad Testnet. $BTC to the moon! 🚀",
    content: "Looking for a rival in the 30-second arena. 0.1 MON stake ready on Monad Testnet. $BTC to the moon! 🚀",
    timestamp: Date.now() - 1000 * 60 * 18,
    stakeMon: 0.1,
    asset: "BTC",
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
    description: "Ready for two-wallet on-chain duels with Pyth oracle settlement. $ETH looking bullish this hour.",
    content: "Ready for two-wallet on-chain duels with Pyth oracle settlement. $ETH looking bullish this hour.",
    timestamp: Date.now() - 1000 * 60 * 60,
    stakeMon: 0.25,
    asset: "ETH",
    isLiveChallenge: true,
  },
  {
    id: "genesis-tweet-3",
    authorAddress: "0x836EF90000000000000000000000000000000003",
    authorName: "CryptoWhale",
    authorInitials: "CW",
    kind: "tweets",
    eyebrow: "Market Alpha",
    title: "Monad sub-second finality is a game changer",
    description: "Testing $MON execution speed against Pyth oracle ticks in Duelio. 10,000 TPS makes on-chain PvP trading feel like Web2.",
    content: "Testing $MON execution speed against Pyth oracle ticks in Duelio. 10,000 TPS makes on-chain PvP trading feel like Web2.",
    timestamp: Date.now() - 1000 * 60 * 150,
  },
];

const challenges: SocialChallengeRecord[] = [...INITIAL_CHALLENGES];
const reactions = new Map<string, Set<string>>(); // postId -> Set<userAddress>
const reposts = new Map<string, Set<string>>(); // postId -> Set<userAddress>
const repliesMap = new Map<string, TweetReply[]>(); // postId -> TweetReply[]
const follows = new Map<string, Set<string>>(); // viewerAddress -> Set<targetAddress>

// Seed an initial reply on genesis challenge
repliesMap.set("genesis-challenge-1", [
  {
    id: "reply-genesis-1",
    authorAddress: "0x836EF90000000000000000000000000000000002",
    authorName: "MonadMaster",
    authorInitials: "MM",
    content: "Accepted! Let's see your prediction reflexes on $BTC.",
    timestamp: Date.now() - 1000 * 60 * 10,
  },
]);

export function getAllChallenges(): SocialChallengeRecord[] {
  return challenges.map((ch) => ({
    ...ch,
    replies: repliesMap.get(ch.id) || [],
  })).sort((a, b) => b.timestamp - a.timestamp);
}

export function saveChallenge(challenge: Omit<SocialChallengeRecord, "id" | "timestamp"> & { duelId?: string; content?: string }): SocialChallengeRecord {
  const norm = normalizeAddress(challenge.authorAddress) || challenge.authorAddress;
  const newRecord: SocialChallengeRecord = {
    ...challenge,
    id: `tweet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    authorAddress: norm,
    authorName: challenge.authorName || `${norm.slice(0, 6)}…${norm.slice(-4)}`,
    authorInitials: norm.slice(2, 4).toUpperCase(),
    content: challenge.content || challenge.description,
    timestamp: Date.now(),
    isLiveChallenge: challenge.isLiveChallenge !== undefined ? challenge.isLiveChallenge : Boolean(challenge.stakeMon),
    replies: [],
  };

  challenges.unshift(newRecord);
  return newRecord;
}

export function addTweetReply(
  postId: string,
  reply: { authorAddress: string; content: string; authorName?: string }
): TweetReply | null {
  const norm = normalizeAddress(reply.authorAddress) || reply.authorAddress;
  const newReply: TweetReply = {
    id: `reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    authorAddress: norm,
    authorName: reply.authorName || `${norm.slice(0, 6)}…${norm.slice(-4)}`,
    authorInitials: norm.slice(2, 4).toUpperCase(),
    content: reply.content.slice(0, 280),
    timestamp: Date.now(),
  };

  const existing = repliesMap.get(postId) ? [...repliesMap.get(postId)!] : [];
  existing.push(newReply);
  repliesMap.set(postId, existing);
  return newReply;
}

export function getTweetReplies(postId: string): TweetReply[] {
  return repliesMap.get(postId) ? [...repliesMap.get(postId)!] : [];
}

export function toggleServerReaction(postId: string, userAddress?: string): { isLiked: boolean; count: number } {
  const account = normalizeAddress(userAddress);
  if (!account) {
    const postLikes = reactions.get(postId);
    return { isLiked: false, count: postLikes ? postLikes.size : 0 };
  }

  let postLikes = reactions.get(postId);
  if (!postLikes) {
    postLikes = new Set<string>();
    reactions.set(postId, postLikes);
  }

  const isLiked = postLikes.has(account);
  if (isLiked) {
    postLikes.delete(account);
  } else {
    postLikes.add(account);
  }

  return { isLiked: !isLiked, count: postLikes.size };
}

export function getServerReactions(postId: string, userAddress?: string): { isLiked: boolean; count: number } {
  const postLikes = reactions.get(postId);
  const count = postLikes ? postLikes.size : 0;
  const account = normalizeAddress(userAddress);
  const isLiked = account && postLikes ? postLikes.has(account) : false;
  return { isLiked: Boolean(isLiked), count };
}

export function toggleServerRepost(postId: string, userAddress?: string): { isReposted: boolean; count: number } {
  const account = normalizeAddress(userAddress);
  if (!account) {
    const postReposts = reposts.get(postId);
    return { isReposted: false, count: postReposts ? postReposts.size : 0 };
  }

  let postReposts = reposts.get(postId);
  if (!postReposts) {
    postReposts = new Set<string>();
    reposts.set(postId, postReposts);
  }

  const isReposted = postReposts.has(account);
  if (isReposted) {
    postReposts.delete(account);
  } else {
    postReposts.add(account);
  }

  return { isReposted: !isReposted, count: postReposts.size };
}

export function getServerReposts(postId: string, userAddress?: string): { isReposted: boolean; count: number } {
  const postReposts = reposts.get(postId);
  const count = postReposts ? postReposts.size : 0;
  const account = normalizeAddress(userAddress);
  const isReposted = account && postReposts ? postReposts.has(account) : false;
  return { isReposted: Boolean(isReposted), count };
}

export function toggleServerFollow(viewerAddress?: string, targetAddress?: string): boolean {
  if (!canFollow(viewerAddress, targetAddress)) return false;

  const viewer = normalizeAddress(viewerAddress)!;
  const target = normalizeAddress(targetAddress)!;

  let viewerFollows = follows.get(viewer);
  if (!viewerFollows) {
    viewerFollows = new Set<string>();
    follows.set(viewer, viewerFollows);
  }

  const isFollowing = viewerFollows.has(target);
  if (isFollowing) {
    viewerFollows.delete(target);
  } else {
    viewerFollows.add(target);
  }

  return !isFollowing;
}

export function getServerFollowing(viewerAddress?: string): string[] {
  const viewer = normalizeAddress(viewerAddress);
  if (!viewer) return [];
  const viewerFollows = follows.get(viewer);
  return viewerFollows ? Array.from(viewerFollows) : [];
}
