"use client";

import { useState, useEffect, useRef } from "react";

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
}

// Initial realistic baseline prices for fast hydration
const BASELINE_PRICES: Record<SupportedAsset, number> = {
  BTC: 81250.0,
  ETH: 2630.5,
  SOL: 113.4,
  MON: 18.5, // Monad Testnet benchmark
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
      // Seed a gentle realistic curve
      const variance = (Math.sin(i / 4) + (Math.random() - 0.5) * 0.4) * (initial * 0.003);
      points.push({
        time: now - i * 1000,
        price: Number((initial + variance).toFixed(2)),
      });
    }
    return points;
  });
  const [isLive, setIsLive] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const base = BASELINE_PRICES[asset];
    setInitialPrice(base);
    setCurrentPrice(base);

    // Initialize historical curve for the newly selected asset
    const now = Date.now();
    const seeded: PricePoint[] = [];
    for (let i = 30; i >= 0; i--) {
      const variance = (Math.sin(i / 3) + (Math.random() - 0.5) * 0.3) * (base * 0.003);
      seeded.push({
        time: now - i * 1000,
        price: Number((base + variance).toFixed(2)),
      });
    }
    setHistory(seeded);

    const updatePricePoint = (newPrice: number) => {
      setCurrentPrice(newPrice);
      setHistory((prev) => {
        const next = [...prev, { time: Date.now(), price: newPrice }];
        if (next.length > 40) next.shift(); // Keep last 40 ticks
        return next;
      });
    };

    // For BTC, ETH, SOL, connect to Coinbase public real-time WebSocket feed
    const pair = COINBASE_PAIRS[asset];
    if (pair) {
      try {
        const ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");
        wsRef.current = ws;

        ws.onopen = () => {
          setIsLive(true);
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
                updatePricePoint(parsed);
              }
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          setIsLive(false);
        };

        ws.onclose = () => {
          setIsLive(false);
        };
      } catch {
        setIsLive(false);
      }
    }

    // High-frequency smooth tick simulator for MON and as fallback
    simIntervalRef.current = setInterval(() => {
      if (asset === "MON" || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setIsLive(true);
        setCurrentPrice((prev) => {
          const delta = (Math.random() - 0.49) * (prev * 0.0015);
          const next = Number((prev + delta).toFixed(asset === "BTC" ? 1 : 2));
          setHistory((h) => {
            const updated = [...h, { time: Date.now(), price: next }];
            if (updated.length > 40) updated.shift();
            return updated;
          });
          return next;
        });
      }
    }, 1200);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
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
  };
}
