import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { LEGACY_SETTLEMENT_REJECTION } from "../src/app/api/clash/settle/legacySettlementPolicy.ts";
import { POST } from "../src/app/api/clash/settle/route.ts";
import {
  getDuelHistory,
  getPlayerStats,
  recordDuel,
} from "../src/domain/duel/duelHistory.ts";
import {
  getPriceSourceLabel,
  isLivePriceSource,
} from "../src/infrastructure/price-feed/priceSource.ts";

const repositoryRoot = process.cwd();

test("legacy settlement handler fails closed for every client-selected outcome", async () => {
  for (const outcome of ["WIN", "DRAW", "LOSS"]) {
    const request = new Request("http://localhost/api/clash/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress: "0x1111111111111111111111111111111111111111",
        entryTxHash: `0x${"a".repeat(64)}`,
        outcome,
      }),
    });
    const response = await POST(request);
    const body = await response.json();

    assert.equal(response.status, 410, `${outcome} must not be accepted`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(body, LEGACY_SETTLEMENT_REJECTION.body);
    assert.equal("success" in body, false);
    assert.equal("payoutTxHash" in body, false);
  }
});

test("legacy settlement cannot load a treasury key or send a payout", () => {
  const routeSource = readFileSync(
    path.join(repositoryRoot, "src/app/api/clash/settle/route.ts"),
    "utf8"
  );
  const removedRegistry = path.join(
    repositoryRoot,
    "src/infrastructure/web3/settlementRegistry.ts"
  );

  assert.equal(existsSync(removedRegistry), false);
  assert.doesNotMatch(routeSource, /HOUSE_TREASURY_PRIVATE_KEY/);
  assert.doesNotMatch(routeSource, /privateKeyToAccount/);
  assert.doesNotMatch(routeSource, /sendTransaction/);
  assert.match(routeSource, /LEGACY_SETTLEMENT_REJECTION\.status/);
  assert.match(routeSource, /"Cache-Control": "no-store"/);
});

test("arena routes stakes through canonical DuelArena escrow and forbids legacy treasury settlement", () => {
  const arenaSource = readFileSync(
    path.join(
      repositoryRoot,
      "src/presentation/components/arena/ArenaView.tsx"
    ),
    "utf8"
  );
  const removedStakeSender = path.join(
    repositoryRoot,
    "src/infrastructure/web3/sendStakeTransaction.ts"
  );

  assert.equal(existsSync(removedStakeSender), false);
  assert.doesNotMatch(arenaSource, /sendStakeToHouse/);
  assert.doesNotMatch(arenaSource, /\/api\/clash\/settle/);
  assert.match(arenaSource, /createDuelOnChain/);
  assert.match(arenaSource, /joinDuelOnChain/);
  assert.match(arenaSource, /commitOutcomeOnChain/);
});

test("practice results never contribute to canonical reputation", () => {
  const records = new Map<string, string>();
  const storage = {
    get length() {
      return records.size;
    },
    clear() {
      records.clear();
    },
    getItem(key: string) {
      return records.get(key) ?? null;
    },
    key(index: number) {
      return [...records.keys()][index] ?? null;
    },
    removeItem(key: string) {
      records.delete(key);
    },
    setItem(key: string, value: string) {
      records.set(key, value);
    },
  } satisfies Storage;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage"
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  try {
    const playerAddress = "0x1111111111111111111111111111111111111111";
    recordDuel({
      playerAddress,
      asset: "BTC",
      strikePrice: 100,
      settledPrice: 101,
      direction: "HIGHER",
      outcome: "WIN",
      stake: 0,
      payout: 0,
      eloDelta: 18,
      mode: "practice",
    });

    assert.equal(getDuelHistory(playerAddress).length, 0);
    assert.equal(getPlayerStats(playerAddress).totalDuels, 0);
    assert.equal(getPlayerStats(playerAddress).elo, 1200);
    assert.equal(getDuelHistory(playerAddress, "practice").length, 1);
    assert.equal(getPlayerStats(playerAddress, "practice").totalDuels, 1);
    assert.equal(getPlayerStats(playerAddress, "practice").elo, 1218);

    storage.setItem(
      "duelio_duel_records_v1",
      JSON.stringify([
        {
          id: "legacy-local-round",
          timestamp: 1,
          playerAddress,
          asset: "BTC",
          strikePrice: 100,
          settledPrice: 99,
          direction: "LOWER",
          outcome: "WIN",
          stake: 0.1,
          payout: 0.196,
          eloDelta: 18,
        },
      ])
    );
    assert.equal(getDuelHistory(playerAddress).length, 0);
    assert.equal(getDuelHistory(playerAddress, "practice").length, 1);
  } finally {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
    if (storageDescriptor) {
      Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }
});

test("benchmark prices are explicitly simulated and never live", () => {
  assert.equal(isLivePriceSource("benchmark"), false);
  assert.equal(getPriceSourceLabel("benchmark"), "Simulated benchmark");
  assert.equal(isLivePriceSource("pyth"), true);
  assert.equal(isLivePriceSource("coinbase"), true);
});
