import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { isAddress, type Address, type Hex } from "viem";
import {
  getDuelArenaDomain,
  OUTCOME_TYPES,
  type OutcomeMessage,
} from "@/infrastructure/web3/duelOutcomeEvidence";
import {
  DUEL_ARENA_CONTRACT_ADDRESS,
  monadTestnet,
} from "@/infrastructure/web3/monadChain";

interface RefereeRequestBody {
  duelId: string | number;
  winner: string;
  stateHash: string;
  priceStart: string | number;
  priceEnd: string | number;
  deadline: string | number;
}

export async function POST(req: NextRequest) {
  try {
    const rawKey =
      process.env.REFEREE_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    if (!rawKey || !rawKey.startsWith("0x") || rawKey.length !== 66) {
      return NextResponse.json(
        {
          error: "REFEREE_NOT_CONFIGURED",
          message: "Authoritative referee key is unavailable on the server.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body: RefereeRequestBody = await req.json();
    const { duelId, winner, stateHash, priceStart, priceEnd, deadline } = body;

    // Validate required fields
    if (
      duelId === undefined ||
      !winner ||
      !stateHash ||
      priceStart === undefined ||
      priceEnd === undefined ||
      deadline === undefined
    ) {
      return NextResponse.json(
        {
          error: "MISSING_REQUIRED_FIELDS",
          message: "duelId, winner, stateHash, priceStart, priceEnd, and deadline are required.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!isAddress(winner)) {
      return NextResponse.json(
        {
          error: "INVALID_WINNER_ADDRESS",
          message: "Winner must be a valid EVM address or zero address for DRAW.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const deadlineNum = Number(deadline);
    if (deadlineNum <= currentTimestamp) {
      return NextResponse.json(
        {
          error: "DEADLINE_EXPIRED",
          message: "Outcome signature deadline must be in the future.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const refereeAccount = privateKeyToAccount(rawKey as Hex);
    const domain = getDuelArenaDomain(
      monadTestnet.id,
      DUEL_ARENA_CONTRACT_ADDRESS as Address
    );

    const message: OutcomeMessage = {
      duelId: BigInt(duelId),
      winner: winner as Address,
      stateHash: stateHash as Hex,
      priceStart: BigInt(priceStart),
      priceEnd: BigInt(priceEnd),
      deadline: BigInt(deadline),
    };

    const signature = await refereeAccount.signTypedData({
      domain,
      types: OUTCOME_TYPES,
      primaryType: "Outcome",
      message,
    });

    return NextResponse.json(
      {
        success: true,
        referee: refereeAccount.address,
        signature,
        message: {
          duelId: duelId.toString(),
          winner,
          stateHash,
          priceStart: priceStart.toString(),
          priceEnd: priceEnd.toString(),
          deadline: deadline.toString(),
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "REFEREE_SIGNING_FAILED",
        message: err.message || "Failed to generate referee signature.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
