/**
 * Pyth Network Hermes Price Feed Service
 *
 * Official real-time low-latency oracle price delivery service.
 * Supports Pyth Hermes v2 endpoints with Bearer authentication and binary VAAs.
 */

export const PYTH_FEED_IDS = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
} as const;

export type PythSupportedSymbol = keyof typeof PYTH_FEED_IDS;

export interface PythPriceData {
  price: string;
  conf: string;
  expo: number;
  publish_time: number;
}

export interface PythParsedPriceFeed {
  id: string;
  price: PythPriceData;
  ema_price: PythPriceData;
}

export interface PythLatestResponse {
  binary?: {
    data: string[];
  };
  parsed?: PythParsedPriceFeed[];
}

export class PythHermesService {
  private static defaultEndpoint = "https://pyth.dourolabs.app/hermes";

  private static getEndpoint(): string {
    return (
      process.env.NEXT_PUBLIC_PYTH_HERMES_ENDPOINT ||
      this.defaultEndpoint
    ).replace(/\/$/, "");
  }

  private static getApiKey(): string | undefined {
    const key =
      process.env.PYTH_HERMES_API_KEY ||
      process.env.NEXT_PUBLIC_PYTH_HERMES_API_KEY;
    return key && key.trim().length > 0 ? key.trim() : undefined;
  }

  /**
   * Converts a Pyth integer price and negative exponent to a human-readable number.
   * e.g., price="8125012345678", expo=-8 => 81250.12345678
   */
  public static parsePythPrice(priceStr: string, expo: number): number {
    const raw = Number(priceStr);
    if (isNaN(raw)) return 0;
    return raw * Math.pow(10, expo);
  }

  /**
   * Fetches latest parsed price updates from Pyth Hermes.
   * In browser environments, routes through /api/price-feed to avoid leaking API credentials.
   */
  public static async fetchLatestPrices(
    feedIds: string[] = Object.values(PYTH_FEED_IDS)
  ): Promise<{
    prices: Record<string, number>;
    binaryData?: string[];
  } | null> {
    const isBrowser = typeof window !== "undefined";
    const queryParams = feedIds.map((id) => `ids[]=${encodeURIComponent(id)}`).join("&");

    const url = isBrowser
      ? `/api/price-feed?${queryParams}`
      : `${this.getEndpoint()}/v2/updates/price/latest?${queryParams}&parsed=true`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (!isBrowser) {
      const apiKey = this.getApiKey();
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    try {
      const res = await fetch(url, {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        // Fallback gracefully if unauthorized or endpoint rate-limited
        return null;
      }

      const data: PythLatestResponse = await res.json();
      const prices: Record<string, number> = {};

      if (data.parsed && Array.isArray(data.parsed)) {
        for (const item of data.parsed) {
          const normalizedId = item.id.startsWith("0x") ? item.id : `0x${item.id}`;
          const parsedVal = this.parsePythPrice(item.price.price, item.price.expo);

          for (const [sym, fId] of Object.entries(PYTH_FEED_IDS)) {
            if (fId.toLowerCase() === normalizedId.toLowerCase()) {
              prices[sym] = Number(parsedVal.toFixed(sym === "BTC" ? 2 : 3));
            }
          }
        }
      }

      return {
        prices,
        binaryData: data.binary?.data,
      };
    } catch {
      return null;
    }
  }

  /**
   * Helper to subscribe via EventSource SSE if available and configured
   */
  public static createPriceStream(
    feedIds: string[] = Object.values(PYTH_FEED_IDS),
    onPrice: (prices: Record<string, number>) => void
  ): { close: () => void } {
    const endpoint = this.getEndpoint();
    const apiKey = this.getApiKey();
    const queryParams = feedIds.map((id) => `ids[]=${id}`).join("&");
    const url = `${endpoint}/v2/updates/price/stream?${queryParams}&parsed=true`;

    // If no browser EventSource or no API key, allow caller to fallback
    if (typeof window === "undefined" || !window.EventSource) {
      return { close: () => {} };
    }

    try {
      // Note: Standard browser EventSource does not support custom headers.
      // If an API key is required, Hermes supports SSE with key in query param or tokenized session.
      const sseUrl = apiKey ? `${url}&token=${encodeURIComponent(apiKey)}` : url;
      const eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data: PythLatestResponse = JSON.parse(event.data);
          if (data.parsed) {
            const prices: Record<string, number> = {};
            for (const item of data.parsed) {
              const normalizedId = item.id.startsWith("0x") ? item.id : `0x${item.id}`;
              const parsedVal = this.parsePythPrice(item.price.price, item.price.expo);

              for (const [sym, fId] of Object.entries(PYTH_FEED_IDS)) {
                if (fId.toLowerCase() === normalizedId.toLowerCase()) {
                  prices[sym] = Number(parsedVal.toFixed(sym === "BTC" ? 2 : 3));
                }
              }
            }
            onPrice(prices);
          }
        } catch {
          // Ignore SSE parsing errors
        }
      };

      return {
        close: () => {
          eventSource.close();
        },
      };
    } catch {
      return { close: () => {} };
    }
  }
}
