import type {
  SocialChallengeRecord,
  TweetReply,
  StoredDuelRecord,
  DuelMode,
} from "../../infrastructure/social/socialStore.ts";

export interface CreatePostDTO {
  authorAddress: string;
  userId?: string;
  title: string;
  description: string;
  content?: string;
  kind?: "challenges" | "duels" | "tweets";
  eyebrow?: string;
  asset?: string;
  stakeMon?: number;
  duelId?: string;
  isLiveChallenge?: boolean;
  authorName?: string;
  authorInitials?: string;
}

export interface CreateReplyDTO {
  authorAddress: string;
  userId?: string;
  content: string;
  authorName?: string;
}

export interface EnrichedFeedItem extends SocialChallengeRecord {
  reactionsCount: number;
  likesCount: number;
  isLiked: boolean;
  repostsCount: number;
  isReposted: boolean;
  repliesCount: number;
  replies: TweetReply[];
}

export interface ISocialRepository {
  /** Retrieve feed with enriched interaction states for viewer */
  getFeed(viewerAddress?: string, tab?: "forYou" | "challenges"): Promise<EnrichedFeedItem[]>;

  /** Create a new challenge or tweet */
  createPost(dto: CreatePostDTO): Promise<SocialChallengeRecord>;

  /** Add a reply to a post */
  addReply(postId: string, dto: CreateReplyDTO): Promise<TweetReply | null>;

  /** Fetch replies for a post */
  getReplies(postId: string): Promise<TweetReply[]>;

  /** Toggle like reaction for a user */
  toggleReaction(postId: string, userAddress: string): Promise<{ isLiked: boolean; count: number }>;

  /** Get reaction status for a post */
  getReactions(postId: string, userAddress?: string): Promise<{ isLiked: boolean; count: number }>;

  /** Toggle repost for a user */
  toggleRepost(postId: string, userAddress: string): Promise<{ isReposted: boolean; count: number }>;

  /** Get repost status for a post */
  getReposts(postId: string, userAddress?: string): Promise<{ isReposted: boolean; count: number }>;

  /** Toggle follow relationship between viewer and target */
  toggleFollow(viewerAddress: string, targetAddress: string): Promise<boolean>;

  /** Retrieve following list for an account */
  getFollowing(viewerAddress: string): Promise<string[]>;

  /** Persist duel match record (practice or onchain mirror) */
  saveDuelRecord(record: Omit<StoredDuelRecord, "id" | "timestamp">): Promise<StoredDuelRecord>;

  /** Retrieve duel history */
  getDuelHistory(playerAddress?: string, mode?: DuelMode): Promise<StoredDuelRecord[]>;
}
