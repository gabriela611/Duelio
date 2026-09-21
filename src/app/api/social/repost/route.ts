import { NextRequest, NextResponse } from "next/server";
import { getSocialRepository } from "@/infrastructure/social";
import { normalizeAddress } from "@/domain/social/identity";
import { authenticateRequest } from "@/infrastructure/auth/privyServer";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const userAddress = searchParams.get("userAddress") || undefined;

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "postId is required" },
        { status: 400 }
      );
    }

    const repo = getSocialRepository();
    const { isReposted, count } = await repo.getReposts(postId, userAddress ? normalizeAddress(userAddress) : undefined);
    return NextResponse.json({ success: true, isReposted, count });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch repost status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authenticateRequest(request, { required: false });
    const body = await request.json();
    let { postId, userAddress } = body;

    if (session?.walletAddress) {
      if (userAddress && normalizeAddress(userAddress) !== session.walletAddress) {
        return NextResponse.json(
          { success: false, error: "FORBIDDEN: Wallet spoofing detected. Authenticated wallet does not match userAddress" },
          { status: 403 }
        );
      }
      userAddress = session.walletAddress;
    }

    if (!postId || !userAddress) {
      return NextResponse.json(
        { success: false, error: "postId and userAddress are required" },
        { status: 400 }
      );
    }

    const normAddress = normalizeAddress(userAddress);
    if (!normAddress) {
      return NextResponse.json(
        { success: false, error: "Invalid userAddress" },
        { status: 400 }
      );
    }

    const repo = getSocialRepository();
    const result = await repo.toggleRepost(postId, normAddress);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to toggle repost" },
      { status: 500 }
    );
  }
}
