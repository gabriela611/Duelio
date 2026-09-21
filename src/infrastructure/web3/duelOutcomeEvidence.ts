import {
  hashTypedData,
  recoverAddress,
  type Address,
  type Hex,
} from "viem";

/**
 * EIP-712 Domain Separator definition for DuelArena contracts
 */
export const getDuelArenaDomain = (
  chainId: number,
  verifyingContract: Address
) => ({
  name: "DuelArena",
  version: "1",
  chainId: BigInt(chainId),
  verifyingContract,
});

/**
 * EIP-712 Typed Data schema for authoritative match outcome evidence
 */
export const OUTCOME_TYPES = {
  Outcome: [
    { name: "duelId", type: "uint256" },
    { name: "winner", type: "address" },
    { name: "stateHash", type: "bytes32" },
    { name: "priceStart", type: "uint256" },
    { name: "priceEnd", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export interface OutcomeMessage {
  duelId: bigint;
  winner: Address;
  stateHash: Hex;
  priceStart: bigint;
  priceEnd: bigint;
  deadline: bigint;
}

/**
 * Computes the 32-byte EIP-712 digest for a given duel outcome
 */
export function hashOutcomeEvidence(
  domain: ReturnType<typeof getDuelArenaDomain>,
  message: OutcomeMessage
): Hex {
  return hashTypedData({
    domain,
    types: OUTCOME_TYPES,
    primaryType: "Outcome",
    message,
  });
}

/**
 * Recovers the signing address from an EIP-712 signature and outcome message
 */
export async function recoverOutcomeSigner(
  domain: ReturnType<typeof getDuelArenaDomain>,
  message: OutcomeMessage,
  signature: Hex
): Promise<Address> {
  const digest = hashOutcomeEvidence(domain, message);
  return recoverAddress({
    hash: digest,
    signature,
  });
}
