export type PriceSource = "pyth" | "coinbase" | "benchmark";

export function isLivePriceSource(source: PriceSource): boolean {
  return source === "pyth" || source === "coinbase";
}

export function getPriceSourceLabel(source: PriceSource): string {
  if (source === "pyth") return "Pyth Hermes Oracle";
  if (source === "coinbase") return "Coinbase live stream";
  return "Simulated benchmark";
}
