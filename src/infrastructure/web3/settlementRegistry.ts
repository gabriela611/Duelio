import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  isAddress,
  isHash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  monadTestnet,
  HOUSE_TREASURY_ADDRESS,
} from "./monadChain.ts";

export interface SettleRequest {
  userAddress: string;
  outcome: "WIN" | "LOSS" | "DRAW";
  entryTxHash: string;
}

export interface SettleRecord {
  entryTxHash: string;
  userAddress: string;
  outcome: "WIN" | "LOSS" | "DRAW";
  stakedWei: string;
  payoutWei: string;
  payoutTxHash?: string;
  timestamp: number;
}

const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const SETTLED_FILE = path.join(CACHE_DIR, "settled-clashes.json");

// In-memory set for zero-latency lookup and replay prevention
const settledHashes = new Set<string>();
const inFlightHashes = new Set<string>();

// Initialize settled hashes from disk persistence
function loadPersistedHashes() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (fs.existsSync(SETTLED_FILE)) {
      const data = fs.readFileSync(SETTLED_FILE, "utf-8");
      const records: SettleRecord[] = JSON.parse(data);
      for (const rec of records) {
        if (rec.entryTxHash) {
          settledHashes.add(rec.entryTxHash.toLowerCase());
        }
      }
    }
  } catch (err) {
    console.warn("Could not load persisted settled clashes:", err);
  }
}

loadPersistedHashes();

function persistRecord(record: SettleRecord) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    let records: SettleRecord[] = [];
    if (fs.existsSync(SETTLED_FILE)) {
      try {
        records = JSON.parse(fs.readFileSync(SETTLED_FILE, "utf-8"));
      } catch {
        records = [];
      }
    }
    records.push(record);
    fs.writeFileSync(SETTLED_FILE, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist settlement record:", err);
  }
}

export class SettlementVerificationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "SettlementVerificationError";
    this.statusCode = statusCode;
  }
}

/**
 * Validates the on-chain stake transaction and executes payouts with Zero-Trust principles.
 * 1. Validates hex formats for address and transaction hash.
 * 2. Replay attack prevention: checks both in-flight locks and historical records.
 * 3. On-chain validation: verifies tx recipient is House Treasury and sender is user.
 * 4. Server-enforced payout math: ignores client-requested numbers and strictly calculates from verified staked wei.
 */
export async function verifyAndExecuteSettlement(req: SettleRequest) {
  const { userAddress, outcome, entryTxHash } = req;

  // 1. Basic format validation
  if (!userAddress || !isAddress(userAddress)) {
    throw new SettlementVerificationError("Invalid or missing user address", 400);
  }
  if (!entryTxHash || !isHash(entryTxHash)) {
    throw new SettlementVerificationError("Invalid or missing entryTxHash", 400);
  }
  if (!["WIN", "LOSS", "DRAW"].includes(outcome)) {
    throw new SettlementVerificationError("Invalid outcome value", 400);
  }

  const normalizedHash = entryTxHash.toLowerCase();

  // 2. Replay & race condition protection
  if (settledHashes.has(normalizedHash)) {
    throw new SettlementVerificationError(
      "Replay detected: this entry transaction has already been settled",
      409
    );
  }
  if (inFlightHashes.has(normalizedHash)) {
    throw new SettlementVerificationError(
      "Settlement is currently in progress for this transaction",
      429
    );
  }

  // Acquire in-flight lock
  inFlightHashes.add(normalizedHash);

  try {
    // 3. Query on-chain Monad Testnet state
    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });

    let tx;
    let receipt;
    try {
      [tx, receipt] = await Promise.all([
        publicClient.getTransaction({ hash: entryTxHash as `0x${string}` }),
        publicClient.getTransactionReceipt({ hash: entryTxHash as `0x${string}` }),
      ]);
    } catch {
      throw new SettlementVerificationError(
        "Entry transaction not found on Monad Testnet",
        404
      );
    }

    if (!tx || !receipt) {
      throw new SettlementVerificationError(
        "Entry transaction not found on Monad Testnet",
        404
      );
    }

    if (receipt.status !== "success") {
      throw new SettlementVerificationError(
        "Entry transaction failed on-chain and cannot be settled",
        400
      );
    }

    // Verify recipient is House Treasury
    if (tx.to?.toLowerCase() !== HOUSE_TREASURY_ADDRESS.toLowerCase()) {
      throw new SettlementVerificationError(
        `Invalid stake destination: funds must be sent to House Treasury (${HOUSE_TREASURY_ADDRESS})`,
        400
      );
    }

    // Verify sender matches claimed address
    if (tx.from.toLowerCase() !== userAddress.toLowerCase()) {
      throw new SettlementVerificationError(
        "Sender mismatch: entry transaction sender does not match user address",
        403
      );
    }

    // Verify staked value
    const stakedWei = tx.value;
    if (stakedWei <= 0n) {
      throw new SettlementVerificationError(
        "Entry transaction has zero native MON value",
        400
      );
    }

    // 4. Calculate server-enforced payout
    // - WIN: 1.96x stake (2% protocol fee retained by House)
    // - DRAW: 1.0x stake (100% refund)
    // - LOSS: 0 MON (stake retained)
    let payoutWei = 0n;
    if (outcome === "WIN") {
      payoutWei = (stakedWei * 196n) / 100n;
    } else if (outcome === "DRAW") {
      payoutWei = stakedWei;
    }

    let payoutTxHash: string | undefined;

    // 5. On WIN or DRAW, execute on-chain transfer from House Treasury
    if (payoutWei > 0n) {
      const houseKey = process.env.HOUSE_TREASURY_PRIVATE_KEY;
      if (!houseKey) {
        throw new SettlementVerificationError(
          "House Treasury private key not configured on server",
          500
        );
      }

      const account = privateKeyToAccount(houseKey as `0x${string}`);
      const houseBalance = await publicClient.getBalance({ address: account.address });

      if (houseBalance < payoutWei) {
        throw new SettlementVerificationError(
          "House Treasury has insufficient balance for payout",
          503
        );
      }

      const walletClient = createWalletClient({
        account,
        chain: monadTestnet,
        transport: http(),
      });

      payoutTxHash = await walletClient.sendTransaction({
        to: userAddress as `0x${string}`,
        value: payoutWei,
      });
    }

    // 6. Record successful settlement
    settledHashes.add(normalizedHash);
    const record: SettleRecord = {
      entryTxHash: normalizedHash,
      userAddress: userAddress.toLowerCase(),
      outcome,
      stakedWei: stakedWei.toString(),
      payoutWei: payoutWei.toString(),
      payoutTxHash,
      timestamp: Date.now(),
    };
    persistRecord(record);

    return {
      success: true,
      outcome,
      stakedMon: formatEther(stakedWei),
      payoutMon: formatEther(payoutWei),
      payoutTxHash,
      entryTxHash,
      houseAddress: HOUSE_TREASURY_ADDRESS,
    };
  } finally {
    // Release in-flight lock
    inFlightHashes.delete(normalizedHash);
  }
}
