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
import { getSupabaseServerClient } from "../supabase/client.ts";
import { normalizeAddress } from "../../domain/social/identity.ts";

export class SupabaseSocialRepository implements ISocialRepository {
  private client = getSupabaseServerClient();

  async getFeed(
    viewerAddress?: string,
    tab: "forYou" | "challenges" = "forYou"
  ): Promise<EnrichedFeedItem[]> {
    const normViewer = viewerAddress ? normalizeAddress(viewerAddress) : undefined;

    let query = this.client
      .from("posts")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (tab === "challenges") {
      query = query.or("kind.eq.challenges,is_live_challenge.eq.true");
    }

    const { data: posts, error: postErr } = await query;
    if (postErr) {
      throw new Error(`SUPABASE_FEED_ERROR: ${postErr.message}`);
    }
    if (!posts || posts.length === 0) return [];

    const postIds = posts.map((p) => p.id);

    // Fetch replies for these posts
    const { data: allReplies } = await this.client
      .from("replies")
      .select("*")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });

    // Fetch likes and reposts
    const { data: allLikes } = await this.client
      .from("post_likes")
      .select("post_id, user_address")
      .in("post_id", postIds);

    const { data: allReposts } = await this.client
      .from("post_reposts")
      .select("post_id, user_address")
      .in("post_id", postIds);

    // Grouping
    const repliesByPost = new Map<string, TweetReply[]>();
    for (const r of allReplies || []) {
      const list = repliesByPost.get(r.post_id) || [];
      list.push({
        id: r.id,
        authorAddress: r.author_address,
        authorName: r.author_name || `${r.author_address.slice(0, 6)}…${r.author_address.slice(-4)}`,
        authorInitials: r.author_initials || r.author_address.slice(2, 4).toUpperCase(),
        content: r.content,
        timestamp: new Date(r.created_at).getTime(),
      });
      repliesByPost.set(r.post_id, list);
    }

    const likesCountByPost = new Map<string, number>();
    const userLikesSet = new Set<string>();
    for (const l of allLikes || []) {
      likesCountByPost.set(l.post_id, (likesCountByPost.get(l.post_id) || 0) + 1);
      if (normViewer && l.user_address === normViewer) {
        userLikesSet.add(l.post_id);
      }
    }

    const repostsCountByPost = new Map<string, number>();
    const userRepostsSet = new Set<string>();
    for (const rep of allReposts || []) {
      repostsCountByPost.set(rep.post_id, (repostsCountByPost.get(rep.post_id) || 0) + 1);
      if (normViewer && rep.user_address === normViewer) {
        userRepostsSet.add(rep.post_id);
      }
    }

    return posts.map((p) => {
      const postReplies = repliesByPost.get(p.id) || [];
      const likesCount = likesCountByPost.get(p.id) || 0;
      const repostsCount = repostsCountByPost.get(p.id) || 0;

      return {
        id: p.id,
        authorAddress: p.author_address,
        authorName: p.author_name || `${p.author_address.slice(0, 6)}…${p.author_address.slice(-4)}`,
        authorInitials: p.author_initials || p.author_address.slice(2, 4).toUpperCase(),
        kind: p.kind as any,
        eyebrow: p.eyebrow || "",
        title: p.title,
        description: p.description,
        content: p.content || p.description,
        timestamp: new Date(p.created_at).getTime(),
        stakeMon: p.stake_mon ? Number(p.stake_mon) : undefined,
        asset: p.asset || undefined,
        duelId: p.onchain_duel_id || undefined,
        isLiveChallenge: p.is_live_challenge,
        reactionsCount: likesCount,
        likesCount,
        isLiked: userLikesSet.has(p.id),
        repostsCount,
        isReposted: userRepostsSet.has(p.id),
        repliesCount: postReplies.length,
        replies: postReplies,
      };
    });
  }

  async createPost(dto: CreatePostDTO): Promise<SocialChallengeRecord> {
    const id = `tweet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const norm = normalizeAddress(dto.authorAddress) || dto.authorAddress;
    const authorInitials = dto.authorInitials || norm.slice(2, 4).toUpperCase();
    const authorName = dto.authorName || `${norm.slice(0, 6)}…${norm.slice(-4)}`;

    const { data, error } = await this.client
      .from("posts")
      .insert({
        id,
        author_address: norm,
        author_name: authorName,
        author_initials: authorInitials,
        title: dto.title,
        description: dto.description,
        content: dto.content || dto.description,
        kind: dto.kind || "tweets",
        eyebrow: dto.eyebrow,
        asset: dto.asset,
        stake_mon: dto.stakeMon,
        onchain_duel_id: dto.duelId,
        is_live_challenge: Boolean(dto.isLiveChallenge),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`SUPABASE_CREATE_POST_ERROR: ${error.message}`);
    }

    return {
      id: data.id,
      authorAddress: data.author_address,
      authorName: data.author_name || undefined,
      authorInitials: data.author_initials || authorInitials,
      kind: data.kind as any,
      eyebrow: data.eyebrow || "",
      title: data.title,
      description: data.description,
      content: data.content || data.description,
      timestamp: new Date(data.created_at).getTime(),
      stakeMon: data.stake_mon ? Number(data.stake_mon) : undefined,
      asset: data.asset || undefined,
      duelId: data.onchain_duel_id || undefined,
      isLiveChallenge: data.is_live_challenge,
    };
  }

  async addReply(postId: string, dto: CreateReplyDTO): Promise<TweetReply | null> {
    const id = `reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const norm = normalizeAddress(dto.authorAddress) || dto.authorAddress;
    const authorInitials = norm.slice(2, 4).toUpperCase();
    const authorName = dto.authorName || `${norm.slice(0, 6)}…${norm.slice(-4)}`;

    const { data, error } = await this.client
      .from("replies")
      .insert({
        id,
        post_id: postId,
        author_address: norm,
        author_name: authorName,
        author_initials: authorInitials,
        content: dto.content,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`SUPABASE_ADD_REPLY_ERROR: ${error.message}`);
    }

    return {
      id: data.id,
      authorAddress: data.author_address,
      authorName: data.author_name || authorName,
      authorInitials: data.author_initials || authorInitials,
      content: data.content,
      timestamp: new Date(data.created_at).getTime(),
    };
  }

  async getReplies(postId: string): Promise<TweetReply[]> {
    const { data, error } = await this.client
      .from("replies")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`SUPABASE_GET_REPLIES_ERROR: ${error.message}`);
    }

    return (data || []).map((r) => ({
      id: r.id,
      authorAddress: r.author_address,
      authorName: r.author_name || `${r.author_address.slice(0, 6)}…${r.author_address.slice(-4)}`,
      authorInitials: r.author_initials || r.author_address.slice(2, 4).toUpperCase(),
      content: r.content,
      timestamp: new Date(r.created_at).getTime(),
    }));
  }

  async toggleReaction(postId: string, userAddress: string): Promise<{ isLiked: boolean; count: number }> {
    const norm = normalizeAddress(userAddress) || userAddress;

    const { data: existing } = await this.client
      .from("post_likes")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_address", norm)
      .maybeSingle();

    if (existing) {
      await this.client
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_address", norm);
    } else {
      await this.client
        .from("post_likes")
        .insert({ post_id: postId, user_address: norm });
    }

    return this.getReactions(postId, norm);
  }

  async getReactions(postId: string, userAddress?: string): Promise<{ isLiked: boolean; count: number }> {
    const norm = userAddress ? normalizeAddress(userAddress) : undefined;

    const { data: likes, error } = await this.client
      .from("post_likes")
      .select("user_address")
      .eq("post_id", postId);

    if (error) {
      throw new Error(`SUPABASE_GET_REACTIONS_ERROR: ${error.message}`);
    }

    const count = likes?.length || 0;
    const isLiked = Boolean(norm && likes?.some((l) => l.user_address === norm));

    return { isLiked, count };
  }

  async toggleRepost(postId: string, userAddress: string): Promise<{ isReposted: boolean; count: number }> {
    const norm = normalizeAddress(userAddress) || userAddress;

    const { data: existing } = await this.client
      .from("post_reposts")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_address", norm)
      .maybeSingle();

    if (existing) {
      await this.client
        .from("post_reposts")
        .delete()
        .eq("post_id", postId)
        .eq("user_address", norm);
    } else {
      await this.client
        .from("post_reposts")
        .insert({ post_id: postId, user_address: norm });
    }

    return this.getReposts(postId, norm);
  }

  async getReposts(postId: string, userAddress?: string): Promise<{ isReposted: boolean; count: number }> {
    const norm = userAddress ? normalizeAddress(userAddress) : undefined;

    const { data: reposts, error } = await this.client
      .from("post_reposts")
      .select("user_address")
      .eq("post_id", postId);

    if (error) {
      throw new Error(`SUPABASE_GET_REPOSTS_ERROR: ${error.message}`);
    }

    const count = reposts?.length || 0;
    const isReposted = Boolean(norm && reposts?.some((r) => r.user_address === norm));

    return { isReposted, count };
  }

  async toggleFollow(viewerAddress: string, targetAddress: string): Promise<boolean> {
    const normViewer = normalizeAddress(viewerAddress) || viewerAddress;
    const normTarget = normalizeAddress(targetAddress) || targetAddress;

    if (normViewer === normTarget) return false;

    const { data: existing } = await this.client
      .from("follows")
      .select("follower_address")
      .eq("follower_address", normViewer)
      .eq("target_address", normTarget)
      .maybeSingle();

    if (existing) {
      await this.client
        .from("follows")
        .delete()
        .eq("follower_address", normViewer)
        .eq("target_address", normTarget);
      return false;
    } else {
      await this.client
        .from("follows")
        .insert({ follower_address: normViewer, target_address: normTarget });
      return true;
    }
  }

  async getFollowing(viewerAddress: string): Promise<string[]> {
    const normViewer = normalizeAddress(viewerAddress) || viewerAddress;

    const { data, error } = await this.client
      .from("follows")
      .select("target_address")
      .eq("follower_address", normViewer);

    if (error) {
      throw new Error(`SUPABASE_GET_FOLLOWING_ERROR: ${error.message}`);
    }

    return (data || []).map((f) => f.target_address);
  }

  async saveDuelRecord(record: Omit<StoredDuelRecord, "id" | "timestamp">): Promise<StoredDuelRecord> {
    const id = `duel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const norm = normalizeAddress(record.playerAddress) || record.playerAddress;

    const { data, error } = await this.client
      .from("practice_matches")
      .insert({
        id,
        player_address: norm,
        asset: record.asset,
        strike_price: record.strikePrice,
        settled_price: record.settledPrice,
        direction: record.direction,
        outcome: record.outcome,
        stake: record.stake,
        payout: record.payout,
        elo_delta: record.eloDelta,
        mode: "practice",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`SUPABASE_SAVE_DUEL_ERROR: ${error.message}`);
    }

    return {
      id: data.id,
      timestamp: new Date(data.created_at).getTime(),
      playerAddress: data.player_address,
      asset: data.asset,
      strikePrice: Number(data.strike_price),
      settledPrice: Number(data.settled_price),
      direction: data.direction as any,
      outcome: data.outcome as any,
      stake: Number(data.stake),
      payout: Number(data.payout),
      eloDelta: Number(data.elo_delta),
      mode: "practice",
    };
  }

  async getDuelHistory(playerAddress?: string, mode: DuelMode = "onchain"): Promise<StoredDuelRecord[]> {
    if (mode === "onchain") {
      // Onchain duels belong exclusively to the contracts / Envio indexer read model
      return [];
    }

    const norm = playerAddress ? normalizeAddress(playerAddress) : undefined;
    let query = this.client
      .from("practice_matches")
      .select("*")
      .order("created_at", { ascending: false });

    if (norm) {
      query = query.eq("player_address", norm);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`SUPABASE_DUEL_HISTORY_ERROR: ${error.message}`);
    }

    return (data || []).map((d) => ({
      id: d.id,
      timestamp: new Date(d.created_at).getTime(),
      playerAddress: d.player_address,
      asset: d.asset,
      strikePrice: Number(d.strike_price),
      settledPrice: Number(d.settled_price),
      direction: d.direction as any,
      outcome: d.outcome as any,
      stake: Number(d.stake),
      payout: Number(d.payout),
      eloDelta: Number(d.elo_delta),
      mode: "practice",
    }));
  }
}
