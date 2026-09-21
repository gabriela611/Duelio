import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, type WalletClient } from "viem";
import { monadTestnet } from "@/infrastructure/web3/monadChain";

export function useDuelWalletClient() {
  const { wallets } = useWallets();

  const getClient = async (): Promise<WalletClient | null> => {
    if (!wallets || wallets.length === 0) return null;
    const wallet = wallets[0];
    try {
      const provider = await wallet.getEthereumProvider();
      return createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: monadTestnet,
        transport: custom(provider),
      });
    } catch (err) {
      console.error("Failed to acquire ethereum provider from wallet:", err);
      return null;
    }
  };

  return { getClient, wallet: wallets?.[0] };
}
