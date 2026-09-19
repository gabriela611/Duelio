import { NextRequest, NextResponse } from "next/server";
import {
  verifyAndExecuteSettlement,
  SettlementVerificationError,
} from "@/infrastructure/web3/settlementRegistry";

export const dynamic = "force-dynamic";

/**
 * Settles 10-second speed clash matches on-chain with Zero-Trust enforcement:
 * 1. Requires valid on-chain entryTxHash.
 * 2. Blocks replay attacks across sessions and concurrent in-flight requests.
 * 3. Verifies tx receipt, sender, recipient (House Treasury), and staked amount on Monad Testnet.
 * 4. Strictly calculates and enforces payout server-side (1.96x on WIN, 1.0x on DRAW, 0 on LOSS).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress, outcome, entryTxHash } = body;

    const result = await verifyAndExecuteSettlement({
      userAddress,
      outcome,
      entryTxHash,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof SettlementVerificationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Settle payout error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
