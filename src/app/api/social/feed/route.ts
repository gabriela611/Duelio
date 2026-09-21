import { NextRequest, NextResponse } from "next/server";
import {
  getAllChallenges,
  saveChallenge,
  getServerReactions,
  getServerReposts,
} from "@/infrastructure/social/socialStore";
import { normalizeAddress } from "@/domain/social/identity";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerAddress = searchParams.get("viewerAddress") || undefined;

    const rawChallenges = getAllChallenges();
    const feed = rawChallenges.map((ch) => {
      const { isLiked, count: likesCount } = getServerReactions(ch.id, viewerAddress);
      const { isReposted, count: repostsCount } = getServerReposts(ch.id, viewerAddress);
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

    return NextResponse.json({ success: true, feed });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch social feed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { authorAddress, content, title, description, asset, stakeMon, duelId, kind } = body;

    const postContent = content || description || title;
    if (!authorAddress || !postContent) {
      return NextResponse.json(
        { success: false, error: "authorAddress and content are required" },
        { status: 400 }
      );
    }

    const normalized = normalizeAddress(authorAddress);
    if (!normalized) {
      return NextResponse.json(
        { success: false, error: "Invalid authorAddress" },
        { status: 400 }
      );
    }

    const isChallenge = Boolean(stakeMon || duelId || kind === "challenges");
    const record = saveChallenge({
      authorAddress: normalized,
      title: title ? String(title).slice(0, 140) : String(postContent).slice(0, 70),
      description: String(postContent).slice(0, 280),
      content: String(postContent).slice(0, 280),
      eyebrow: isChallenge ? `${asset || "BTC"} Arena Challenge` : "Trader Pulse",
      kind: isChallenge ? "challenges" : (kind || "tweets"),
      asset: isChallenge ? (asset || "BTC") : undefined,
      stakeMon: isChallenge ? (Number(stakeMon) || 0.1) : undefined,
      authorInitials: normalized.slice(2, 4).toUpperCase(),
      duelId: duelId ? String(duelId) : undefined,
      isLiveChallenge: isChallenge,
    });

    return NextResponse.json({ success: true, tweet: record, challenge: record });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create tweet" },
      { status: 500 }
    );
  }
}
