import { NextRequest, NextResponse } from "next/server";
import {
  getAllChallenges,
  saveChallenge,
  getServerReactions,
} from "@/infrastructure/social/socialStore";
import { normalizeAddress } from "@/domain/social/identity";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerAddress = searchParams.get("viewerAddress") || undefined;

    const rawChallenges = getAllChallenges();
    const feed = rawChallenges.map((ch) => {
      const { isLiked, count } = getServerReactions(ch.id, viewerAddress);
      return {
        ...ch,
        reactionsCount: count,
        isLiked,
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
    const { authorAddress, title, description, asset, stakeMon, duelId } = body;

    if (!authorAddress || !title || !description) {
      return NextResponse.json(
        { success: false, error: "authorAddress, title, and description are required" },
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

    const record = saveChallenge({
      authorAddress: normalized,
      title: String(title).slice(0, 140),
      description: String(description).slice(0, 280),
      eyebrow: `${asset || "BTC"} Duel Challenge`,
      kind: "challenges",
      asset: asset || "BTC",
      stakeMon: Number(stakeMon) || 0.1,
      authorInitials: normalized.slice(2, 4).toUpperCase(),
      duelId: duelId ? String(duelId) : undefined,
    });

    return NextResponse.json({ success: true, challenge: record });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create challenge" },
      { status: 500 }
    );
  }
}
