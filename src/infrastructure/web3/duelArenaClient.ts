import {
  createPublicClient,
  http,
  parseEther,
  formatEther,
  type Address,
  type Hex,
  type WalletClient,
  type PublicClient,
} from "viem";
import { DUEL_ARENA_ABI } from "./duelArenaAbi";
import {
  DUEL_ARENA_CONTRACT_ADDRESS,
  monadTestnet,
} from "./monadChain";

export type OnChainDuelState =
  | "CREATED"
  | "JOINED"
  | "ACTIVE"
  | "COMMITTED"
  | "SETTLED"
  | "CANCELLED";

export const STATE_ENUM_MAP: Record<number, OnChainDuelState> = {
  0: "CREATED",
  1: "JOINED",
  2: "ACTIVE",
  3: "COMMITTED",
  4: "SETTLED",
  5: "CANCELLED",
};

export interface OnChainDuel {
  id: bigint;
  playerA: Address;
  playerB: Address;
  entryStake: bigint;
  entryStakeMon: string;
  duration: bigint;
  startTime: bigint;
  endTime: bigint;
  rulesHash: Hex;
  finalStateHash: Hex;
  winner: Address;
  state: OnChainDuelState;
  totalPredictionPoolA: bigint;
  totalPredictionPoolB: bigint;
  traderRewardsClaimed: boolean;
  playerAClaimed: boolean;
  playerBClaimed: boolean;
}

export function getPublicDuelClient(): PublicClient {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(),
  });
}

/**
 * Fetches single duel details from DuelArena contract
 */
export async function fetchDuelDetails(
  duelId: bigint,
  client?: PublicClient
): Promise<OnChainDuel | null> {
  const publicClient = client || getPublicDuelClient();
  const address = DUEL_ARENA_CONTRACT_ADDRESS as Address;

  try {
    const raw = await publicClient.readContract({
      address,
      abi: DUEL_ARENA_ABI,
      functionName: "duels",
      args: [duelId],
    });

    const [
      id,
      playerA,
      playerB,
      entryStake,
      duration,
      startTime,
      endTime,
      rulesHash,
      finalStateHash,
      winner,
      stateNum,
      totalPredictionPoolA,
      totalPredictionPoolB,
      traderRewardsClaimed,
      playerAClaimed,
      playerBClaimed,
    ] = raw;

    if (id === 0n && playerA === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    return {
      id,
      playerA,
      playerB,
      entryStake,
      entryStakeMon: formatEther(entryStake),
      duration,
      startTime,
      endTime,
      rulesHash,
      finalStateHash,
      winner,
      state: STATE_ENUM_MAP[Number(stateNum)] || "CREATED",
      totalPredictionPoolA,
      totalPredictionPoolB,
      traderRewardsClaimed,
      playerAClaimed,
      playerBClaimed,
    };
  } catch (err) {
    console.error(`Failed to fetch duel ${duelId}:`, err);
    return null;
  }
}

/**
 * Fetches recent open duels waiting for an opponent (state == CREATED)
 */
export async function fetchOpenDuels(
  client?: PublicClient,
  limit: number = 10
): Promise<OnChainDuel[]> {
  const publicClient = client || getPublicDuelClient();
  const address = DUEL_ARENA_CONTRACT_ADDRESS as Address;

  try {
    const counter = await publicClient.readContract({
      address,
      abi: DUEL_ARENA_ABI,
      functionName: "duelCounter",
    });

    const openDuels: OnChainDuel[] = [];
    const max = Number(counter);
    const min = Math.max(1, max - limit + 1);

    for (let i = max; i >= min; i--) {
      const duel = await fetchDuelDetails(BigInt(i), publicClient);
      if (duel && duel.state === "CREATED") {
        openDuels.push(duel);
      }
    }

    return openDuels;
  } catch (err) {
    console.error("Failed to fetch open duels:", err);
    return [];
  }
}

/**
 * Creates a new PvP duel on-chain with MON stake escrow
 */
export async function createDuelOnChain(
  walletClient: WalletClient,
  account: Address,
  durationSeconds: number,
  rulesHash: Hex,
  stakeMon: string
): Promise<{ txHash: Hex; duelId?: bigint }> {
  const address = DUEL_ARENA_CONTRACT_ADDRESS as Address;
  const publicClient = getPublicDuelClient();

  const txHash = await walletClient.writeContract({
    account,
    address,
    abi: DUEL_ARENA_ABI,
    functionName: "createDuel",
    args: [BigInt(durationSeconds), rulesHash],
    value: parseEther(stakeMon),
    chain: monadTestnet,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Read counter after creation
  const counter = await publicClient.readContract({
    address,
    abi: DUEL_ARENA_ABI,
    functionName: "duelCounter",
  });

  return { txHash, duelId: counter };
}

/**
 * Joins an existing duel matching the required stake
 */
export async function joinDuelOnChain(
  walletClient: WalletClient,
  account: Address,
  duelId: bigint,
  stakeMon: string
): Promise<Hex> {
  const address = DUEL_ARENA_CONTRACT_ADDRESS as Address;

  return walletClient.writeContract({
    account,
    address,
    abi: DUEL_ARENA_ABI,
    functionName: "joinDuel",
    args: [duelId],
    value: parseEther(stakeMon),
    chain: monadTestnet,
  });
}

/**
 * Starts the match timer once both players have deposited
 */
export async function startDuelOnChain(
  walletClient: WalletClient,
  account: Address,
  duelId: bigint
): Promise<Hex> {
  const address = DUEL_ARENA_CONTRACT_ADDRESS as Address;

  return walletClient.writeContract({
    account,
    address,
    abi: DUEL_ARENA_ABI,
    functionName: "startDuel",
    args: [duelId],
    chain: monadTestnet,
  });
}

/**
 * Commits the cryptographically verified outcome using EIP-712 evidence
 */
export async function commitOutcomeOnChain(
  walletClient: WalletClient,
  account: Address,
  params: {
    duelId: bigint;
    winner: Address;
    stateHash: Hex;
    priceStart: bigint;
    priceEnd: bigint;
    deadline: bigint;
    sigA: Hex;
    sigB: Hex;
  }
): Promise<Hex> {
  const address = DUEL_ARENA_CONTRACT_ADDRESS as Address;

  return walletClient.writeContract({
    account,
    address,
    abi: DUEL_ARENA_ABI,
    functionName: "commitOutcome",
    args: [
      params.duelId,
      params.winner,
      params.stateHash,
      params.priceStart,
      params.priceEnd,
      params.deadline,
      params.sigA,
      params.sigB,
    ],
    chain: monadTestnet,
  });
}

/**
 * Settles and claims reward in a single transaction
 */
export async function settleAndClaimOnChain(
  walletClient: WalletClient,
  account: Address,
  duelId: bigint
): Promise<Hex> {
  const address = DUEL_ARENA_CONTRACT_ADDRESS as Address;

  return walletClient.writeContract({
    account,
    address,
    abi: DUEL_ARENA_ABI,
    functionName: "settleAndClaim",
    args: [duelId],
    chain: monadTestnet,
  });
}
