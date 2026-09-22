import type {
  ISocialRepository,
  CreatePostDTO,
  CreateReplyDTO,
  EnrichedFeedItem,
} from "../../domain/social/socialRepository.ts";
import {
  getAllChallenges,
  saveChallenge,
  addTweetReply,
  getTweetReplies,
  toggleServerReaction,
  getServerReactions,
  toggleServerRepost,
  getServerReposts,
  toggleServerFollow,
  getServerFollowing,
  saveServerDuelRecord,
  getServerDuelHistory,
  type SocialChallengeRecord,
  type TweetReply,
  type StoredDuelRecord,
  type DuelMode,
} from "./socialStore.ts";
import { normalizeAddress } from "../../domain/social/identity.ts";

/**
 * @deprecated FileSocialRepository is superseded by SupabaseSocialRepository.
 * Canonical cloud persistence is active by default (DATA_BACKEND=supabase).
 * This class is retained strictly for offline development fallback and local fixture testing.
 */
export class FileSocialRepository implements ISocialRepository {
  async getFeed(viewerAddress?: string, tab: "forYou" | "challenges" = "forYou"): Promise<EnrichedFeedItem[]> {
    const normViewer = viewerAddress ? normalizeAddress(viewerAddress) : undefined;
    const rawChallenges = getAllChallenges();

    const filtered = tab === "challenges"
      ? rawChallenges.filter((ch) => ch.kind === "challenges" || ch.isLiveChallenge)
      : rawChallenges;

    return filtered.map((ch) => {
      const { isLiked, count: likesCount } = getServerReactions(ch.id, normViewer);
      const { isReposted, count: repostsCount } = getServerReposts(ch.id, normViewer);
      return {
        ...ch,
        content: ch.content || ch.description,
        reactionsCount: likesCount,
        likesCount,
        isLiked,
        repostsCount,
        isReposted,
        repliesCount: ch.replies ? ch.replies.length : 0,
        replies: ch.replies || [],
      };
    });
  }

  async createPost(dto: CreatePostDTO): Promise<SocialChallengeRecord> {
    return saveChallenge({
      authorAddress: dto.authorAddress,
      title: dto.title,
      description: dto.description,
      content: dto.content,
      kind: dto.kind,
      eyebrow: dto.eyebrow,
      asset: dto.asset,
      stakeMon: dto.stakeMon,
      duelId: dto.duelId,
      isLiveChallenge: dto.isLiveChallenge,
      authorName: dto.authorName,
      authorInitials: dto.authorInitials,
    });
  }

  async addReply(postId: string, dto: CreateReplyDTO): Promise<TweetReply | null> {
    return addTweetReply(postId, {
      authorAddress: dto.authorAddress,
      content: dto.content,
      authorName: dto.authorName,
    });
  }

  async getReplies(postId: string): Promise<TweetReply[]> {
    return getTweetReplies(postId);
  }

  async toggleReaction(postId: string, userAddress: string): Promise<{ isLiked: boolean; count: number }> {
    return toggleServerReaction(postId, userAddress);
  }

  async getReactions(postId: string, userAddress?: string): Promise<{ isLiked: boolean; count: number }> {
    return getServerReactions(postId, userAddress);
  }

  async toggleRepost(postId: string, userAddress: string): Promise<{ isReposted: boolean; count: number }> {
    return toggleServerRepost(postId, userAddress);
  }

  async getReposts(postId: string, userAddress?: string): Promise<{ isReposted: boolean; count: number }> {
    return getServerReposts(postId, userAddress);
  }

  async toggleFollow(viewerAddress: string, targetAddress: string): Promise<boolean> {
    return toggleServerFollow(viewerAddress, targetAddress);
  }

  async getFollowing(viewerAddress: string): Promise<string[]> {
    return getServerFollowing(viewerAddress);
  }

  async saveDuelRecord(record: Omit<StoredDuelRecord, "id" | "timestamp">): Promise<StoredDuelRecord> {
    return saveServerDuelRecord(record);
  }

  async getDuelHistory(playerAddress?: string, mode: DuelMode = "onchain"): Promise<StoredDuelRecord[]> {
    return getServerDuelHistory(playerAddress, mode);
  }
}
