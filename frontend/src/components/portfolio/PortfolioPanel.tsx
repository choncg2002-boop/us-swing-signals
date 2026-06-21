import type { PortfolioSummary } from "../../types/portfolio";
import { resetPortfolio } from "../../api/client";
import { useState } from "react";

interface Props {
  portfolio: PortfolioSummary;
  onRefresh: () => void;
  onSelectTicker?: (ticker: string) => void;
}

function pnlClass(v: number): string {
  if (v > 0) return "text-neon";
  if (v < 0) return "text-crimson";
  return "text-silver";
}

export default function PortfolioPanel({ portfolio, onRefresh, onSelectTicker }: Props) {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm("รีเซ็ตพอร์ตทั้งหมด? คำสั่งและหุ้นที่ถือจะหายไป")) return;
    setResetting(true);
    try {
      await resetPortfolio();
      onRefresh();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["มูลค่ารวม", `$${portfolio.total_value.toLocaleString()}`, "text-white"],
          ["เงินสด", `$${portfolio.cash.toLocaleString()}`, "text-electric"],
          ["ลงทุนแล้ว", `$${portfolio.invested.toLocaleString()}`, "text-silver"],
          ["กำไร/ขาดทุน", `${portfolio.unrealized_pnl >= 0 ? "+" : ""}$${portfolio.unrealized_pnl.toLocaleString()} (${portfolio.unrealized_pnl_pct}%)`, pnlClass(portfolio.unrealized_pnl)],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-xl border border-graphite bg-charcoal px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className={`font-mono text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-graphite bg-charcoal overflow-hidden">
        <div className="flex items-center justify-between border-b border-graphite px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-silver">
            หุ้นที่ถือ
          </h2>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="text-xs text-muted hover:text-crimson disabled:opacity-50"
          >
            {resetting ? "..." : "รีเซ็ตพอร์ต"}
          </button>
        </div>

        {portfolio.positions.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            ยังไม่มีหุ้นในพอร์ต — ใช้คำสั่งซื้อจากหน้าสัญญาณ
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">หุ้น</th>
                  <th className="px-4 py-3">มูลค่า ($)</th>
                  <th className="px-4 py-3">ทุน ($)</th>
                  <th className="px-4 py-3">ราคา</th>
                  <th className="px-4 py-3">P/L ($)</th>
                  <th className="px-4 py-3">SL / Target</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((p) => (
                  <tr
                    key={p.ticker}
                    onClick={() => onSelectTicker?.(p.ticker)}
                    className="cursor-pointer border-b border-graphite/50 hover:bg-slate transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold">{p.ticker}</td>
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      ${p.market_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-mono">${p.cost_basis.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {p.current_price != null ? `$${p.current_price.toFixed(2)}` : "—"}
                      <span className="block text-muted">{p.shares.toFixed(2)} sh</span>
                    </td>
                    <td className={`px-4 py-3 font-mono font-semibold ${pnlClass(p.unrealized_pnl)}`}>
                      {p.unrealized_pnl >= 0 ? "+" : ""}${p.unrealized_pnl.toFixed(2)}
                      <span className="text-xs ml-1">({p.unrealized_pnl_pct}%)</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {p.stop_loss != null ? `$${p.stop_loss.toFixed(0)}` : "—"}
                      {" / "}
                      {p.target != null ? `$${p.target.toFixed(0)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-graphite bg-charcoal overflow-hidden">
        <div className="border-b border-graphite px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-silver">
            ประวัติคำสั่งล่าสุด
          </h2>
        </div>
        {portfolio.orders.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">ยังไม่มีคำสั่ง</p>
        ) : (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-charcoal">
                <tr className="border-b border-graphite text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-2">เวลา</th>
                  <th className="px-4 py-2">คำสั่ง</th>
                  <th className="px-4 py-2">หุ้น</th>
                  <th className="px-4 py-2">จำนวนเงิน ($)</th>
                  <th className="px-4 py-2">ราคา</th>
                  <th className="px-4 py-2">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.orders.map((o) => (
                  <tr key={o.id} className="border-b border-graphite/50">
                    <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString("th-TH")}
                    </td>
                    <td className={`px-4 py-2 font-semibold ${o.side === "BUY" ? "text-neon" : "text-crimson"}`}>
                      {o.side === "BUY" ? "ซื้อ" : "ขาย"}
                    </td>
                    <td className="px-4 py-2 font-mono font-bold">{o.ticker}</td>
                    <td className={`px-4 py-2 font-mono font-bold ${o.side === "BUY" ? "text-neon" : "text-crimson"}`}>
                      ${o.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted">
                      ${o.price.toFixed(2)} · {o.shares.toFixed(2)} sh
                    </td>
                    <td className="px-4 py-2 text-xs text-muted max-w-[140px] truncate">{o.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
