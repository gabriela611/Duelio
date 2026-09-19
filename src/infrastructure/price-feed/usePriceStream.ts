"use client";

import { useState, useEffect, useRef } from "react";
import {
  PythHermesService,
  PYTH_FEED_IDS,
  type PythSupportedSymbol,
} from "./pythHermesService";

export type SupportedAsset = "MON" | "BTC" | "ETH" | "SOL";

export interface PricePoint {
  time: number;
  price: number;
}

export interface PriceStreamState {
  currentPrice: number;
  initialPrice: number;
  changePercent: number;
  history: PricePoint[];
  isLive: boolean;
  source: "pyth" | "coinbase" | "benchmark";
}

// Baseline prices for instant hydration
const BASELINE_PRICES: Record<SupportedAsset, number> = {
  BTC: 81250.0,
  ETH: 2630.5,
  SOL: 113.4,
  MON: 18.5,
};

const COINBASE_PAIRS: Record<string, string> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
};

export function usePriceStream(asset: SupportedAsset): PriceStreamState {
  const [currentPrice, setCurrentPrice] = useState<number>(BASELINE_PRICES[asset]);
  const [initialPrice, setInitialPrice] = useState<number>(BASELINE_PRICES[asset]);
  const [history, setHistory] = useState<PricePoint[]>(() => {
    const initial = BASELINE_PRICES[asset];
    const points: PricePoint[] = [];
    const now = Date.now();
    for (let i = 30; i >= 0; i--) {
      const variance = (Math.sin(i / 4) + (Math.random() - 0.5) * 0.4) * (initial * 0.003);
      points.push({
        time: now - i * 1000,
        price: Number((initial + variance).toFixed(asset === "BTC" ? 1 : 2)),
      });
    }
    return points;
  });
  const [isLive, setIsLive] = useState<boolean>(false);
  const [source, setSource] = useState<"pyth" | "coinbase" | "benchmark">("benchmark");

  const wsRef = useRef<WebSocket | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pythPollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const base = BASELINE_PRICES[asset];
    setInitialPrice(base);
    setCurrentPrice(base);

    // Re-seed history curve on asset switch
    const now = Date.now();
    const seeded: PricePoint[] = [];
    for (let i = 30; i >= 0; i--) {
      const variance = (Math.sin(i / 3) + (Math.random() - 0.5) * 0.3) * (base * 0.003);
      seeded.push({
        time: now - i * 1000,
        price: Number((base + variance).toFixed(asset === "BTC" ? 1 : 2)),
      });
    }
    setHistory(seeded);

    const updatePricePoint = (newPrice: number, newSource: "pyth" | "coinbase" | "benchmark") => {
      if (isCancelled) return;
      setCurrentPrice(newPrice);
      setIsLive(true);
      setSource(newSource);
      setHistory((prev) => {
        const next = [...prev, { time: Date.now(), price: newPrice }];
        if (next.length > 40) next.shift();
        return next;
      });
    };

    // Primary: Attempt Pyth Hermes for BTC, ETH, SOL
    if (asset in PYTH_FEED_IDS) {
      const pythSymbol = asset as PythSupportedSymbol;
      const feedId = PYTH_FEED_IDS[pythSymbol];

      const pollPyth = async () => {
        const res = await PythHermesService.fetchLatestPrices([feedId]);
        if (res && res.prices[pythSymbol]) {
          updatePricePoint(res.prices[pythSymbol], "pyth");
          return true;
        }
        return false;
      };

      // Immediate Pyth check
      pollPyth().then((pythSuccess) => {
        if (isCancelled) return;

        if (pythSuccess) {
          // Poll Pyth Hermes every 2.5 seconds
          pythPollRef.current = setInterval(pollPyth, 2500);
        } else {
          // Fallback to Coinbase Public WebSocket
          const pair = COINBASE_PAIRS[asset];
          if (pair) {
            try {
              const ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");
              wsRef.current = ws;

              ws.onopen = () => {
                if (isCancelled) return;
                ws.send(
                  JSON.stringify({
                    type: "subscribe",
                    product_ids: [pair],
                    channels: ["ticker"],
                  })
                );
              };

              ws.onmessage = (event) => {
                try {
                  const data = JSON.parse(event.data);
                  if (data.type === "ticker" && data.price) {
                    const parsed = parseFloat(data.price);
                    if (!isNaN(parsed)) {
                      updatePricePoint(parsed, "coinbase");
                    }
                  }
                } catch {
                  // Ignore
                }
              };

              ws.onerror = () => {
                if (!isCancelled) setIsLive(false);
              };
              ws.onclose = () => {
                if (!isCancelled) setIsLive(false);
              };
            } catch {
              // WS failed, will use benchmark simulation
            }
          }
        }
      });
    }

    // Benchmark ticker (used for MON, and as smooth fill between ticks)
    simIntervalRef.current = setInterval(() => {
      if (asset === "MON" || (!wsRef.current && !pythPollRef.current)) {
        setCurrentPrice((prev) => {
          const delta = (Math.random() - 0.49) * (prev * 0.0015);
          const next = Number((prev + delta).toFixed(asset === "BTC" ? 1 : 2));
          updatePricePoint(next, "benchmark");
          return next;
        });
      }
    }, 1200);

    return () => {
      isCancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      if (pythPollRef.current) {
        clearInterval(pythPollRef.current);
        pythPollRef.current = null;
      }
    };
  }, [asset]);

  const changePercent =
    initialPrice > 0
      ? Number((((currentPrice - initialPrice) / initialPrice) * 100).toFixed(2))
      : 0.0;

  return {
    currentPrice,
    initialPrice,
    changePercent,
    history,
    isLive,
    source,
  };
}
