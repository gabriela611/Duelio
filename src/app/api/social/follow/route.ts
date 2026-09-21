import { NextRequest, NextResponse } from "next/server";
import {
  getServerFollowing,
  toggleServerFollow,
} from "@/infrastructure/social/socialStore";
import { normalizeAddress } from "@/domain/social/identity";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerAddress = searchParams.get("viewerAddress");

    if (!viewerAddress) {
      return NextResponse.json({ success: true, following: [] });
    }

    const following = getServerFollowing(viewerAddress);
    return NextResponse.json({ success: true, following });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get following list" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { viewerAddress, targetAddress } = body;

    const normViewer = normalizeAddress(viewerAddress);
    const normTarget = normalizeAddress(targetAddress);

    if (!normViewer || !normTarget) {
      return NextResponse.json(
        { success: false, error: "Valid viewerAddress and targetAddress are required" },
        { status: 400 }
      );
    }

    const isFollowing = toggleServerFollow(normViewer, normTarget);
    const following = getServerFollowing(normViewer);

    return NextResponse.json({
      success: true,
      isFollowing,
      following,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update follow state" },
      { status: 500 }
    );
  }
}
