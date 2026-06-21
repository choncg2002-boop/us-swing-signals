import { type FormEvent } from "react";
import type { WsStatus } from "../../api/websocket";
import type { PortfolioSummary } from "../../types/portfolio";
import PortfolioSummaryBar from "../portfolio/PortfolioSummaryBar";

interface Props {
  ticker: string;
  onTickerChange: (ticker: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  wsStatus?: WsStatus;
  universeCount?: number;
  view?: "signals" | "portfolio";
  onViewChange?: (view: "signals" | "portfolio") => void;
  portfolio?: PortfolioSummary | null;
}

const STATUS_LABEL: Record<WsStatus, { text: string; color: string }> = {
  connected: { text: "Live", color: "text-neon" },
  connecting: { text: "Connecting", color: "text-amber" },
  disconnected: { text: "Offline", color: "text-muted" },
  error: { text: "Error", color: "text-crimson" },
};

export default function Header({
  ticker,
  onTickerChange,
  onRefresh,
  refreshing,
  wsStatus = "connecting",
  universeCount,
  view = "signals",
  onViewChange,
  portfolio,
}: Props) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = String(form.get("ticker") ?? "").trim().toUpperCase();
    if (value) onTickerChange(value);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-graphite bg-obsidian/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neon/10 border border-neon/30">
            <span className="text-neon font-bold text-sm">US</span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">US Technical Signals</h1>
            <p className="text-xs text-muted">เทรดเทคนิค ≤3 เดือน</p>
          </div>
          {onViewChange && (
            <div className="ml-2 inline-flex rounded-lg border border-graphite bg-slate p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => onViewChange("signals")}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  view === "signals" ? "bg-electric/20 text-electric border border-electric/40" : "text-muted"
                }`}
              >
                สัญญาณ
              </button>
              <button
                type="button"
                onClick={() => onViewChange("portfolio")}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  view === "portfolio" ? "bg-electric/20 text-electric border border-electric/40" : "text-muted"
                }`}
              >
                พอร์ต
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            name="ticker"
            defaultValue={ticker}
            placeholder="Search ticker..."
            className="w-36 rounded-lg border border-graphite bg-charcoal px-3 py-2 font-mono text-sm uppercase outline-none focus:border-electric/50 sm:w-44"
          />
          <button
            type="submit"
            className="rounded-lg bg-electric/10 border border-electric/30 px-4 py-2 text-sm font-medium text-electric hover:bg-electric/20 transition-colors"
          >
            Go
          </button>
        </form>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-lg border border-graphite bg-charcoal px-4 py-2 text-sm text-silver hover:border-neon/30 hover:text-neon transition-colors disabled:opacity-50"
        >
          {refreshing ? "Scanning..." : "Refresh Scan"}
        </button>

        <div className="hidden sm:flex items-center gap-3 text-xs">
          {universeCount != null && (
            <span className="text-muted">
              S&amp;P 500 · <span className="font-mono text-silver">{universeCount}</span>
            </span>
          )}
          <span className={`flex items-center gap-1.5 ${STATUS_LABEL[wsStatus].color}`}>
            <span
              className={`h-2 w-2 rounded-full ${
                wsStatus === "connected" ? "bg-neon animate-pulse" : "bg-current"
              }`}
            />
            {STATUS_LABEL[wsStatus].text}
          </span>
        </div>
      </div>
      <PortfolioSummaryBar
        portfolio={portfolio ?? null}
        onOpenPortfolio={() => onViewChange?.("portfolio")}
      />
    </header>
  );
}
