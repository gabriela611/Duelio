import fs from "fs";
import path from "path";
import { isAddress } from "viem";
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

export type DuelMode = "practice" | "onchain";

export interface StoredDuelRecord {
  id: string;
  timestamp: number;
  playerAddress: string;
  asset: string;
  strikePrice: number;
  settledPrice: number;
  direction: "HIGHER" | "LOWER";
  outcome: "WIN" | "LOSS" | "DRAW";
  stake: number;
  payout: number;
  eloDelta: number;
  mode: DuelMode;
  onChainDuelId?: string;
}

// Clean community seeds with zero fabricated financial gains
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
    timestamp: 1774180000000,
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
    timestamp: 1774176400000,
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
    timestamp: 1774170000000,
  },
];

const INITIAL_REPLIES: Record<string, TweetReply[]> = {
  "genesis-challenge-1": [
    {
      id: "reply-genesis-1",
      authorAddress: "0x836EF90000000000000000000000000000000002",
      authorName: "MonadMaster",
      authorInitials: "MM",
      content: "Accepted! Let's see your prediction reflexes on $BTC.",
      timestamp: 1774180400000,
    },
  ],
};

interface SerializedStoreData {
  challenges: SocialChallengeRecord[];
  reactions: Record<string, string[]>;
  reposts: Record<string, string[]>;
  replies: Record<string, TweetReply[]>;
  follows: Record<string, string[]>;
  duels: StoredDuelRecord[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "social_store.json");

let challenges: SocialChallengeRecord[] = [];
let reactions = new Map<string, Set<string>>(); // postId -> Set<userAddress>
let reposts = new Map<string, Set<string>>(); // postId -> Set<userAddress>
let repliesMap = new Map<string, TweetReply[]>(); // postId -> TweetReply[]
let follows = new Map<string, Set<string>>(); // viewerAddress -> Set<targetAddress>
let duelRecords: StoredDuelRecord[] = [];
let isInitialized = false;

function loadFromDisk(): boolean {
  try {
    if (!fs.existsSync(STORE_FILE)) return false;
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    if (!raw.trim()) return false;
    const parsed: SerializedStoreData = JSON.parse(raw);

    challenges = Array.isArray(parsed.challenges) ? parsed.challenges : [];
    reactions.clear();
    if (parsed.reactions) {
      for (const [k, v] of Object.entries(parsed.reactions)) {
        reactions.set(k, new Set(v));
      }
    }
    reposts.clear();
    if (parsed.reposts) {
      for (const [k, v] of Object.entries(parsed.reposts)) {
        reposts.set(k, new Set(v));
      }
    }
    repliesMap.clear();
    if (parsed.replies) {
      for (const [k, v] of Object.entries(parsed.replies)) {
        repliesMap.set(k, v);
      }
    }
    follows.clear();
    if (parsed.follows) {
      for (const [k, v] of Object.entries(parsed.follows)) {
        follows.set(k, new Set(v));
      }
    }
    duelRecords = Array.isArray(parsed.duels) ? parsed.duels : [];
    return true;
  } catch (err) {
    console.warn("Failed to load social store from disk, initializing defaults:", err);
    return false;
  }
}

function persistToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const data: SerializedStoreData = {
      challenges,
      reactions: Object.fromEntries(
        Array.from(reactions.entries()).map(([k, set]) => [k, Array.from(set)])
      ),
      reposts: Object.fromEntries(
        Array.from(reposts.entries()).map(([k, set]) => [k, Array.from(set)])
      ),
      replies: Object.fromEntries(repliesMap.entries()),
      follows: Object.fromEntries(
        Array.from(follows.entries()).map(([k, set]) => [k, Array.from(set)])
      ),
      duels: duelRecords,
    };

    const dir = path.dirname(STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tmpFile = `${STORE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmpFile, STORE_FILE);
  } catch (err) {
    console.warn("Failed to persist social store to disk:", err);
  }
}

function ensureStoreInitialized(): void {
  if (isInitialized) return;
  const loaded = loadFromDisk();
  if (!loaded) {
    challenges = [...INITIAL_CHALLENGES];
    for (const [postId, reps] of Object.entries(INITIAL_REPLIES)) {
      repliesMap.set(postId, [...reps]);
    }
    persistToDisk();
  }
  isInitialized = true;
}

export function resetStoreForTesting(): void {
  challenges = [...INITIAL_CHALLENGES];
  reactions.clear();
  reposts.clear();
  repliesMap.clear();
  follows.clear();
  duelRecords = [];
  for (const [postId, reps] of Object.entries(INITIAL_REPLIES)) {
    repliesMap.set(postId, [...reps]);
  }
  isInitialized = true;
  persistToDisk();
}

export function getAllChallenges(): SocialChallengeRecord[] {
  ensureStoreInitialized();
  return challenges
    .map((ch) => ({
      ...ch,
      replies: repliesMap.get(ch.id) ? [...repliesMap.get(ch.id)!] : [],
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function saveChallenge(challenge: {
  authorAddress: string;
  authorName?: string;
  authorInitials?: string;
  title: string;
  description: string;
  kind?: "challenges" | "duels" | "tweets";
  eyebrow?: string;
  content?: string;
  stakeMon?: number;
  asset?: string;
  duelId?: string;
  isLiveChallenge?: boolean;
}): SocialChallengeRecord {
  ensureStoreInitialized();

  const norm = normalizeAddress(challenge.authorAddress);
  if (!norm) {
    throw new Error(`INVALID_AUTHOR_ADDRESS: '${challenge.authorAddress}' is not a valid EVM address`);
  }

  const kind = challenge.kind || (challenge.stakeMon ? "challenges" : "tweets");
  const eyebrow = challenge.eyebrow || (challenge.stakeMon ? `${challenge.asset || "MON"} Arena Duel` : "Community Tweet");

  // Validate on-chain duel link format if provided
  if (challenge.duelId !== undefined && challenge.duelId !== "") {
    const duelIdStr = String(challenge.duelId);
    if (!/^\d+$/.test(duelIdStr)) {
      throw new Error(`INVALID_DUEL_ID: '${challenge.duelId}' must be a numeric on-chain ID`);
    }
  }

  const newRecord: SocialChallengeRecord = {
    id: `tweet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    authorAddress: norm,
    authorName: `${norm.slice(0, 6)}…${norm.slice(-4)}`,
    authorInitials: norm.slice(2, 4).toUpperCase(),
    kind,
    eyebrow,
    title: challenge.title.trim().slice(0, 140),
    description: challenge.description.trim().slice(0, 280),
    content: (challenge.content || challenge.description).trim().slice(0, 280),
    timestamp: Date.now(),
    stakeMon: challenge.stakeMon,
    asset: challenge.asset,
    duelId: challenge.duelId,
    isLiveChallenge: challenge.isLiveChallenge !== undefined ? challenge.isLiveChallenge : Boolean(challenge.stakeMon),
    replies: [],
  };

  challenges.unshift(newRecord);
  persistToDisk();
  return { ...newRecord };
}

export function addTweetReply(
  postId: string,
  reply: { authorAddress: string; content: string; authorName?: string }
): TweetReply | null {
  ensureStoreInitialized();

  const norm = normalizeAddress(reply.authorAddress);
  if (!norm) {
    throw new Error(`INVALID_REPLY_AUTHOR: '${reply.authorAddress}' is not a valid EVM address`);
  }
  const newReply: TweetReply = {
    id: `reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    authorAddress: norm,
    authorName: reply.authorName || `${norm.slice(0, 6)}…${norm.slice(-4)}`,
    authorInitials: norm.slice(2, 4).toUpperCase(),
    content: reply.content.trim().slice(0, 280),
    timestamp: Date.now(),
  };

  const existing = repliesMap.get(postId) ? [...repliesMap.get(postId)!] : [];
  existing.push(newReply);
  repliesMap.set(postId, existing);
  persistToDisk();

  return { ...newReply };
}

export function getTweetReplies(postId: string): TweetReply[] {
  ensureStoreInitialized();
  return repliesMap.get(postId) ? [...repliesMap.get(postId)!] : [];
}

export function toggleServerReaction(postId: string, userAddress?: string): { isLiked: boolean; count: number } {
  ensureStoreInitialized();

  const account = normalizeAddress(userAddress);
  if (!account || !isAddress(account)) {
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

  persistToDisk();
  return { isLiked: !isLiked, count: postLikes.size };
}

export function getServerReactions(postId: string, userAddress?: string): { isLiked: boolean; count: number } {
  ensureStoreInitialized();
  const postLikes = reactions.get(postId);
  const count = postLikes ? postLikes.size : 0;
  const account = normalizeAddress(userAddress);
  const isLiked = account && postLikes ? postLikes.has(account) : false;
  return { isLiked: Boolean(isLiked), count };
}

export function toggleServerRepost(postId: string, userAddress?: string): { isReposted: boolean; count: number } {
  ensureStoreInitialized();

  const account = normalizeAddress(userAddress);
  if (!account || !isAddress(account)) {
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

  persistToDisk();
  return { isReposted: !isReposted, count: postReposts.size };
}

export function getServerReposts(postId: string, userAddress?: string): { isReposted: boolean; count: number } {
  ensureStoreInitialized();
  const postReposts = reposts.get(postId);
  const count = postReposts ? postReposts.size : 0;
  const account = normalizeAddress(userAddress);
  const isReposted = account && postReposts ? postReposts.has(account) : false;
  return { isReposted: Boolean(isReposted), count };
}

export function toggleServerFollow(viewerAddress?: string, targetAddress?: string): boolean {
  ensureStoreInitialized();

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

  persistToDisk();
  return !isFollowing;
}

export function getServerFollowing(viewerAddress?: string): string[] {
  ensureStoreInitialized();
  const viewer = normalizeAddress(viewerAddress);
  if (!viewer) return [];
  const viewerFollows = follows.get(viewer);
  return viewerFollows ? Array.from(viewerFollows) : [];
}

// -------------------------------------------------------------
// Durable Server-Side On-Chain & Practice Duel History
// -------------------------------------------------------------

export function saveServerDuelRecord(record: Omit<StoredDuelRecord, "id" | "timestamp">): StoredDuelRecord {
  ensureStoreInitialized();

  const norm = normalizeAddress(record.playerAddress);
  if (!norm) {
    throw new Error(`INVALID_PLAYER_ADDRESS: '${record.playerAddress}' is not a valid EVM address`);
  }

  const newDuel: StoredDuelRecord = {
    ...record,
    id: `duel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    playerAddress: norm,
    timestamp: Date.now(),
  };

  duelRecords.unshift(newDuel);
  persistToDisk();
  return { ...newDuel };
}

export function getServerDuelHistory(playerAddress?: string, mode: DuelMode = "onchain"): StoredDuelRecord[] {
  ensureStoreInitialized();
  const target = normalizeAddress(playerAddress);
  return duelRecords
    .filter((d) => d.mode === mode)
    .filter((d) => !target || d.playerAddress === target)
    .map((d) => ({ ...d }));
}
