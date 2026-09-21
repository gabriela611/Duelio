import { NextRequest, NextResponse } from "next/server";
import {
  getServerReactions,
  toggleServerReaction,
} from "@/infrastructure/social/socialStore";
import { normalizeAddress } from "@/domain/social/identity";

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

    const { isLiked, count } = getServerReactions(postId, userAddress);
    return NextResponse.json({ success: true, isLiked, count });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch reactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, userAddress } = body;

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

    const result = toggleServerReaction(postId, normAddress);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}
