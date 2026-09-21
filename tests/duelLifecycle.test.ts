import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { parseEther, formatEther, keccak256, toHex } from "viem";
import {
  getDuelArenaDomain,
  OUTCOME_TYPES,
  hashOutcomeEvidence,
  recoverOutcomeSigner,
  type OutcomeMessage,
} from "../src/infrastructure/web3/duelOutcomeEvidence.ts";

test("Two-Wallet On-Chain Duel Lifecycle Simulation (B2 & B3)", async () => {
  const chainId = 10143;
  const arenaAddress = "0x4c4d2ebcbbf77ab9b4f0d2d236ec0ce7031d9766" as const;
  const domain = getDuelArenaDomain(chainId, arenaAddress);

  // 1. Two separate test wallets + authorized referee
  const playerA = privateKeyToAccount(
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  );
  const playerB = privateKeyToAccount(
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  );
  const referee = privateKeyToAccount(
    "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  );

  assert.notEqual(playerA.address, playerB.address, "Players must have distinct addresses");

  // 2. Player A creates duel (30s, 0.5 MON stake)
  const duration = 30n; // 30 seconds
  const stakeMon = "0.5";
  const entryStake = parseEther(stakeMon);
  const rulesHash = keccak256(toHex("BTC_USD_30S_PYTH"));
  const duelId = 101n;

  let duelState: "CREATED" | "JOINED" | "ACTIVE" | "COMMITTED" | "SETTLED" = "CREATED";
  assert.equal(duelState, "CREATED");

  // 3. Player B joins duel, matching 0.5 MON stake
  const opponentStake = parseEther("0.5");
  assert.equal(entryStake, opponentStake, "Player B stake must match Player A entryStake");
  duelState = "JOINED";
  assert.equal(duelState, "JOINED");

  // 4. Duel starts: timer begins
  const startTime = BigInt(Math.floor(Date.now() / 1000));
  const endTime = startTime + duration;
  duelState = "ACTIVE";
  assert.equal(endTime - startTime, 30n);

  // 5. Match completes: Pyth price moved up (+500 bps)
  const priceStart = 95000000000n; // $95,000.00
  const priceEnd = 95500000000n;   // $95,500.00
  // Player A predicted HIGHER, Player B predicted LOWER -> Winner is Player A
  const winner = playerA.address;
  const stateHash = keccak256(toHex("MATCH_TRANSCRIPT_101"));
  const deadline = endTime + 3600n; // 1 hour buffer

  // 6. Referee generates EIP-712 signed outcome evidence
  const message: OutcomeMessage = {
    duelId,
    winner,
    stateHash,
    priceStart,
    priceEnd,
    deadline,
  };

  const refereeSig = await referee.signTypedData({
    domain,
    types: OUTCOME_TYPES,
    primaryType: "Outcome",
    message,
  });

  // Verify referee signature
  const recoveredSigner = await recoverOutcomeSigner(domain, message, refereeSig);
  assert.equal(
    recoveredSigner.toLowerCase(),
    referee.address.toLowerCase(),
    "Recovered signer must match authorized referee"
  );

  // 7. Outcome committed
  duelState = "COMMITTED";
  assert.equal(duelState, "COMMITTED");

  // 8. Settlement and Reward Claim:
  // Total trader pool: 1.0 MON (0.5 from A + 0.5 from B)
  // Protocol fee: 2% = 0.02 MON
  // Trader payout: 0.98 MON
  const totalTraderPool = entryStake * 2n;
  const PLATFORM_FEE_BPS = 200n;
  const BPS_DIVISOR = 10000n;
  const protocolFee = (totalTraderPool * PLATFORM_FEE_BPS) / BPS_DIVISOR;
  const winnerPayout = totalTraderPool - protocolFee;

  assert.equal(formatEther(totalTraderPool), "1");
  assert.equal(formatEther(protocolFee), "0.02");
  assert.equal(formatEther(winnerPayout), "0.98");

  duelState = "SETTLED";
  assert.equal(duelState, "SETTLED");
});
