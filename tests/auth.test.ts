import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractAuthToken,
  extractPrimaryWallet,
} from "../src/infrastructure/auth/privyServer.ts";
import type { User } from "@privy-io/server-auth";

test("extractAuthToken extracts Bearer tokens correctly", () => {
  const req1 = new Request("http://localhost/api/test", {
    headers: { Authorization: "Bearer test-token-123" },
  });
  assert.equal(extractAuthToken(req1), "test-token-123");

  const req2 = new Request("http://localhost/api/test", {
    headers: { authorization: "Bearer lowercase-header-token" },
  });
  assert.equal(extractAuthToken(req2), "lowercase-header-token");
});

test("extractAuthToken extracts from privy-token cookie if Bearer header is absent", () => {
  const req = new Request("http://localhost/api/test", {
    headers: { cookie: "other=123; privy-token=cookie-token-xyz; foo=bar" },
  });
  assert.equal(extractAuthToken(req), "cookie-token-xyz");
});

test("extractAuthToken returns null when token is missing or malformed", () => {
  const reqNoAuth = new Request("http://localhost/api/test");
  assert.equal(extractAuthToken(reqNoAuth), null);

  const reqBasic = new Request("http://localhost/api/test", {
    headers: { Authorization: "Basic user:pass" },
  });
  assert.equal(extractAuthToken(reqBasic), null);
});

test("extractPrimaryWallet normalizes and extracts wallet from user.wallet", () => {
  const mockUser: Partial<User> = {
    id: "did:privy:user123",
    wallet: {
      address: "0x836EF90000000000000000000000000000000001",
      chainType: "ethereum",
    } as any,
  };
  const wallet = extractPrimaryWallet(mockUser as User);
  assert.equal(wallet, "0x836ef90000000000000000000000000000000001");
});

test("extractPrimaryWallet extracts from linkedAccounts if user.wallet is missing", () => {
  const mockUser: Partial<User> = {
    id: "did:privy:user456",
    linkedAccounts: [
      { type: "email", address: "test@example.com" } as any,
      {
        type: "wallet",
        address: "0xABABA00000000000000000000000000000000002",
        chainType: "ethereum",
      } as any,
    ],
  };
  const wallet = extractPrimaryWallet(mockUser as User);
  assert.equal(wallet, "0xababa00000000000000000000000000000000002");
});

test("extractPrimaryWallet returns undefined if no ethereum wallet is linked", () => {
  const mockUser: Partial<User> = {
    id: "did:privy:user789",
    linkedAccounts: [
      { type: "email", address: "test@example.com" } as any,
      { type: "wallet", address: "SolanaAddress", chainType: "solana" } as any,
    ],
  };
  const wallet = extractPrimaryWallet(mockUser as User);
  assert.equal(wallet, undefined);
});
