import type {
  IndicatorsResponse,
  OhlcvResponse,
  ScanSummary,
  SignalResult,
  Timeframe,
} from "../types/signals";
import type {
  BuyOrderRequest,
  PortfolioSummary,
  SellOrderRequest,
} from "../types/portfolio";
import { isNetlifyOnlyMode } from "../utils/host";
import * as localPortfolio from "../lib/localPortfolio";

/** Dev: call FastAPI directly — avoids Vite proxy issues on Windows */
function apiBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  if (import.meta.env.DEV) {
    const port = import.meta.env.VITE_BACKEND_PORT || "8003";
    return `http://127.0.0.1:${port}`;
  }
  return "";
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const QUICK_SCAN_TICKERS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA",
  "JPM", "V", "UNH", "XOM", "LLY", "AVGO", "MA", "HD",
  "PG", "COST", "JNJ", "ABBV", "CRM", "AMD", "NFLX", "ADBE",
];

export function fetchHealth(): Promise<{ status: string }> {
  return fetchJson("/api/v1/health");
}

export function fetchSignals(options?: {
  forceRefresh?: boolean;
  tickers?: string[];
}): Promise<ScanSummary> {
  const params = new URLSearchParams();
  if (options?.forceRefresh) params.set("force_refresh", "true");
  if (options?.tickers?.length) params.set("tickers", options.tickers.join(","));
  const qs = params.toString();
  return fetchJson<ScanSummary>(`/api/v1/signals${qs ? `?${qs}` : ""}`);
}

export function fetchSignal(ticker: string): Promise<SignalResult> {
  return fetchJson<SignalResult>(`/api/v1/signals/${ticker}`);
}

export function fetchOhlcv(ticker: string, tf: Timeframe): Promise<OhlcvResponse> {
  return fetchJson<OhlcvResponse>(`/api/v1/ohlcv/${ticker}?tf=${tf}`);
}

export function fetchIndicators(ticker: string): Promise<IndicatorsResponse> {
  return fetchJson<IndicatorsResponse>(`/api/v1/indicators/${ticker}`);
}

export function fetchUniverse(): Promise<{ source: string; count: number; tickers: string[] }> {
  return fetchJson("/api/v1/universe");
}

export function fetchPortfolio(): Promise<PortfolioSummary> {
  if (isNetlifyOnlyMode()) return localPortfolio.getPortfolio();
  return fetchJson("/api/v1/portfolio");
}

export function submitBuyOrder(req: BuyOrderRequest): Promise<PortfolioSummary> {
  if (isNetlifyOnlyMode()) return localPortfolio.placeBuy(req);
  return fetchJsonPost("/api/v1/portfolio/orders/buy", req);
}

export function submitSellOrder(req: SellOrderRequest): Promise<PortfolioSummary> {
  if (isNetlifyOnlyMode()) return localPortfolio.placeSell(req);
  return fetchJsonPost("/api/v1/portfolio/orders/sell", req);
}

export function resetPortfolio(initialCash?: number): Promise<PortfolioSummary> {
  if (isNetlifyOnlyMode()) return localPortfolio.resetPortfolio(initialCash);
  const qs = initialCash != null ? `?initial_cash=${initialCash}` : "";
  return fetchJsonPost(`/api/v1/portfolio/reset${qs}`, {});
}

export function deletePosition(ticker: string): Promise<PortfolioSummary> {
  if (isNetlifyOnlyMode()) return localPortfolio.deletePosition(ticker);
  return fetchJsonDelete(`/api/v1/portfolio/positions/${encodeURIComponent(ticker)}`);
}

export function updatePosition(
  ticker: string,
  req: { shares: number; avg_cost: number },
): Promise<PortfolioSummary> {
  if (isNetlifyOnlyMode()) return localPortfolio.updatePosition(ticker, req.shares, req.avg_cost);
  return fetchJsonPatch(`/api/v1/portfolio/positions/${encodeURIComponent(ticker)}`, req);
}

export function depositCash(amount: number): Promise<PortfolioSummary> {
  if (isNetlifyOnlyMode()) return localPortfolio.depositCash(amount);
  return fetchJsonPost("/api/v1/portfolio/cash/deposit", { amount });
}

export function withdrawCash(amount: number): Promise<PortfolioSummary> {
  if (isNetlifyOnlyMode()) return localPortfolio.withdrawCash(amount);
  return fetchJsonPost("/api/v1/portfolio/cash/withdraw", { amount });
}

async function fetchJsonPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      detail = parsed.detail ?? detail;
    } catch {
      /* use raw */
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function fetchJsonDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { method: "DELETE" });
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      detail = parsed.detail ?? detail;
    } catch {
      /* use raw */
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function fetchJsonPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail) as { detail?: string };
      detail = parsed.detail ?? detail;
    } catch {
      /* use raw */
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
