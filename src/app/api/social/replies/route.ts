import { NextRequest, NextResponse } from "next/server";
import { getSocialRepository } from "@/infrastructure/social";
import { normalizeAddress } from "@/domain/social/identity";
import { authenticateRequest } from "@/infrastructure/auth/privyServer";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "postId is required" },
        { status: 400 }
      );
    }

    const repo = getSocialRepository();
    const replies = await repo.getReplies(postId);
    return NextResponse.json({ success: true, replies });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch replies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authenticateRequest(request, { required: false });
    const body = await request.json();
    let { postId, authorAddress, content, authorName } = body;

    if (session?.walletAddress) {
      if (authorAddress && normalizeAddress(authorAddress) !== session.walletAddress) {
        return NextResponse.json(
          { success: false, error: "FORBIDDEN: Wallet spoofing detected. Authenticated wallet does not match authorAddress" },
          { status: 403 }
        );
      }
      authorAddress = session.walletAddress;
    }

    if (!postId || !authorAddress || !content) {
      return NextResponse.json(
        { success: false, error: "postId, authorAddress, and content are required" },
        { status: 400 }
      );
    }

    const normAddress = normalizeAddress(authorAddress);
    if (!normAddress) {
      return NextResponse.json(
        { success: false, error: "Invalid authorAddress" },
        { status: 400 }
      );
    }

    const repo = getSocialRepository();
    const reply = await repo.addReply(postId, {
      authorAddress: normAddress,
      authorName,
      content,
    });

    return NextResponse.json({ success: true, reply });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add reply" },
      { status: 500 }
    );
  }
}
