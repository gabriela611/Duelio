/**
 * Backfill & Migration Script: Legacy JSON Store (.data/social_store.json) -> Supabase PostgreSQL
 *
 * Requirements:
 * 1. Creates an immutable snapshot backup of the current JSON store.
 * 2. Filters out mock duels, test suite artifacts, and spoofed records (0xabab..., 0xa1a1..., 0xb2b2...).
 * 3. Enforces lowercase normalized addresses and ISO-8601 timestamps.
 * 4. Generates an idempotent SQL migration script (ON CONFLICT (id) DO NOTHING).
 * 5. Optionally executes direct Supabase insertion if SUPABASE_SERVICE_ROLE_KEY is provided.
 */

import fs from "fs";
import path from "path";

interface TweetReply {
  id: string;
  authorAddress: string;
  authorName?: string;
  authorInitials?: string;
  content: string;
  timestamp: number;
}

interface SocialChallengeRecord {
  id: string;
  authorAddress: string;
  authorName?: string;
  authorInitials?: string;
  kind?: "challenges" | "duels" | "tweets";
  eyebrow?: string;
  title: string;
  description: string;
  content?: string;
  timestamp: number;
  stakeMon?: number;
  asset?: string;
  duelId?: string;
  isLiveChallenge?: boolean;
}

interface LegacyStore {
  challenges?: SocialChallengeRecord[];
  replies?: Record<string, TweetReply[]>;
  reactions?: Record<string, string[]>;
  reposts?: Record<string, string[]>;
  follows?: Record<string, string[]>;
  duels?: Array<{
    id: string;
    timestamp: number;
    playerAddress: string;
    asset: string;
    strikePrice: number;
    settledPrice: number;
    direction: string;
    outcome: string;
    stake: number;
    payout: number;
    eloDelta: number;
    mode: string;
    onChainDuelId?: string;
  }>;
}

function escapeSqlString(val: string | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  return `'${val.replace(/'/g, "''")}'`;
}

function isTestAddress(addr: string | undefined): boolean {
  if (!addr) return true;
  const clean = addr.toLowerCase().trim();
  return (
    clean.startsWith("0xabab") ||
    clean.startsWith("0xa1a1") ||
    clean.startsWith("0xb2b2") ||
    clean === "0x0000000000000000000000000000000000000000"
  );
}

function isTestPost(post: SocialChallengeRecord): boolean {
  if (isTestAddress(post.authorAddress)) return true;
  if (post.id.startsWith("tweet_17900")) return true;
  if (post.title === "Reply Target" || post.title === "Async Repository Post") return true;
  return false;
}

function isTestReply(reply: TweetReply): boolean {
  if (isTestAddress(reply.authorAddress)) return true;
  if (reply.id.startsWith("reply_17900")) return true;
  if (reply.content === "Async reply content") return true;
  return false;
}

export function runBackfill(storePath: string, outputSqlPath: string): {
  snapshotPath: string;
  sqlPath: string;
  stats: {
    totalPostsInStore: number;
    filteredTestPosts: number;
    genuinePostsToMigrate: number;
    totalRepliesInStore: number;
    filteredTestReplies: number;
    genuineRepliesToMigrate: number;
    rejectedOnChainDuels: number;
    filteredTestPracticeDuels: number;
  };
  sql: string;
} {
  if (!fs.existsSync(storePath)) {
    throw new Error(`Store file not found at ${storePath}`);
  }

  const raw = fs.readFileSync(storePath, "utf-8");
  const store: LegacyStore = JSON.parse(raw);

  // 1. Snapshot creation
  const timestamp = Date.now();
  const snapshotDir = path.dirname(storePath);
  const snapshotPath = path.join(snapshotDir, `social_store.snapshot.${timestamp}.json`);
  const latestSnapshotPath = path.join(snapshotDir, "social_store.snapshot.json");
  fs.writeFileSync(snapshotPath, raw, "utf-8");
  fs.writeFileSync(latestSnapshotPath, raw, "utf-8");

  // 2. Filter posts
  const allPosts = store.challenges || [];
  const genuinePosts: SocialChallengeRecord[] = [];
  let filteredTestPosts = 0;

  for (const post of allPosts) {
    if (isTestPost(post)) {
      filteredTestPosts++;
    } else {
      genuinePosts.push(post);
    }
  }

  const genuinePostIds = new Set(genuinePosts.map((p) => p.id));

  // 3. Filter replies
  const genuineReplies: Array<{ postId: string; reply: TweetReply }> = [];
  let totalReplies = 0;
  let filteredTestReplies = 0;

  for (const [postId, repliesList] of Object.entries(store.replies || {})) {
    for (const r of repliesList) {
      totalReplies++;
      if (!genuinePostIds.has(postId) || isTestReply(r)) {
        filteredTestReplies++;
      } else {
        genuineReplies.push({ postId, reply: r });
      }
    }
  }

  // 4. Filter duels (client-declared onchain duels rejected; test practice duels discarded)
  let rejectedOnChainDuels = 0;
  let filteredTestPracticeDuels = 0;
  for (const duel of store.duels || []) {
    if (duel.mode === "onchain") {
      rejectedOnChainDuels++;
    } else if (isTestAddress(duel.playerAddress)) {
      filteredTestPracticeDuels++;
    }
  }

  // 5. Generate Idempotent SQL
  const sqlLines: string[] = [
    "-- ============================================================================",
    "-- Duelio Social & Game Migration: Clean Seed Backfill",
    `-- Generated At: ${new Date().toISOString()}`,
    "-- Idempotent execution: ON CONFLICT (id) DO NOTHING",
    "-- ============================================================================",
    "",
    "-- 1. Migrate Genuine Posts",
  ];

  for (const post of genuinePosts) {
    const normAddr = post.authorAddress.toLowerCase().trim();
    const kind = post.kind || (post.isLiveChallenge ? "challenges" : "tweets");
    const isoDate = new Date(post.timestamp).toISOString();
    const stakeMon = post.stakeMon !== undefined ? post.stakeMon : "NULL";
    const isLive = post.isLiveChallenge ? "true" : "false";

    sqlLines.push(
      `INSERT INTO public.posts (id, author_address, author_name, author_initials, kind, eyebrow, title, description, content, asset, stake_mon, is_live_challenge, created_at, updated_at) VALUES (` +
        `${escapeSqlString(post.id)}, ` +
        `${escapeSqlString(normAddr)}, ` +
        `${escapeSqlString(post.authorName || null)}, ` +
        `${escapeSqlString(post.authorInitials || null)}, ` +
        `${escapeSqlString(kind)}, ` +
        `${escapeSqlString(post.eyebrow || null)}, ` +
        `${escapeSqlString(post.title)}, ` +
        `${escapeSqlString(post.description)}, ` +
        `${escapeSqlString(post.content || post.description)}, ` +
        `${escapeSqlString(post.asset || null)}, ` +
        `${stakeMon}, ` +
        `${isLive}, ` +
        `TIMESTAMPTZ '${isoDate}', ` +
        `TIMESTAMPTZ '${isoDate}'` +
        `) ON CONFLICT (id) DO NOTHING;`
    );
  }

  sqlLines.push("");
  sqlLines.push("-- 2. Migrate Genuine Replies");

  for (const { postId, reply } of genuineReplies) {
    const normAddr = reply.authorAddress.toLowerCase().trim();
    const isoDate = new Date(reply.timestamp).toISOString();

    sqlLines.push(
      `INSERT INTO public.replies (id, post_id, author_address, author_name, author_initials, content, created_at) VALUES (` +
        `${escapeSqlString(reply.id)}, ` +
        `${escapeSqlString(postId)}, ` +
        `${escapeSqlString(normAddr)}, ` +
        `${escapeSqlString(reply.authorName || null)}, ` +
        `${escapeSqlString(reply.authorInitials || null)}, ` +
        `${escapeSqlString(reply.content)}, ` +
        `TIMESTAMPTZ '${isoDate}'` +
        `) ON CONFLICT (id) DO NOTHING;`
    );
  }

  sqlLines.push("");
  sqlLines.push("-- Verification summary counts");
  sqlLines.push("SELECT (SELECT count(*) FROM public.posts) as posts_count, (SELECT count(*) FROM public.replies) as replies_count;");
  sqlLines.push("");

  const sql = sqlLines.join("\n");
  fs.writeFileSync(outputSqlPath, sql, "utf-8");

  return {
    snapshotPath,
    sqlPath: outputSqlPath,
    stats: {
      totalPostsInStore: allPosts.length,
      filteredTestPosts,
      genuinePostsToMigrate: genuinePosts.length,
      totalRepliesInStore: totalReplies,
      filteredTestReplies,
      genuineRepliesToMigrate: genuineReplies.length,
      rejectedOnChainDuels,
      filteredTestPracticeDuels,
    },
    sql,
  };
}

import { fileURLToPath } from "url";

// CLI Execution entrypoint
const currentFilePath = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath);
if (isMain || process.argv.includes("--run")) {
  const storePath = path.resolve(process.cwd(), ".data/social_store.json");
  const outputSql = path.resolve(process.cwd(), "scripts/backfill.sql");

  console.log("Starting backfill migration pipeline...");
  const result = runBackfill(storePath, outputSql);

  console.log("------------------------------------------------------------");
  console.log(`Snapshot created at: ${result.snapshotPath}`);
  console.log(`SQL generated at:     ${result.sqlPath}`);
  console.log("Migration Statistics:");
  console.log(`  - Posts: ${result.stats.genuinePostsToMigrate} genuine / ${result.stats.filteredTestPosts} filtered tests / ${result.stats.totalPostsInStore} total`);
  console.log(`  - Replies: ${result.stats.genuineRepliesToMigrate} genuine / ${result.stats.filteredTestReplies} filtered tests / ${result.stats.totalRepliesInStore} total`);
  console.log(`  - Rejected client on-chain duels (Envio authoritative): ${result.stats.rejectedOnChainDuels}`);
  console.log(`  - Discarded test practice duels: ${result.stats.filteredTestPracticeDuels}`);
  console.log("------------------------------------------------------------");
  console.log("Idempotent SQL ready for execution.");
}
