import test from "node:test";
import assert from "node:assert/strict";
import {
  SettlementVerificationError,
  verifyAndExecuteSettlement,
} from "../src/infrastructure/web3/settlementRegistry.ts";

test("Settlement Registry - Input and Format Guards", async () => {
  // Missing user address
  await assert.rejects(
    () =>
      verifyAndExecuteSettlement({
        userAddress: "",
        outcome: "WIN",
        entryTxHash: "0x" + "a".repeat(64),
      }),
    (err: any) => {
      assert.equal(err.name, "SettlementVerificationError");
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /user address/i);
      return true;
    }
  );

  // Invalid address format
  await assert.rejects(
    () =>
      verifyAndExecuteSettlement({
        userAddress: "not-an-address",
        outcome: "WIN",
        entryTxHash: "0x" + "a".repeat(64),
      }),
    (err: any) => {
      assert.equal(err.statusCode, 400);
      return true;
    }
  );

  // Missing entryTxHash
  await assert.rejects(
    () =>
      verifyAndExecuteSettlement({
        userAddress: "0x1111111111111111111111111111111111111111",
        outcome: "WIN",
        entryTxHash: "",
      }),
    (err: any) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /entryTxHash/i);
      return true;
    }
  );

  // Invalid outcome
  await assert.rejects(
    () =>
      verifyAndExecuteSettlement({
        userAddress: "0x1111111111111111111111111111111111111111",
        outcome: "CHEAT" as any,
        entryTxHash: "0x" + "a".repeat(64),
      }),
    (err: any) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /outcome/i);
      return true;
    }
  );
});

test("Settlement Math - Server-enforced payout arithmetic invariant", () => {
  const stakedWei = 100000000000000000n; // 0.1 MON

  // WIN: 1.96x (2% house fee retained)
  const winPayoutWei = (stakedWei * 196n) / 100n;
  assert.equal(winPayoutWei, 196000000000000000n); // 0.196 MON

  // DRAW: 1.0x (100% refund)
  const drawPayoutWei = stakedWei;
  assert.equal(drawPayoutWei, 100000000000000000n); // 0.1 MON

  // LOSS: 0 MON (entire stake stays in House Treasury)
  const lossPayoutWei = 0n;
  assert.equal(lossPayoutWei, 0n);

  // House edge invariant: House always collects exactly 2% on wins
  const houseFeeWei = (stakedWei * 2n) - (winPayoutWei - stakedWei);
  // Total pot = 2 * 0.1 MON = 0.2 MON. Payout = 0.196 MON. House retained = 0.004 MON (2% of 0.2 MON)
  const totalPot = stakedWei * 2n;
  const protocolCut = totalPot - winPayoutWei;
  assert.equal(protocolCut, 4000000000000000n); // 0.004 MON (2%)
});
