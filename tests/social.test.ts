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

test("social store persists challenges and formats authors correctly", async () => {
  const { getAllChallenges, saveChallenge } = await import("../src/infrastructure/social/socialStore.ts");
  const initialCount = getAllChallenges().length;

  const saved = saveChallenge({
    authorAddress: viewer,
    eyebrow: "BTC Duel Challenge",
    title: "Can you beat my prediction?",
    description: "30s arena clash on Monad Testnet",
    kind: "challenges",
    asset: "BTC",
    stakeMon: 0.25,
    authorInitials: "AB",
    duelId: "42",
  });

  assert.equal(saved.authorAddress, viewer.toLowerCase());
  assert.equal(saved.duelId, "42");
  assert.equal(saved.isLiveChallenge, true);

  const updated = getAllChallenges();
  assert.equal(updated.length, initialCount + 1);
  assert.equal(updated[0].id, saved.id);
});

test("social store reaction toggles correctly track user likes", async () => {
  const { toggleServerReaction, getServerReactions } = await import("../src/infrastructure/social/socialStore.ts");
  const postId = "test-post-1";

  const firstLike = toggleServerReaction(postId, viewer);
  assert.equal(firstLike.isLiked, true);
  assert.equal(firstLike.count, 1);

  const queryAfterLike = getServerReactions(postId, viewer);
  assert.equal(queryAfterLike.isLiked, true);
  assert.equal(queryAfterLike.count, 1);

  // Other user views
  const queryOther = getServerReactions(postId, other);
  assert.equal(queryOther.isLiked, false);
  assert.equal(queryOther.count, 1);

  // Viewer unlikes
  const unlike = toggleServerReaction(postId, viewer);
  assert.equal(unlike.isLiked, false);
  assert.equal(unlike.count, 0);
});

test("social store follow toggles correctly track relationships", async () => {
  const { toggleServerFollow, getServerFollowing } = await import("../src/infrastructure/social/socialStore.ts");

  // Viewer follows other
  const followed = toggleServerFollow(viewer, other);
  assert.equal(followed, true);
  assert.ok(getServerFollowing(viewer).includes(other.toLowerCase()));

  // Viewer unfollows other
  const unfollowed = toggleServerFollow(viewer, other);
  assert.equal(unfollowed, false);
  assert.ok(!getServerFollowing(viewer).includes(other.toLowerCase()));

  // Self-follow rejected
  const selfFollow = toggleServerFollow(viewer, viewer);
  assert.equal(selfFollow, false);
});

test("social feed contains zero fake financial payouts or mock wins", async () => {
  const { getSocialFeed } = await import("../src/domain/social/socialService.ts");
  const feed = getSocialFeed();

  for (const post of feed) {
    // Assert no fake seeds claiming net payouts
    if (post.id.startsWith("genesis-")) {
      assert.ok(!post.description.includes("Net payout"), `Post ${post.id} contains mock net payout claim`);
      assert.ok(!post.title.includes("Victory: +"), `Post ${post.id} contains mock victory claim`);
    }
  }
});
