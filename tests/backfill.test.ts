import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "fs";
import path from "path";
import { runBackfill } from "../scripts/backfill.ts";

test("backfill pipeline correctly isolates genuine records from test pollution", () => {
  const fixtureDir = path.resolve(process.cwd(), ".data");
  const testStorePath = path.join(fixtureDir, "test_backfill_store.json");
  const testSqlPath = path.join(fixtureDir, "test_backfill_output.sql");

  const mockStore = {
    challenges: [
      {
        id: "mock-test-1",
        authorAddress: "0xabababababababababababababababababababab",
        title: "Mock Tweet",
        description: "Test run tweet",
        timestamp: 1790000000000,
      },
      {
        id: "genesis-challenge-1",
        authorAddress: "0x836EF90000000000000000000000000000000001",
        authorName: "Duelist Alpha",
        authorInitials: "DA",
        kind: "challenges",
        eyebrow: "Open 30s Arena Challenge",
        title: "Who can predict BTC in 30s?",
        description: "Looking for a rival in the 30-second arena.",
        timestamp: 1774180000000,
        stakeMon: 0.1,
        asset: "BTC",
        isLiveChallenge: true,
      },
    ],
    replies: {
      "mock-test-1": [
        {
          id: "mock-reply-1",
          authorAddress: "0xb2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2",
          content: "Spam reply",
          timestamp: 1790000001000,
        },
      ],
      "genesis-challenge-1": [
        {
          id: "mock-reply-polluted",
          authorAddress: "0xabababababababababababababababababababab",
          content: "Calling your bluff",
          timestamp: 1790000002000,
        },
        {
          id: "reply-genesis-1",
          authorAddress: "0x836EF90000000000000000000000000000000002",
          authorName: "MonadMaster",
          authorInitials: "MM",
          content: "Accepted! Let's see your prediction reflexes on $BTC.",
          timestamp: 1774180400000,
        },
      ],
    },
    duels: [
      {
        id: "fake-onchain-duel",
        mode: "onchain",
        playerAddress: "0xabababababababababababababababababababab",
        asset: "BTC",
        strikePrice: 96000,
        settledPrice: 96500,
        direction: "HIGHER",
        outcome: "WIN",
        stake: 0.5,
        payout: 0.98,
        eloDelta: 16,
        timestamp: 1790000000000,
      },
      {
        id: "mock-practice-duel",
        mode: "practice",
        playerAddress: "0xa1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1",
        asset: "ETH",
        strikePrice: 3200,
        settledPrice: 3250,
        direction: "HIGHER",
        outcome: "WIN",
        stake: 0.25,
        payout: 0.49,
        eloDelta: 20,
        timestamp: 1790000000000,
      },
    ],
  };

  try {
    fs.writeFileSync(testStorePath, JSON.stringify(mockStore, null, 2), "utf-8");

    const result = runBackfill(testStorePath, testSqlPath);

    assert.equal(result.stats.totalPostsInStore, 2);
    assert.equal(result.stats.filteredTestPosts, 1);
    assert.equal(result.stats.genuinePostsToMigrate, 1);

    assert.equal(result.stats.totalRepliesInStore, 3);
    assert.equal(result.stats.filteredTestReplies, 2);
    assert.equal(result.stats.genuineRepliesToMigrate, 1);

    assert.equal(result.stats.rejectedOnChainDuels, 1);
    assert.equal(result.stats.filteredTestPracticeDuels, 1);

    // Verify SQL generated
    const sql = fs.readFileSync(testSqlPath, "utf-8");
    assert.ok(sql.includes("genesis-challenge-1"));
    assert.ok(sql.includes("0x836ef90000000000000000000000000000000001"));
    assert.ok(sql.includes("reply-genesis-1"));
    assert.ok(sql.includes("0x836ef90000000000000000000000000000000002"));
    assert.ok(!sql.includes("mock-test-1"));
    assert.ok(!sql.includes("mock-reply-1"));
    assert.ok(!sql.includes("0xabab"));
    assert.ok(sql.includes("ON CONFLICT (id) DO NOTHING"));
  } finally {
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
    if (fs.existsSync(testSqlPath)) fs.unlinkSync(testSqlPath);
  }
});
