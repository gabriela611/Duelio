import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ShadowSocialRepository,
  type ShadowCompareResult,
} from "../src/infrastructure/social/ShadowSocialRepository.ts";
import { FileSocialRepository } from "../src/infrastructure/social/FileSocialRepository.ts";
import { SupabaseSocialRepository } from "../src/infrastructure/social/SupabaseSocialRepository.ts";
import { getSocialRepository, setSocialRepository } from "../src/infrastructure/social/index.ts";
import { verifyRepositoryParity } from "../scripts/verifyParity.ts";

test("ShadowSocialRepository: delegates primary read synchronously and reports telemetry", async () => {
  const fileRepo = new FileSocialRepository();
  const supaRepo = new SupabaseSocialRepository();

  const reports: ShadowCompareResult[] = [];
  const shadowRepo = new ShadowSocialRepository(
    fileRepo,
    supaRepo,
    (res) => {
      reports.push(res);
    },
    { awaitShadow: true }
  );

  const feed = await shadowRepo.getFeed();
  assert.ok(Array.isArray(feed));
  assert.ok(feed.length > 0);

  assert.ok(reports.length > 0);
  const feedReport = reports.find((r) => r.method === "getFeed");
  assert.ok(feedReport);
  assert.equal(feedReport!.matched, true);
});

test("ShadowSocialRepository: getReplies matches genuine seed reply", async () => {
  const fileRepo = new FileSocialRepository();
  const supaRepo = new SupabaseSocialRepository();

  const reports: ShadowCompareResult[] = [];
  const shadowRepo = new ShadowSocialRepository(
    fileRepo,
    supaRepo,
    (res) => {
      reports.push(res);
    },
    { awaitShadow: true }
  );

  const replies = await shadowRepo.getReplies("genesis-challenge-1");
  assert.ok(Array.isArray(replies));
  assert.ok(replies.some((r) => r.id === "reply-genesis-1"));

  const replyReport = reports.find((r) => r.method === "getReplies");
  assert.ok(replyReport);
  assert.equal(replyReport!.matched, true);
});

test("SocialRepository Factory: switches repository based on DATA_BACKEND matrix", () => {
  const prevEnv = process.env.DATA_BACKEND;
  try {
    setSocialRepository(null);
    process.env.DATA_BACKEND = "shadow";
    const shadow = getSocialRepository();
    assert.ok(shadow instanceof ShadowSocialRepository);

    setSocialRepository(null);
    process.env.DATA_BACKEND = "supabase";
    const supa = getSocialRepository();
    assert.ok(supa instanceof SupabaseSocialRepository);

    setSocialRepository(null);
    process.env.DATA_BACKEND = "file";
    const file = getSocialRepository();
    assert.ok(file instanceof FileSocialRepository);

    setSocialRepository(null);
    delete process.env.DATA_BACKEND;
    const def = getSocialRepository();
    assert.ok(def instanceof SupabaseSocialRepository);
  } finally {
    process.env.DATA_BACKEND = prevEnv;
    setSocialRepository(null);
  }
});

test("Storage Parity: all automated parity verification checks pass", async () => {
  const result = await verifyRepositoryParity();
  assert.equal(result.passed, true);
  for (const check of result.checks) {
    assert.equal(check.passed, true, `Check failed: ${check.name}`);
  }
});
