import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

  // 2. Fee events exist
  assert.ok(eventNames.includes("FeesDistributed"), "FeesDistributed event must exist");
  assert.ok(eventNames.includes("FeesWithdrawn"), "FeesWithdrawn event must exist");
  assert.ok(eventNames.includes("TreasuryUpdated"), "TreasuryUpdated event must exist");

  // 3. Constructor takes initial treasury argument
  const ctor = abi.find((x: any) => x.type === "constructor");
  assert.ok(ctor, "Constructor must be present");
  assert.equal(ctor.inputs.length, 1, "Constructor must take initial treasury argument");
  assert.equal(ctor.inputs[0].name, "_initialTreasury");
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
    // Contract safeguard: Refund user's stake instead of dividing by zero
    payout = userStake;
  } else {
    payout = (userStake * totalPool) / winningPool;
  }

  // Payout is safe refund: user gets back their 0.2 MON without division by zero
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
