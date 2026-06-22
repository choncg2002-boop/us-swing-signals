import { useCallback, useEffect, useRef, useState } from "react";
import { priceWsUrl, type PriceUpdate, type WsStatus } from "../api/websocket";
import { isNetlifyOnlyMode } from "../utils/host";

const RECONNECT_MS = 4000;
const POLL_MS = 60_000;

async function fetchQuotePrice(ticker: string): Promise<PriceUpdate | null> {
  try {
    const res = await fetch(`/api/v1/quote/${ticker}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { price: number };
    return {
      ticker,
      price: data.price,
      open: data.price,
      high: data.price,
      low: data.price,
      volume: 0,
      updated_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function usePriceStream(tickers: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [status, setStatus] = useState<WsStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const tickersRef = useRef(tickers);
  tickersRef.current = tickers;

  const subscribe = useCallback((ws: WebSocket, list: string[]) => {
    if (list.length > 0) {
      ws.send(JSON.stringify({ action: "subscribe", tickers: list }));
    }
  }, []);

  // Netlify: poll quotes instead of WebSocket
  useEffect(() => {
    if (!isNetlifyOnlyMode()) return;

    let alive = true;
    const poll = async () => {
      const list = tickersRef.current.filter(Boolean);
      if (!list.length) return;
      setStatus("connecting");
      const updates = await Promise.all(list.slice(0, 12).map(fetchQuotePrice));
      if (!alive) return;
      const next: Record<string, PriceUpdate> = {};
      for (const u of updates) {
        if (u) next[u.ticker] = u;
      }
      if (Object.keys(next).length) {
        setPrices((prev) => ({ ...prev, ...next }));
        setStatus("connected");
      } else {
        setStatus("error");
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (isNetlifyOnlyMode()) return;

    let alive = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      if (!alive) return;
      setStatus("connecting");

      const ws = new WebSocket(priceWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!alive) {
          ws.close();
          return;
        }
        setStatus("connected");
        subscribe(ws, tickersRef.current);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "price_update" && msg.data?.ticker) {
            const update = msg.data as PriceUpdate;
            setPrices((prev) => ({ ...prev, [update.ticker]: update }));
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        if (alive) setStatus("error");
      };

      ws.onclose = () => {
        if (!alive) return;
        setStatus("disconnected");
        retryTimer = setTimeout(connect, RECONNECT_MS);
      };

      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: "ping" }));
        }
      }, 30000);
    };

    connect();

    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [subscribe]);

  const tickersKey = tickers.join(",");
  useEffect(() => {
    if (isNetlifyOnlyMode()) return;
    const ws = wsRef.current;
    const list = tickersKey ? tickersKey.split(",").filter(Boolean) : [];
    if (ws?.readyState === WebSocket.OPEN && list.length > 0) {
      subscribe(ws, list);
    }
  }, [tickersKey, subscribe]);

  return { prices, status };
}
