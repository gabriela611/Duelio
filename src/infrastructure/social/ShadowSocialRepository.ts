import type {
  ISocialRepository,
  CreatePostDTO,
  CreateReplyDTO,
  EnrichedFeedItem,
} from "../../domain/social/socialRepository.ts";
import type {
  SocialChallengeRecord,
  TweetReply,
  StoredDuelRecord,
  DuelMode,
} from "./socialStore.ts";

export interface ShadowCompareResult {
  method: string;
  matched: boolean;
  differences?: string[];
  primaryCount?: number;
  shadowCount?: number;
}

export type ShadowTelemetryReporter = (result: ShadowCompareResult) => void;

/**
 * ShadowSocialRepository: Implements the Shadow Read & Dual Write architectural pattern.
 *
 * Primary repository serves the user traffic synchronously.
 * Shadow repository runs asynchronously in parallel to verify parity and surface discrepancies
 * before full backend cutover.
 */
export class ShadowSocialRepository implements ISocialRepository {
  private primary: ISocialRepository;
  private shadow: ISocialRepository;
  private onReport?: ShadowTelemetryReporter;
  private options?: { awaitShadow?: boolean };

  constructor(
    primary: ISocialRepository,
    shadow: ISocialRepository,
    onReport?: ShadowTelemetryReporter,
    options?: { awaitShadow?: boolean }
  ) {
    this.primary = primary;
    this.shadow = shadow;
    this.onReport = onReport;
    this.options = options;
  }

  private report(result: ShadowCompareResult): void {
    if (this.onReport) {
      this.onReport(result);
    } else if (!result.matched) {
      console.warn(`[SHADOW_READ_PARITY_WARNING] ${result.method}:`, result.differences);
    }
  }

  async getFeed(
    viewerAddress?: string,
    tab: "forYou" | "challenges" = "forYou"
  ): Promise<EnrichedFeedItem[]> {
    const primaryResult = await this.primary.getFeed(viewerAddress, tab);

    // Execute shadow read for telemetry/parity
    const shadowPromise = Promise.resolve().then(async () => {
      try {
        const shadowResult = await this.shadow.getFeed(viewerAddress, tab);
        const differences: string[] = [];

        // Compare canonical items that exist in both repositories
        const shadowMap = new Map(shadowResult.map((p) => [p.id, p]));
        for (const pItem of primaryResult) {
          const sItem = shadowMap.get(pItem.id);
          if (!sItem) continue; // Skip test-only posts that were cleaned in shadow

          if (pItem.authorAddress.toLowerCase() !== sItem.authorAddress.toLowerCase()) {
            differences.push(`Post ${pItem.id} authorAddress mismatch`);
          }
          if (pItem.title !== sItem.title) {
            differences.push(`Post ${pItem.id} title mismatch`);
          }
          if (Boolean(pItem.isLiveChallenge) !== Boolean(sItem.isLiveChallenge)) {
            differences.push(`Post ${pItem.id} isLiveChallenge mismatch`);
          }
        }

        this.report({
          method: "getFeed",
          matched: differences.length === 0,
          differences,
          primaryCount: primaryResult.length,
          shadowCount: shadowResult.length,
        });
      } catch (err) {
        this.report({
          method: "getFeed",
          matched: false,
          differences: [`Shadow read failed: ${(err as Error).message}`],
        });
      }
    });

    if (this.options?.awaitShadow) {
      await shadowPromise;
    }

    return primaryResult;
  }

  async createPost(dto: CreatePostDTO): Promise<SocialChallengeRecord> {
    const primaryPost = await this.primary.createPost(dto);

    // Dual-write to shadow repository
    Promise.resolve().then(async () => {
      try {
        await this.shadow.createPost(dto);
      } catch (err) {
        console.warn("[SHADOW_WRITE_ERROR] createPost:", (err as Error).message);
      }
    });

    return primaryPost;
  }

  async addReply(postId: string, dto: CreateReplyDTO): Promise<TweetReply | null> {
    const primaryReply = await this.primary.addReply(postId, dto);

    Promise.resolve().then(async () => {
      try {
        await this.shadow.addReply(postId, dto);
      } catch (err) {
        console.warn("[SHADOW_WRITE_ERROR] addReply:", (err as Error).message);
      }
    });

    return primaryReply;
  }

  async getReplies(postId: string): Promise<TweetReply[]> {
    const primaryReplies = await this.primary.getReplies(postId);

    const shadowPromise = Promise.resolve().then(async () => {
      try {
        const shadowReplies = await this.shadow.getReplies(postId);
        const differences: string[] = [];

        const shadowMap = new Map(shadowReplies.map((r) => [r.id, r]));
        for (const pRep of primaryReplies) {
          const sRep = shadowMap.get(pRep.id);
          if (!sRep) continue;

          if (pRep.authorAddress.toLowerCase() !== sRep.authorAddress.toLowerCase()) {
            differences.push(`Reply ${pRep.id} authorAddress mismatch`);
          }
          if (pRep.content !== sRep.content) {
            differences.push(`Reply ${pRep.id} content mismatch`);
          }
        }

        this.report({
          method: "getReplies",
          matched: differences.length === 0,
          differences,
          primaryCount: primaryReplies.length,
          shadowCount: shadowReplies.length,
        });
      } catch (err) {
        this.report({
          method: "getReplies",
          matched: false,
          differences: [`Shadow getReplies failed: ${(err as Error).message}`],
        });
      }
    });

    if (this.options?.awaitShadow) {
      await shadowPromise;
    }

    return primaryReplies;
  }

  async toggleReaction(
    postId: string,
    userAddress: string
  ): Promise<{ isLiked: boolean; count: number }> {
    const result = await this.primary.toggleReaction(postId, userAddress);

    Promise.resolve().then(async () => {
      try {
        await this.shadow.toggleReaction(postId, userAddress);
      } catch (err) {
        console.warn("[SHADOW_WRITE_ERROR] toggleReaction:", (err as Error).message);
      }
    });

    return result;
  }

  async getReactions(
    postId: string,
    userAddress?: string
  ): Promise<{ isLiked: boolean; count: number }> {
    const result = await this.primary.getReactions(postId, userAddress);

    Promise.resolve().then(async () => {
      try {
        await this.shadow.getReactions(postId, userAddress);
      } catch (err) {
        console.warn("[SHADOW_READ_ERROR] getReactions:", (err as Error).message);
      }
    });

    return result;
  }

  async toggleRepost(
    postId: string,
    userAddress: string
  ): Promise<{ isReposted: boolean; count: number }> {
    const result = await this.primary.toggleRepost(postId, userAddress);

    Promise.resolve().then(async () => {
      try {
        await this.shadow.toggleRepost(postId, userAddress);
      } catch (err) {
        console.warn("[SHADOW_WRITE_ERROR] toggleRepost:", (err as Error).message);
      }
    });

    return result;
  }

  async getReposts(
    postId: string,
    userAddress?: string
  ): Promise<{ isReposted: boolean; count: number }> {
    const result = await this.primary.getReposts(postId, userAddress);

    Promise.resolve().then(async () => {
      try {
        await this.shadow.getReposts(postId, userAddress);
      } catch (err) {
        console.warn("[SHADOW_READ_ERROR] getReposts:", (err as Error).message);
      }
    });

    return result;
  }

  async toggleFollow(viewerAddress: string, targetAddress: string): Promise<boolean> {
    const result = await this.primary.toggleFollow(viewerAddress, targetAddress);

    Promise.resolve().then(async () => {
      try {
        await this.shadow.toggleFollow(viewerAddress, targetAddress);
      } catch (err) {
        console.warn("[SHADOW_WRITE_ERROR] toggleFollow:", (err as Error).message);
      }
    });

    return result;
  }

  async getFollowing(viewerAddress: string): Promise<string[]> {
    const result = await this.primary.getFollowing(viewerAddress);

    Promise.resolve().then(async () => {
      try {
        await this.shadow.getFollowing(viewerAddress);
      } catch (err) {
        console.warn("[SHADOW_READ_ERROR] getFollowing:", (err as Error).message);
      }
    });

    return result;
  }

  async saveDuelRecord(
    record: Omit<StoredDuelRecord, "id" | "timestamp">
  ): Promise<StoredDuelRecord> {
    const result = await this.primary.saveDuelRecord(record);

    Promise.resolve().then(async () => {
      try {
        await this.shadow.saveDuelRecord(record);
      } catch (err) {
        console.warn("[SHADOW_WRITE_ERROR] saveDuelRecord:", (err as Error).message);
      }
    });

    return result;
  }

  async getDuelHistory(
    playerAddress?: string,
    mode: DuelMode = "onchain"
  ): Promise<StoredDuelRecord[]> {
    return this.primary.getDuelHistory(playerAddress, mode);
  }
}
