"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "@/infrastructure/web3/monadChain";
import { balanceForAccount, requestBalance, type BalanceState } from "@/infrastructure/web3/balanceRequest";
import { normalizeAddress } from "@/domain/social/identity";

const client = createPublicClient({
  chain: monadTestnet,
  transport: http(monadTestnet.rpcUrls.default.http[0], {
    timeout: 10_000,
    retryCount: 2,
  }),
});

export function useNativeBalance(walletAddress?: string) {
  const address = normalizeAddress(walletAddress);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<BalanceState>({ status: "disconnected" });

  useEffect(() => {
    if (!address) {
      setState({ status: "disconnected" });
      return;
    }

    const cancel = requestBalance(
      address,
      (account) => client.getBalance({ address: account as `0x${string}` }),
      setState,
    );

    // Auto-refresh on a 10s cadence so faucet drops and transactions reflect live
    const interval = setInterval(() => {
      requestBalance(
        address,
        (account) => client.getBalance({ address: account as `0x${string}` }),
        setState,
      );
    }, 10_000);

    const onFocus = () => {
      requestBalance(
        address,
        (account) => client.getBalance({ address: account as `0x${string}` }),
        setState,
      );
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancel();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [address, revision]);

  // Never expose the previous account's balance, even before the effect runs.
  const current = balanceForAccount(state, address);
  return { ...current, refresh: () => setRevision((value) => value + 1) };
}
