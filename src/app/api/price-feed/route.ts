import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Server-side proxy for Pyth Hermes price feeds.
 * Keeps upstream API keys strictly server-side to avoid leaking credentials to client bundles.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.getAll("ids[]");

  const endpoint = (
    process.env.NEXT_PUBLIC_PYTH_HERMES_ENDPOINT ||
    "https://pyth.dourolabs.app/hermes"
  ).replace(/\/$/, "");

  // API Key is strictly server-side (supports PYTH_HERMES_API_KEY or fallback)
  const apiKey =
    process.env.PYTH_HERMES_API_KEY ||
    process.env.NEXT_PUBLIC_PYTH_HERMES_API_KEY;

  const queryParams =
    ids.length > 0
      ? ids.map((id) => `ids[]=${encodeURIComponent(id)}`).join("&")
      : "";
  const url = `${endpoint}/v2/updates/price/latest?${queryParams}&parsed=true`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey && apiKey.trim().length > 0) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream Pyth returned HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upstream error";
    return NextResponse.json(
      { error: "Failed to connect to Pyth Hermes", details: message },
      { status: 502 }
    );
  }
}
