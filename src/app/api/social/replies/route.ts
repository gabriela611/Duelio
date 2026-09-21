import { NextRequest, NextResponse } from "next/server";
import {
  addTweetReply,
  getTweetReplies,
} from "@/infrastructure/social/socialStore";
import { normalizeAddress } from "@/domain/social/identity";

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

    const replies = getTweetReplies(postId);
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
    const body = await request.json();
    const { postId, authorAddress, content, authorName } = body;

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

    const reply = addTweetReply(postId, {
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
