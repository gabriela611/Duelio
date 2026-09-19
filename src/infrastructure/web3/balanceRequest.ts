export type BalanceState = {
  address?: string;
  status: "disconnected" | "loading" | "ready" | "error";
  value?: bigint;
};

/** Cancellation prevents old wallet requests from publishing into the current account. */
export function requestBalance(
  address: string,
  read: (address: string) => Promise<bigint>,
  publish: (state: BalanceState) => void,
): () => void {
  let cancelled = false;
  publish({ address, status: "loading" });
  Promise.resolve().then(() => read(address)).then(
    (value) => { if (!cancelled) publish({ address, status: "ready", value }); },
    (error) => {
      console.error("[useNativeBalance] Failed to fetch balance for", address, error);
      if (!cancelled) publish({ address, status: "error" });
    },
  );
  return () => { cancelled = true; };
}

export function balanceForAccount(state: BalanceState, address?: string): BalanceState {
  if (!address) return { status: "disconnected" };
  return state.address === address ? state : { address, status: "loading" };
}
