import { normalizeAddress, canFollow } from "../../domain/social/identity.ts";

export interface SocialChallengeRecord {
  id: string;
  authorAddress: string;
  authorName?: string;
  authorInitials: string;
  kind: "challenges" | "duels";
  eyebrow: string;
  title: string;
  description: string;
  timestamp: number;
  stakeMon: number;
  asset: string;
  duelId?: string;
  isLiveChallenge?: boolean;
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
    description: "Looking for a rival in the 30-second arena. 0.1 MON stake ready on Monad Testnet.",
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
    description: "Ready for two-wallet on-chain duels with Pyth oracle settlement. Challenge open.",
    timestamp: Date.now() - 1000 * 60 * 60,
    stakeMon: 0.25,
    asset: "ETH",
    isLiveChallenge: true,
  },
];

const challenges: SocialChallengeRecord[] = [...INITIAL_CHALLENGES];
const reactions = new Map<string, Set<string>>(); // postId -> Set<userAddress>
const follows = new Map<string, Set<string>>(); // viewerAddress -> Set<targetAddress>

export function getAllChallenges(): SocialChallengeRecord[] {
  return [...challenges].sort((a, b) => b.timestamp - a.timestamp);
}

export function saveChallenge(challenge: Omit<SocialChallengeRecord, "id" | "timestamp"> & { duelId?: string }): SocialChallengeRecord {
  const norm = normalizeAddress(challenge.authorAddress) || challenge.authorAddress;
  const newRecord: SocialChallengeRecord = {
    ...challenge,
    id: `challenge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    authorAddress: norm,
    authorName: challenge.authorName || `${norm.slice(0, 6)}…${norm.slice(-4)}`,
    authorInitials: norm.slice(2, 4).toUpperCase(),
    timestamp: Date.now(),
    isLiveChallenge: true,
  };

  challenges.unshift(newRecord);
  return newRecord;
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
