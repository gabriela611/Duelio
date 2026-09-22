import { NextRequest, NextResponse } from "next/server";
import { getSocialRepository } from "@/infrastructure/social";
import { normalizeAddress } from "@/domain/social/identity";
import { authenticateRequest } from "@/infrastructure/auth/privyServer";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerAddress = searchParams.get("viewerAddress");

    if (!viewerAddress) {
      return NextResponse.json({ success: true, following: [] });
    }

    const repo = getSocialRepository();
    const following = await repo.getFollowing(normalizeAddress(viewerAddress) || viewerAddress);
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
    const session = await authenticateRequest(request, { required: false });
    const body = await request.json();
    let { viewerAddress, targetAddress } = body;

    if (session?.walletAddress) {
      if (viewerAddress && normalizeAddress(viewerAddress) !== session.walletAddress) {
        return NextResponse.json(
          { success: false, error: "FORBIDDEN: Wallet spoofing detected. Authenticated wallet does not match viewerAddress" },
          { status: 403 }
        );
      }
      viewerAddress = session.walletAddress;
    }

    const normViewer = normalizeAddress(viewerAddress);
    const normTarget = normalizeAddress(targetAddress);

    if (!normViewer || !normTarget) {
      return NextResponse.json(
        { success: false, error: "Valid viewerAddress and targetAddress are required" },
        { status: 400 }
      );
    }

    const repo = getSocialRepository();
    const isFollowing = await repo.toggleFollow(normViewer, normTarget);
    const following = await repo.getFollowing(normViewer);

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
