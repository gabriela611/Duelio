import test from "node:test";
import assert from "node:assert/strict";
import { PythHermesService, PYTH_FEED_IDS } from "../src/infrastructure/price-feed/pythHermesService.ts";

test("PythHermesService - parsePythPrice calculates human-readable prices correctly", () => {
  // BTC at $81,250.50 with -8 expo
  const btcPrice = PythHermesService.parsePythPrice("8125050000000", -8);
  assert.equal(btcPrice, 81250.5);

  // ETH at $2,630.125 with -8 expo
  const ethPrice = PythHermesService.parsePythPrice("263012500000", -8);
  assert.equal(ethPrice, 2630.125);

  // SOL at $113.40 with -5 expo
  const solPrice = PythHermesService.parsePythPrice("11340000", -5);
  assert.equal(solPrice, 113.4);

  // Invalid strings return 0 safely
  assert.equal(PythHermesService.parsePythPrice("invalid", -8), 0);
});

test("PythHermesService - Feed IDs are verified 32-byte hex strings", () => {
  assert.ok(PYTH_FEED_IDS.BTC.startsWith("0x"));
  assert.equal(PYTH_FEED_IDS.BTC.length, 66); // 0x + 64 hex chars = 32 bytes

  assert.ok(PYTH_FEED_IDS.ETH.startsWith("0x"));
  assert.equal(PYTH_FEED_IDS.ETH.length, 66);

  assert.ok(PYTH_FEED_IDS.SOL.startsWith("0x"));
  assert.equal(PYTH_FEED_IDS.SOL.length, 66);
});
