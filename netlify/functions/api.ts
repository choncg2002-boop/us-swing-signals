import type { Handler, HandlerEvent } from "@netlify/functions";
import { fetchChart, fetchQuote } from "./lib/yahoo.js";
import { analyzeSignal } from "./lib/signal.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

function getPathname(event: HandlerEvent): string {
  if (event.path.startsWith("/api/v1")) return event.path.split("?")[0]!;

  if (event.rawUrl) {
    try {
      const p = new URL(event.rawUrl).pathname;
      if (p.startsWith("/api/v1")) return p;
    } catch {
      /* fall through */
    }
  }

  const forwarded =
    event.headers["x-forwarded-uri"] ??
    event.headers["X-Forwarded-Uri"] ??
    event.headers["x-nf-request-url"];
  if (forwarded) {
    try {
      const p = forwarded.startsWith("http")
        ? new URL(forwarded).pathname
        : forwarded.split("?")[0]!;
      if (p.startsWith("/api/v1")) return p;
    } catch {
      /* fall through */
    }
  }

  return "/api/v1/health";
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const pathname = getPathname(event);

  try {
    if (pathname === "/api/v1/health") {
      return json(200, { status: "ok", service: "US Swing Signals (Netlify)" });
    }

    if (pathname === "/api/v1/universe") {
      const tickers = [
        "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "UNH",
        "XOM", "LLY", "AVGO", "MA", "HD", "PG", "COST", "JNJ", "ABBV", "CRM", "AMD", "NFLX", "ADBE",
      ];
      return json(200, { source: "quick", count: tickers.length, tickers });
    }

    const quoteMatch = pathname.match(/^\/api\/v1\/quote\/([A-Z.^-]+)$/i);
    if (quoteMatch) {
      const ticker = quoteMatch[1]!.toUpperCase();
      const price = await fetchQuote(ticker);
      return json(200, { ticker, price });
    }

    const ohlcvMatch = pathname.match(/^\/api\/v1\/ohlcv\/([A-Z.^-]+)$/i);
    if (ohlcvMatch) {
      const ticker = ohlcvMatch[1]!.toUpperCase();
      const tf = event.queryStringParameters?.tf ?? "1D";
      const data = await fetchChart(ticker, tf);
      return json(200, { ticker, timeframe: tf, data });
    }

    const signalMatch = pathname.match(/^\/api\/v1\/signals\/([A-Z.^-]+)$/i);
    if (signalMatch) {
      const ticker = signalMatch[1]!.toUpperCase();
      const bars = await fetchChart(ticker, "1D");
      return json(200, analyzeSignal(ticker, bars));
    }

    if (pathname === "/api/v1/signals") {
      const tickersParam = event.queryStringParameters?.tickers;
      const tickers = tickersParam
        ? tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
        : ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "UNH"];

      const start = Date.now();
      const results = await Promise.all(
        tickers.map(async (t) => {
          try {
            const bars = await fetchChart(t, "1D");
            return analyzeSignal(t, bars);
          } catch {
            return null;
          }
        }),
      );
      const filtered = results.filter(Boolean);
      const entryReady = filtered.filter((r) => r!.verdict === "ENTRY_READY").length;
      const wait = filtered.filter((r) => r!.verdict === "WAIT").length;
      const avoid = filtered.filter((r) => r!.verdict === "AVOID").length;

      return json(200, {
        total_scanned: tickers.length,
        signals_found: filtered.length,
        entry_ready_count: entryReady,
        wait_count: wait,
        avoid_count: avoid,
        results: filtered,
        scan_duration_sec: Math.round((Date.now() - start) / 100) / 10,
      });
    }

    return json(404, { detail: `Not found: ${pathname}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return json(500, { detail: msg });
  }
};
