export interface PriceUpdate {
  ticker: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  updated_at: string;
}

export type WsStatus = "connecting" | "connected" | "disconnected" | "error";

/** Dev: connect directly to FastAPI (skip Vite ws proxy — avoids ECONNABORTED on Windows) */
function wsBase(): string {
  const envWs = import.meta.env.VITE_WS_BASE_URL;
  if (envWs) return envWs.replace(/\/$/, "");

  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) return envBase.replace(/^http/i, "ws").replace(/\/$/, "");

  if (import.meta.env.DEV) {
    const port = import.meta.env.VITE_BACKEND_PORT || "8003";
    return `ws://127.0.0.1:${port}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

export function priceWsUrl(): string {
  return `${wsBase()}/ws/prices`;
}

export function signalWsUrl(): string {
  return `${wsBase()}/ws/signals`;
}
