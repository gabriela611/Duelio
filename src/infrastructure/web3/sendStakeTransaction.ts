import { createWalletClient, createPublicClient, custom, http, parseEther } from "viem";
import { monadTestnet, HOUSE_TREASURY_ADDRESS } from "./monadChain";
import type { ConnectedWallet } from "@privy-io/react-auth";

export interface SendStakeResult {
  txHash: string;
  blockNumber?: bigint;
}

/**
 * Sends a real on-chain stake transaction from the player to the House Treasury on Monad Testnet.
 * Universal implementation: works seamlessly with BOTH Privy embedded wallets and external wallets (MetaMask, Rabby, etc.)
 * by using the standard EIP-1193 provider.
 */
export async function sendStakeToHouse(
  wallet: ConnectedWallet,
  stakeMon: number
): Promise<SendStakeResult> {
  if (!wallet) {
    throw new Error("No connected wallet available");
  }

  // 1. Ensure the wallet is connected to Monad Testnet (10143)
  try {
    await wallet.switchChain(monadTestnet.id);
  } catch (err: unknown) {
    console.warn("Chain switch note:", err);
  }

  // 2. Get standard EIP-1193 Ethereum provider
  const provider = await wallet.getEthereumProvider();

  // 3. Create Viem wallet client bound to the player's account
  const walletClient = createWalletClient({
    account: wallet.address as `0x${string}`,
    chain: monadTestnet,
    transport: custom(provider),
  });

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http("https://testnet-rpc.monad.xyz"),
  });

  // 4. Dispatch the on-chain transfer to the House Treasury
  const hash = await walletClient.sendTransaction({
    to: HOUSE_TREASURY_ADDRESS,
    value: parseEther(stakeMon.toString()),
  });

  // 5. Wait for block confirmation on Monad
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "reverted") {
    throw new Error("Stake transaction reverted on Monad Testnet");
  }

  return {
    txHash: hash,
    blockNumber: receipt.blockNumber,
  };
}
