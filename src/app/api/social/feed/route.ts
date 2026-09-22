import { NextRequest, NextResponse } from "next/server";
import { getSocialRepository } from "@/infrastructure/social";
import { normalizeAddress } from "@/domain/social/identity";
import { authenticateRequest } from "@/infrastructure/auth/privyServer";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerAddress = searchParams.get("viewerAddress");
    const tab = (searchParams.get("tab") as any) || "forYou";

    const repo = getSocialRepository();
    const feed = await repo.getFeed(viewerAddress || undefined, tab);

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
    const session = await authenticateRequest(request, { required: false });
    const body = await request.json();
    let { authorAddress, content, title, description, asset, stakeMon, duelId, kind } = body;

    if (session?.walletAddress) {
      if (authorAddress && normalizeAddress(authorAddress) !== session.walletAddress) {
        return NextResponse.json(
          { success: false, error: "FORBIDDEN: Wallet spoofing detected. Authenticated wallet does not match authorAddress" },
          { status: 403 }
        );
      }
      authorAddress = session.walletAddress;
    }

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
    const repo = getSocialRepository();
    const record = await repo.createPost({
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
