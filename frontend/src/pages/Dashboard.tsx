import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  fetchHealth,
  fetchOhlcv,
  fetchSignal,
  fetchSignals,
  fetchUniverse,
  QUICK_SCAN_TICKERS,
} from "../api/client";
import { usePriceStream } from "../hooks/usePriceStream";
import { useSignalStream } from "../hooks/useSignalStream";
import Header from "../components/layout/Header";
import CandlestickChart from "../components/chart/CandlestickChart";
import TimeframeSwitcher from "../components/chart/TimeframeSwitcher";
import SignalCard from "../components/signals/SignalCard";
import IndicatorStrip from "../components/signals/IndicatorStrip";
import ScannerTable from "../components/signals/ScannerTable";
import PaperOrderForm from "../components/portfolio/PaperOrderForm";
import PaperCashPanel from "../components/portfolio/PaperCashPanel";
import PaperPortfolioTables from "../components/portfolio/PaperPortfolioTables";
import PortfolioPage from "./PortfolioPage";
import { fetchPortfolio } from "../api/client";
import type { PortfolioSummary } from "../types/portfolio";
import type {
  OhlcvBar,
  ScanSummary,
  SignalResult,
  Timeframe,
} from "../types/signals";

const DEFAULT_TICKER = "AAPL";

export default function Dashboard() {
  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [signals, setSignals] = useState<SignalResult[]>([]);
  const [activeSignal, setActiveSignal] = useState<SignalResult | null>(null);
  const [chartData, setChartData] = useState<OhlcvBar[]>([]);
  const [universeCount, setUniverseCount] = useState<number>();
  const [scanLoading, setScanLoading] = useState(false);
  const [fullScanPending, setFullScanPending] = useState(false);
  const [chartLoading, setChartLoading] = useState(true);
  const [signalLoading, setSignalLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"signals" | "portfolio">("signals");
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioRefresh, setPortfolioRefresh] = useState(0);

  const watchTickers = useMemo(
    () =>
      [ticker, ...signals.slice(0, 10).map((s) => s.ticker)].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
    [ticker, signals],
  );

  const { prices, status: priceWsStatus } = usePriceStream(watchTickers);

  const onScanComplete = useCallback((summary: ScanSummary) => {
    setSignals(summary.results);
    setScanLoading(false);
    setFullScanPending(false);
  }, []);

  const { status: signalWsStatus } = useSignalStream(onScanComplete);

  const wsStatus =
    priceWsStatus === "connected" || signalWsStatus === "connected"
      ? "connected"
      : priceWsStatus === "error" || signalWsStatus === "error"
        ? "error"
        : priceWsStatus;

  useEffect(() => {
    fetchPortfolio()
      .then((data) => {
        setPortfolio(data);
        setPortfolioError(null);
      })
      .catch((e) => {
        setPortfolioError(
          e instanceof Error ? e.message : "โหลดพอร์ตจำลองไม่สำเร็จ — รัน start.bat ใหม่",
        );
      });
  }, [portfolioRefresh]);

  const cashAvailable = portfolio?.cash ?? 100_000;

  const refreshPortfolio = () => setPortfolioRefresh((k) => k + 1);

  const handlePortfolioUpdate = (data: PortfolioSummary) => {
    setPortfolio(data);
    setPortfolioError(null);
  };

  const livePrice = prices[ticker]?.price ?? null;

  const loadScan = useCallback(async (options?: { force?: boolean; full?: boolean }) => {
    const force = options?.force ?? false;
    const full = options?.full ?? false;
    try {
      setScanLoading(true);
      if (full) setFullScanPending(true);
      const summary = await fetchSignals(
        full ? { forceRefresh: force } : { forceRefresh: force, tickers: QUICK_SCAN_TICKERS },
      );
      setSignals(summary.results);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load signals");
    } finally {
      setScanLoading(false);
      if (!full) setFullScanPending(false);
    }
  }, []);

  const loadTicker = useCallback(async (symbol: string, tf: Timeframe) => {
    setChartLoading(true);
    setSignalLoading(true);

    try {
      const [ohlcv, signal] = await Promise.all([
        fetchOhlcv(symbol, tf),
        fetchSignal(symbol),
      ]);
      setChartData(ohlcv.data);
      setActiveSignal(signal);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ticker data");
      setChartData([]);
      setActiveSignal(null);
    } finally {
      setChartLoading(false);
      setSignalLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));

    fetchUniverse()
      .then((u) => setUniverseCount(u.count))
      .catch(() => undefined);

    loadScan({ full: false });
  }, [loadScan]);

  useEffect(() => {
    loadTicker(ticker, timeframe);
  }, [ticker, timeframe, loadTicker]);

  useEffect(() => {
    if (livePrice == null) return;
    setActiveSignal((prev) =>
      prev && prev.ticker === ticker ? { ...prev, price: livePrice } : prev,
    );
  }, [livePrice, ticker]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadScan({ force: true, full: true });
    await loadTicker(ticker, timeframe);
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-obsidian">
      <Header
        ticker={ticker}
        onTickerChange={setTicker}
        onRefresh={handleRefresh}
        refreshing={refreshing || fullScanPending}
        wsStatus={wsStatus}
        universeCount={universeCount}
        view={view}
        onViewChange={setView}
        portfolio={portfolio}
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 space-y-6">
        {backendOk === false && (
          <div className="rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson">
            Backend ไม่ตอบสนอง — รันคำสั่งนี้ใน terminal แยก:
            <code className="block mt-2 text-xs font-mono text-silver">
              cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8003 --reload
            </code>
          </div>
        )}

        {import.meta.env.DEV && backendOk && (
          <div className="rounded-lg border border-electric/30 bg-electric/5 px-4 py-3 text-xs text-silver">
            <strong className="text-electric">ใช้จากเครื่องอื่นได้:</strong>{" "}
            ดับเบิลคลิก <code className="font-mono">deploy-local.bat</code> (WiFi เดียวกัน) หรือ deploy บน Render ตาม{" "}
            <code className="font-mono">DEPLOY.md</code>
          </div>
        )}

        {portfolioError && view === "signals" && (
          <div className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
            Paper Trading ไม่พร้อม: {portfolioError}
            <span className="block mt-1 text-xs opacity-90">
              ปิด backend เก่าแล้วดับเบิลคลิก <code className="font-mono">start.bat</code> (port 8003)
            </span>
          </div>
        )}

        {error && view === "signals" && (
          <div className="rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson">
            {error}
          </div>
        )}

        {view === "portfolio" ? (
          <PortfolioPage
            key={portfolioRefresh}
            onSelectTicker={(t) => {
              setTicker(t);
              setView("signals");
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
              <div className="space-y-4 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-mono text-xl font-bold">{ticker}</h2>
                    {activeSignal && (
                      <p className="text-sm text-muted">
                        <span className={livePrice != null ? "text-neon font-mono" : "font-mono"}>
                          ${(livePrice ?? activeSignal.price).toFixed(2)}
                        </span>
                        {livePrice != null && (
                          <span className="ml-2 text-xs text-neon">● LIVE</span>
                        )}
                        {" · "}
                        EMA20 ${activeSignal.ema20.toFixed(2)} · SMA50 ${activeSignal.sma50.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <TimeframeSwitcher value={timeframe} onChange={setTimeframe} />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${ticker}-${timeframe}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CandlestickChart
                      data={chartData}
                      timeframe={timeframe}
                      loading={chartLoading}
                      livePrice={timeframe === "1D" ? livePrice : null}
                    />
                  </motion.div>
                </AnimatePresence>

                {activeSignal && !signalLoading && (
                  <IndicatorStrip signal={activeSignal} />
                )}

                {portfolio && (
                  <PaperPortfolioTables
                    portfolio={portfolio}
                    onRefresh={refreshPortfolio}
                    onSelectTicker={setTicker}
                  />
                )}

                {!portfolio && !portfolioError && (
                  <div className="rounded-xl border border-graphite bg-charcoal p-8 text-center text-muted animate-pulse">
                    กำลังโหลดพอร์ตจำลอง...
                  </div>
                )}
              </div>

              <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
                <PaperCashPanel
                  cashAvailable={cashAvailable}
                  onSuccess={handlePortfolioUpdate}
                  disabled={!!portfolioError}
                />
                <PaperOrderForm
                  key={ticker}
                  ticker={ticker}
                  livePrice={livePrice}
                  referencePrice={activeSignal?.price ?? null}
                  cashAvailable={cashAvailable}
                  positions={portfolio?.positions ?? []}
                  onSuccess={handlePortfolioUpdate}
                  disabled={!!portfolioError}
                />
                <SignalCard signal={activeSignal} loading={signalLoading} />
              </div>
            </div>

            {scanLoading ? (
              <div className="rounded-xl border border-graphite bg-charcoal p-8 text-center text-muted animate-pulse">
                {fullScanPending
                  ? "Scanning S&P 500... อาจใช้เวลา 5–10 นาที"
                  : "Scanning 23 หุ้นหลัก..."}
              </div>
            ) : (
              <ScannerTable
                signals={signals}
                selectedTicker={ticker}
                onSelect={setTicker}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
