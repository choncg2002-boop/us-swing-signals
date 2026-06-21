import { useCallback, useEffect, useState } from "react";
import { fetchPortfolio } from "../api/client";
import PaperPortfolioTables from "../components/portfolio/PaperPortfolioTables";
import PaperCashPanel from "../components/portfolio/PaperCashPanel";
import type { PortfolioSummary } from "../types/portfolio";

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export default function PortfolioPage({ onSelectTicker }: Props) {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchPortfolio();
      setPortfolio(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดพอร์ตไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !portfolio) {
    return (
      <div className="rounded-xl border border-graphite bg-charcoal p-12 text-center text-muted animate-pulse">
        กำลังโหลดพอร์ตจำลอง...
      </div>
    );
  }

  if (error && !portfolio) {
    return (
      <div className="rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson">
        {error}
      </div>
    );
  }

  if (!portfolio) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["มูลค่ารวม", `$${portfolio.total_value.toLocaleString()}`, "text-white"],
          ["เงินสดจำลอง", `$${portfolio.cash.toLocaleString()}`, "text-electric"],
          ["ลงทุนแล้ว", `$${portfolio.invested.toLocaleString()}`, "text-silver"],
          [
            "กำไร/ขาดทุน",
            `${portfolio.unrealized_pnl >= 0 ? "+" : ""}$${portfolio.unrealized_pnl.toLocaleString()} (${portfolio.unrealized_pnl_pct}%)`,
            portfolio.unrealized_pnl >= 0 ? "text-neon" : "text-crimson",
          ],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-xl border border-graphite bg-charcoal px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className={`font-mono text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="max-w-md">
        <PaperCashPanel cashAvailable={portfolio.cash} onSuccess={setPortfolio} />
      </div>

      <PaperPortfolioTables
        portfolio={portfolio}
        onRefresh={load}
        onSelectTicker={onSelectTicker}
      />

      <p className="text-[10px] text-muted text-center">
        Paper Trading — ไม่เชื่อมโบรกเกอร์ · ไม่ส่งคำสั่งซื้อขายจริง
      </p>
    </div>
  );
}
