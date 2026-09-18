import assert from "node:assert/strict";
import { test } from "node:test";
import { canFollow, formatNativeBalance, normalizeAddress, toggleFollow } from "../src/domain/social/identity.ts";

const viewer = `0x${"aB".repeat(20)}`;
const other = `0x${"12".repeat(20)}`;
test("self-follow is rejected irrespective of address casing", () => {
  assert.equal(canFollow(viewer, viewer.toLowerCase()), false);
  assert.equal(toggleFollow(false, viewer, viewer.toUpperCase()), false);
  assert.equal(toggleFollow(true, viewer, viewer), false);
});
test("unknown, disconnected and abbreviated identities cannot follow", () => {
  for (const identity of [undefined, "", "0x836E...0001", "not-a-wallet", `0x${"z".repeat(40)}`]) {
    assert.equal(normalizeAddress(identity), undefined);
    assert.equal(canFollow(identity, other), false);
    assert.equal(canFollow(viewer, identity), false);
    assert.equal(toggleFollow(true, identity, other), false);
  }
});
test("different complete identities can follow and unfollow locally", () => {
  assert.equal(canFollow(viewer, other), true);
  assert.equal(toggleFollow(false, viewer, other), true);
  assert.equal(toggleFollow(true, viewer, other), false);
});
test("native balance formatting preserves precision and tiny nonzero amounts", () => {
  assert.equal(formatNativeBalance(0n), "0");
  assert.equal(formatNativeBalance(1n), "<0.0001");
  assert.equal(formatNativeBalance(10n ** 14n), "0.0001");
  assert.equal(formatNativeBalance(1253400000000000000n), "1.2534");
  assert.equal(formatNativeBalance(9007199254740993000000000000000000n), "9,007,199,254,740,993");
  assert.throws(() => formatNativeBalance(-1n), RangeError);
});

test("balance selection hides stale wallet values and clears on disconnect", async () => {
  const { balanceForAccount } = await import("../src/infrastructure/web3/balanceRequest.ts");
  const state = { address: viewer, status: "ready" as const, value: 123n };
  assert.deepEqual(balanceForAccount(state, other), { address: other, status: "loading" });
  assert.deepEqual(balanceForAccount(state, undefined), { status: "disconnected" });
  assert.deepEqual(balanceForAccount(state, viewer), state);
});

test("cancelled account request cannot overwrite the next account balance", async () => {
  const { requestBalance } = await import("../src/infrastructure/web3/balanceRequest.ts");
  const states: { address?: string; status: string; value?: bigint }[] = [];
  let resolveOld!: (value: bigint) => void;
  const oldRequest = new Promise<bigint>((resolve) => { resolveOld = resolve; });
  const cancel = requestBalance(viewer, () => oldRequest, (state) => states.push(state));
  cancel();
  requestBalance(other, async () => 2n, (state) => states.push(state));
  await new Promise((resolve) => setImmediate(resolve));
  resolveOld(999n);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(states, [
    { address: viewer, status: "loading" },
    { address: other, status: "loading" },
    { address: other, status: "ready", value: 2n },
  ]);
});

test("RPC failures are explicit errors, not fabricated zero balances", async () => {
  const { requestBalance } = await import("../src/infrastructure/web3/balanceRequest.ts");
  const states: { status: string; value?: bigint }[] = [];
  requestBalance(viewer, async () => { throw new Error("offline"); }, (state) => states.push(state));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(states.at(-1)?.status, "error");
  assert.equal(states.at(-1)?.value, undefined);
});
