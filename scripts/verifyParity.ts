/**
 * Parity Verification Script: FileSocialRepository vs SupabaseSocialRepository
 *
 * Verifies that the backfilled Supabase PostgreSQL database maintains 100%
 * semantic and data parity with the canonical seeds of the legacy JSON store.
 */

import { FileSocialRepository } from "../src/infrastructure/social/FileSocialRepository.ts";
import { SupabaseSocialRepository } from "../src/infrastructure/social/SupabaseSocialRepository.ts";

export interface ParityCheckResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    details?: string;
  }>;
}

export async function verifyRepositoryParity(): Promise<ParityCheckResult> {
  const fileRepo = new FileSocialRepository();
  const supaRepo = new SupabaseSocialRepository();

  const checks: ParityCheckResult["checks"] = [];

  // 1. Feed Item Parity on Genuine Seeds
  const [fileFeed, supaFeed] = await Promise.all([
    fileRepo.getFeed(),
    supaRepo.getFeed(),
  ]);

  const canonicalIds = ["genesis-challenge-1", "genesis-challenge-2", "genesis-tweet-3"];
  for (const id of canonicalIds) {
    const fItem = fileFeed.find((p) => p.id === id);
    const sItem = supaFeed.find((p) => p.id === id);

    if (!fItem || !sItem) {
      checks.push({
        name: `Post Presence: ${id}`,
        passed: false,
        details: `Missing: file=${Boolean(fItem)}, supa=${Boolean(sItem)}`,
      });
      continue;
    }

    const fieldMismatches: string[] = [];
    if (fItem.authorAddress.toLowerCase() !== sItem.authorAddress.toLowerCase()) {
      fieldMismatches.push("authorAddress");
    }
    if (fItem.title !== sItem.title) {
      fieldMismatches.push("title");
    }
    if (fItem.description !== sItem.description) {
      fieldMismatches.push("description");
    }
    if (fItem.kind !== sItem.kind) {
      fieldMismatches.push("kind");
    }
    if (fItem.asset !== sItem.asset) {
      fieldMismatches.push("asset");
    }
    if (fItem.stakeMon !== sItem.stakeMon) {
      fieldMismatches.push("stakeMon");
    }
    if (Boolean(fItem.isLiveChallenge) !== Boolean(sItem.isLiveChallenge)) {
      fieldMismatches.push("isLiveChallenge");
    }
    if (fItem.timestamp !== sItem.timestamp) {
      fieldMismatches.push("timestamp");
    }

    checks.push({
      name: `Post Parity: ${id}`,
      passed: fieldMismatches.length === 0,
      details: fieldMismatches.length > 0 ? `Mismatches: ${fieldMismatches.join(", ")}` : "100% Match",
    });
  }

  // 2. Reply Parity on Genesis Challenge
  const [fileReplies, supaReplies] = await Promise.all([
    fileRepo.getReplies("genesis-challenge-1"),
    supaRepo.getReplies("genesis-challenge-1"),
  ]);

  const fGenReply = fileReplies.find((r) => r.id === "reply-genesis-1");
  const sGenReply = supaReplies.find((r) => r.id === "reply-genesis-1");

  if (!fGenReply || !sGenReply) {
    checks.push({
      name: "Reply Parity: reply-genesis-1",
      passed: false,
      details: `Missing: file=${Boolean(fGenReply)}, supa=${Boolean(sGenReply)}`,
    });
  } else {
    const match =
      fGenReply.authorAddress.toLowerCase() === sGenReply.authorAddress.toLowerCase() &&
      fGenReply.content === sGenReply.content &&
      fGenReply.timestamp === sGenReply.timestamp;
    checks.push({
      name: "Reply Parity: reply-genesis-1",
      passed: match,
      details: match ? "100% Match" : "Reply content/author mismatch",
    });
  }

  // 3. Test Isolation (Supabase must NOT contain test mock posts)
  const testAddresses = ["0xabab", "0xa1a1", "0xb2b2"];
  const pollutedInSupa = supaFeed.filter((p) =>
    testAddresses.some((t) => p.authorAddress.toLowerCase().startsWith(t))
  );

  checks.push({
    name: "Sanitation: Zero Test Pollution in Supabase",
    passed: pollutedInSupa.length === 0,
    details:
      pollutedInSupa.length === 0
        ? "Clean (0 mock posts)"
        : `Found ${pollutedInSupa.length} test posts in Supabase`,
  });

  // 4. On-chain duel boundary compliance
  const supaOnchainDuels = await supaRepo.getDuelHistory(undefined, "onchain");
  checks.push({
    name: "Boundary: Client onchain duels rejected (Envio indexer authoritative)",
    passed: supaOnchainDuels.length === 0,
    details:
      supaOnchainDuels.length === 0
        ? "Compliant (0 client onchain records in Supabase)"
        : "Failed (onchain duels found in database)",
  });

  const allPassed = checks.every((c) => c.passed);
  return { passed: allPassed, checks };
}

// CLI Execution entrypoint
const isCLI = process.argv[1]?.includes("verifyParity");
if (isCLI) {
  console.log("============================================================");
  console.log("Duelio Storage Parity Verification (File vs Supabase)");
  console.log("============================================================");

  verifyRepositoryParity()
    .then((result) => {
      for (const c of result.checks) {
        const icon = c.passed ? "✓ PASS" : "✗ FAIL";
        console.log(`[${icon}] ${c.name} - ${c.details}`);
      }
      console.log("============================================================");
      if (result.passed) {
        console.log("All parity checks PASSED. Supabase is ready for cutover!");
        process.exit(0);
      } else {
        console.error("Parity checks FAILED. Review discrepancies above.");
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Fatal error during parity verification:", err);
      process.exit(1);
    });
}
