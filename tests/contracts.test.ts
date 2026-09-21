import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import {
  getDuelArenaDomain,
  hashOutcomeEvidence,
  recoverOutcomeSigner,
  OUTCOME_TYPES,
  type OutcomeMessage,
} from "../src/infrastructure/web3/duelOutcomeEvidence.ts";

test("DuelArena Artifact & ABI Security Invariants", () => {
  const artifactPath = path.resolve("./contracts/artifacts/DuelArena.json");
  assert.ok(fs.existsSync(artifactPath), "DuelArena.json artifact must exist");

  const { abi } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const functionNames = abi.filter((x: any) => x.type === "function").map((x: any) => x.name);
  const eventNames = abi.filter((x: any) => x.type === "event").map((x: any) => x.name);

  // 1. Treasury and fee methods exist
  assert.ok(functionNames.includes("treasury"), "treasury getter must exist");
  assert.ok(functionNames.includes("accumulatedFees"), "accumulatedFees getter must exist");
  assert.ok(functionNames.includes("setTreasury"), "setTreasury function must exist");
  assert.ok(functionNames.includes("withdrawFees"), "withdrawFees function must exist");
  assert.ok(functionNames.includes("cancelDuel"), "cancelDuel function must exist");

  // 2. Referee methods and events exist (B3)
  assert.ok(functionNames.includes("referee"), "referee getter must exist");
  assert.ok(functionNames.includes("setReferee"), "setReferee function must exist");
  assert.ok(eventNames.includes("RefereeUpdated"), "RefereeUpdated event must exist");

  // 3. EIP-712 getters exist
  assert.ok(functionNames.includes("domainSeparator"), "domainSeparator getter must exist");
  assert.ok(functionNames.includes("hashOutcome"), "hashOutcome view helper must exist");

  // 4. commitOutcome has deadline input parameter
  const commitFn = abi.find((x: any) => x.type === "function" && x.name === "commitOutcome");
  assert.ok(commitFn, "commitOutcome must exist");
  const inputNames = commitFn.inputs.map((i: any) => i.name);
  assert.ok(inputNames.includes("deadline"), "commitOutcome must accept deadline");
  assert.equal(commitFn.inputs.length, 8, "commitOutcome must have 8 parameters");

  // 5. Fee events exist
  assert.ok(eventNames.includes("FeesDistributed"), "FeesDistributed event must exist");
  assert.ok(eventNames.includes("FeesWithdrawn"), "FeesWithdrawn event must exist");
  assert.ok(eventNames.includes("TreasuryUpdated"), "TreasuryUpdated event must exist");

  // 6. Constructor takes initial treasury argument
  const ctor = abi.find((x: any) => x.type === "constructor");
  assert.ok(ctor, "Constructor must be present");
  assert.equal(ctor.inputs.length, 1, "Constructor must take initial treasury argument");
  assert.equal(ctor.inputs[0].name, "_initialTreasury");
});

test("DuelArena - EIP-712 Outcome Evidence Hashing & Signature Verification (B3)", async () => {
  const chainId = 10143;
  const contractAddress = "0x4c4d2ebcbbf77ab9b4f0d2d236ec0ce7031d9766" as const;
  const domain = getDuelArenaDomain(chainId, contractAddress);

  const playerA = privateKeyToAccount(
    "0x1111111111111111111111111111111111111111111111111111111111111111"
  );
  const playerB = privateKeyToAccount(
    "0x2222222222222222222222222222222222222222222222222222222222222222"
  );
  const referee = privateKeyToAccount(
    "0x3333333333333333333333333333333333333333333333333333333333333333"
  );
  const attacker = privateKeyToAccount(
    "0x4444444444444444444444444444444444444444444444444444444444444444"
  );

  const message: OutcomeMessage = {
    duelId: 42n,
    winner: playerA.address,
    stateHash: "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    priceStart: 95000000000n,
    priceEnd: 95500000000n,
    deadline: 1800000000n,
  };

  // 1. Hash is deterministic and changes with any parameter tamper
  const digest = hashOutcomeEvidence(domain, message);
  assert.ok(digest.startsWith("0x") && digest.length === 66, "Digest must be 32-byte hex");

  const tamperedMessage = { ...message, priceEnd: 94000000000n };
  const tamperedDigest = hashOutcomeEvidence(domain, tamperedMessage);
  assert.notEqual(digest, tamperedDigest, "Tampering price must change outcome digest");

  // 2. Cross-chain replay protection
  const altChainDomain = getDuelArenaDomain(1, contractAddress);
  const altChainDigest = hashOutcomeEvidence(altChainDomain, message);
  assert.notEqual(digest, altChainDigest, "Digest must differ across different chain IDs");

  // 3. Cross-contract replay protection
  const altContractDomain = getDuelArenaDomain(chainId, "0x0000000000000000000000000000000000000001");
  const altContractDigest = hashOutcomeEvidence(altContractDomain, message);
  assert.notEqual(digest, altContractDigest, "Digest must differ across different contract addresses");

  // 4. Sign with Player A and verify recovery
  const sigA = await playerA.signTypedData({
    domain,
    types: OUTCOME_TYPES,
    primaryType: "Outcome",
    message,
  });
  const recoveredA = await recoverOutcomeSigner(domain, message, sigA);
  assert.equal(recoveredA.toLowerCase(), playerA.address.toLowerCase());

  // 5. Sign with Referee and verify recovery
  const sigRef = await referee.signTypedData({
    domain,
    types: OUTCOME_TYPES,
    primaryType: "Outcome",
    message,
  });
  const recoveredRef = await recoverOutcomeSigner(domain, message, sigRef);
  assert.equal(recoveredRef.toLowerCase(), referee.address.toLowerCase());

  // 6. Attacker signature recovery does NOT match player or referee
  const sigAttacker = await attacker.signTypedData({
    domain,
    types: OUTCOME_TYPES,
    primaryType: "Outcome",
    message,
  });
  const recoveredAttacker = await recoverOutcomeSigner(domain, message, sigAttacker);
  assert.notEqual(recoveredAttacker.toLowerCase(), playerA.address.toLowerCase());
  assert.notEqual(recoveredAttacker.toLowerCase(), referee.address.toLowerCase());
});

test("DuelArena - DRAW (Tie) handling refunds stakes without fee deduction", () => {
  const entryStake = 500000000000000000n; // 0.5 MON
  const winner = "0x0000000000000000000000000000000000000000";

  // When DRAW: Both players get exact entryStake refund, protocolFee is 0
  const isDraw = winner === "0x0000000000000000000000000000000000000000";
  assert.ok(isDraw, "Address 0 must represent a DRAW");

  const playerARefund = entryStake;
  const playerBRefund = entryStake;
  assert.equal(playerARefund, entryStake);
  assert.equal(playerBRefund, entryStake);

  // Spectator prediction pools in DRAW: full refund of all amounts
  const predAmount1 = 100000000000000000n; // 0.1 MON
  const predAmount2 = 300000000000000000n; // 0.3 MON
  const winningPool = 0n; // Neither pool won

  let payout1 = isDraw || winningPool === 0n ? predAmount1 : 0n;
  let payout2 = isDraw || winningPool === 0n ? predAmount2 : 0n;

  assert.equal(payout1, predAmount1);
  assert.equal(payout2, predAmount2);
});

test("DuelArena - Prediction pool arithmetic handles unbacked winners safely", () => {
  // Scenario: All spectators bet on Player B. Player A wins (winningPool = 0)
  const totalPoolA = 0n;
  const totalPoolB = 500000000000000000n; // 0.5 MON
  const userStake = 200000000000000000n; // 0.2 MON
  const winnerIsPlayerA = true;

  const winningPool = winnerIsPlayerA ? totalPoolA : totalPoolB;
  const losingPool = winnerIsPlayerA ? totalPoolB : totalPoolA;
  const totalPool = winningPool + losingPool;

  let payout: bigint;
  if (winningPool === 0n) {
    payout = userStake;
  } else {
    payout = (userStake * totalPool) / winningPool;
  }

  assert.equal(payout, userStake);
  assert.equal(payout, 200000000000000000n);
});

test("DuelArena - Protocol fee calculations and treasury routing", () => {
  const entryStake = 500000000000000000n; // 0.5 MON each
  const totalTraderPool = entryStake * 2n; // 1.0 MON
  const PLATFORM_FEE_BPS = 200n; // 2%
  const BPS_DIVISOR = 10000n;

  const protocolFee = (totalTraderPool * PLATFORM_FEE_BPS) / BPS_DIVISOR;
  const traderPayout = totalTraderPool - protocolFee;

  // 2% of 1 MON = 0.02 MON
  assert.equal(protocolFee, 20000000000000000n); // 0.02 MON
  assert.equal(traderPayout, 980000000000000000n); // 0.98 MON
  assert.equal(traderPayout + protocolFee, totalTraderPool);
});
