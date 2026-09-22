import assert from "node:assert/strict";
import { test } from "node:test";
import { FileSocialRepository } from "../src/infrastructure/social/FileSocialRepository.ts";

const repo = new FileSocialRepository();
const userA = `0x${"a1".repeat(20)}`;
const userB = `0x${"b2".repeat(20)}`;

test("ISocialRepository: getFeed retrieves posts with interaction counters", async () => {
  const feed = await repo.getFeed(userA);
  assert.ok(Array.isArray(feed));
  assert.ok(feed.length > 0);
  assert.ok("reactionsCount" in feed[0]);
  assert.ok("isLiked" in feed[0]);
  assert.ok("repostsCount" in feed[0]);
});

test("ISocialRepository: createPost persists a new tweet asynchronously", async () => {
  const post = await repo.createPost({
    authorAddress: userA,
    title: "Async Repository Post",
    description: "Testing Clean Architecture port and adapter abstraction",
    kind: "tweets",
  });

  assert.equal(post.authorAddress, userA.toLowerCase());
  assert.equal(post.title, "Async Repository Post");
});

test("ISocialRepository: replies can be added and queried asynchronously", async () => {
  const post = await repo.createPost({
    authorAddress: userA,
    title: "Reply Target",
    description: "Replying to this post",
  });

  const reply = await repo.addReply(post.id, {
    authorAddress: userB,
    content: "Async reply content",
    authorName: "User B",
  });

  assert.ok(reply);
  assert.equal(reply!.authorAddress, userB.toLowerCase());
  assert.equal(reply!.content, "Async reply content");

  const replies = await repo.getReplies(post.id);
  assert.ok(replies.some((r) => r.id === reply!.id));
});

test("ISocialRepository: reactions toggle and report correctly", async () => {
  const postId = "test-repo-reaction-post";
  const initial = await repo.getReactions(postId, userA);
  assert.equal(initial.isLiked, false);

  const toggled = await repo.toggleReaction(postId, userA);
  assert.equal(toggled.isLiked, true);

  const after = await repo.getReactions(postId, userA);
  assert.equal(after.isLiked, true);

  // Untoggle
  const unToggled = await repo.toggleReaction(postId, userA);
  assert.equal(unToggled.isLiked, false);
});

test("ISocialRepository: follow relationships toggle and query correctly", async () => {
  const isFollowing = await repo.toggleFollow(userA, userB);
  assert.equal(isFollowing, true);

  const followingList = await repo.getFollowing(userA);
  assert.ok(followingList.includes(userB.toLowerCase()));

  // Untoggle
  const unFollow = await repo.toggleFollow(userA, userB);
  assert.equal(unFollow, false);
});

test("ISocialRepository: duel history records and queries match metrics", async () => {
  const record = await repo.saveDuelRecord({
    playerAddress: userA,
    asset: "ETH",
    strikePrice: 3200,
    settledPrice: 3250,
    direction: "HIGHER",
    outcome: "WIN",
    stake: 0.25,
    payout: 0.49,
    eloDelta: 20,
    mode: "practice",
  });

  assert.equal(record.playerAddress, userA.toLowerCase());
  assert.equal(record.mode, "practice");

  const history = await repo.getDuelHistory(userA, "practice");
  assert.ok(history.some((d) => d.id === record.id));
});
