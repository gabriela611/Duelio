import { NextResponse } from "next/server.js";
import { LEGACY_SETTLEMENT_REJECTION } from "./legacySettlementPolicy.ts";

export const dynamic = "force-dynamic";

/**
 * The legacy endpoint accepted a client-selected outcome and used a server-held
 * treasury key to send funds. It must remain fail-closed until the canonical
 * DuelArena lifecycle replaces it.
 */
export async function POST(_request: Request) {
  return NextResponse.json(LEGACY_SETTLEMENT_REJECTION.body, {
    status: LEGACY_SETTLEMENT_REJECTION.status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
