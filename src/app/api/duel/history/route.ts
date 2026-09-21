import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSocialRepository } from "@/infrastructure/social";
import { type DuelMode } from "@/infrastructure/social/socialStore";
import { authenticateRequest } from "@/infrastructure/auth/privyServer";
import { normalizeAddress } from "@/domain/social/identity";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const playerAddress = searchParams.get("playerAddress") || undefined;
    const mode = (searchParams.get("mode") as DuelMode) || "onchain";

    const repo = getSocialRepository();
    const history = await repo.getDuelHistory(playerAddress, mode);
    return NextResponse.json({ success: true, history });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch duel history" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req, { required: false });
    const body = await req.json();
    let {
      playerAddress,
      asset,
      strikePrice,
      settledPrice,
      direction,
      outcome,
      stake,
      payout,
      eloDelta,
      mode = "onchain",
      onChainDuelId,
    } = body;

    if (session?.walletAddress) {
      if (playerAddress && normalizeAddress(playerAddress) !== session.walletAddress) {
        return NextResponse.json(
          { success: false, error: "FORBIDDEN: Wallet spoofing detected. Authenticated wallet does not match playerAddress" },
          { status: 403 }
        );
      }
      playerAddress = session.walletAddress;
    }

    if (!playerAddress || !isAddress(playerAddress)) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_FAILED: Invalid player address" },
        { status: 400 }
      );
    }

    if (!asset || typeof strikePrice !== "number" || typeof settledPrice !== "number") {
      return NextResponse.json(
        { success: false, error: "VALIDATION_FAILED: Missing match metrics" },
        { status: 400 }
      );
    }

    const repo = getSocialRepository();
    const record = await repo.saveDuelRecord({
      playerAddress,
      asset,
      strikePrice,
      settledPrice,
      direction,
      outcome,
      stake: Number(stake || 0),
      payout: Number(payout || 0),
      eloDelta: Number(eloDelta || 0),
      mode,
      onChainDuelId: onChainDuelId ? String(onChainDuelId) : undefined,
    });

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to record duel" },
      { status: 500 }
    );
  }
}
