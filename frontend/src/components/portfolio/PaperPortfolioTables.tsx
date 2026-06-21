import { useState } from "react";
import type { PortfolioSummary } from "../../types/portfolio";
import { deletePosition, updatePosition } from "../../api/client";

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

function orderLabel(side: string): string {
  return side === "BUY" ? "Paper Buy · Filled" : "Paper Sell · Filled";
}

export default function PaperPortfolioTables({ portfolio, onRefresh, onSelectTicker }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const handleDelete = async (ticker: string) => {
    if (!confirm(`ลบ ${ticker} ออกจากพอร์ตจำลอง? (ขายจำลองที่ราคาตลาด)`)) return;
    setBusy(ticker);
    try {
      await deletePosition(ticker);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const handleEdit = async (ticker: string, shares: number, avgCost: number) => {
    const newShares = prompt(`จำนวนหุ้น ${ticker}:`, String(shares));
    if (newShares == null) return;
    const newAvg = prompt(`ราคาเฉลี่ย ${ticker} ($):`, String(avgCost));
    if (newAvg == null) return;

    const s = parseFloat(newShares);
    const a = parseFloat(newAvg);
    if (!s || s <= 0 || !a || a <= 0) {
      alert("ค่าไม่ถูกต้อง");
      return;
    }

    setBusy(ticker);
    try {
      await updatePosition(ticker, { shares: s, avg_cost: a });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "แก้ไขไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-graphite bg-charcoal overflow-hidden">
        <div className="border-b border-graphite px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-silver">
            พอร์ตจำลอง (Paper)
          </h2>
          <span className="text-xs text-muted font-mono">
            เงินสด ${portfolio.cash.toLocaleString()}
          </span>
        </div>

        {portfolio.positions.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            ยังไม่มีหุ้นในพอร์ตจำลอง — ใช้แผง Paper Buy ด้านขวา
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">ราคาเฉลี่ย</th>
                  <th className="px-3 py-2">จำนวนหุ้น</th>
                  <th className="px-3 py-2">มูลค่าปัจจุบัน</th>
                  <th className="px-3 py-2">เงินที่ใช้ไป</th>
                  <th className="px-3 py-2">P/L USD</th>
                  <th className="px-3 py-2">P/L %</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((p) => (
                  <tr
                    key={p.ticker}
                    className="border-b border-graphite/50 hover:bg-slate/50"
                  >
                    <td
                      className="px-3 py-2 font-mono font-bold cursor-pointer"
                      onClick={() => onSelectTicker?.(p.ticker)}
                    >
                      {p.ticker}
                    </td>
                    <td className="px-3 py-2 font-mono">${p.avg_cost.toFixed(2)}</td>
                    <td className="px-3 py-2 font-mono">{p.shares.toFixed(4)}</td>
                    <td className="px-3 py-2 font-mono">${p.market_value.toFixed(2)}</td>
                    <td className="px-3 py-2 font-mono">${p.cost_basis.toFixed(2)}</td>
                    <td className={`px-3 py-2 font-mono font-semibold ${pnlClass(p.unrealized_pnl)}`}>
                      {p.unrealized_pnl >= 0 ? "+" : ""}${p.unrealized_pnl.toFixed(2)}
                    </td>
                    <td className={`px-3 py-2 font-mono ${pnlClass(p.unrealized_pnl)}`}>
                      {p.unrealized_pnl_pct >= 0 ? "+" : ""}{p.unrealized_pnl_pct}%
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busy === p.ticker}
                        onClick={() => handleEdit(p.ticker, p.shares, p.avg_cost)}
                        className="text-xs text-electric hover:underline mr-2 disabled:opacity-50"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        disabled={busy === p.ticker}
                        onClick={() => handleDelete(p.ticker)}
                        className="text-xs text-crimson hover:underline disabled:opacity-50"
                      >
                        ลบ
                      </button>
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
            ประวัติคำสั่งจำลอง
          </h2>
          <p className="text-[10px] text-muted mt-0.5">เคลียร์อัตโนมัติทุกวัน 00:00 (เวลาไทย)</p>
        </div>

        {portfolio.orders.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">ยังไม่มีประวัติ Paper Trade</p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-charcoal">
                <tr className="border-b border-graphite text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2">วันที่/เวลา</th>
                  <th className="px-3 py-2">คำสั่ง</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Amount USD</th>
                  <th className="px-3 py-2">Quantity</th>
                  <th className="px-3 py-2">P/L</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.orders.map((o) => (
                  <tr key={o.id} className="border-b border-graphite/50">
                    <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString("th-TH")}
                    </td>
                    <td className={`px-3 py-2 text-xs font-semibold ${o.side === "BUY" ? "text-neon" : "text-crimson"}`}>
                      {orderLabel(o.side)}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold">{o.ticker}</td>
                    <td className="px-3 py-2 font-mono">${o.price.toFixed(2)}</td>
                    <td className="px-3 py-2 font-mono">${o.total.toFixed(2)}</td>
                    <td className="px-3 py-2 font-mono">{o.shares.toFixed(4)}</td>
                    <td className={`px-3 py-2 font-mono text-xs ${o.realized_pnl != null ? pnlClass(o.realized_pnl) : "text-muted"}`}>
                      {o.realized_pnl != null
                        ? `${o.realized_pnl >= 0 ? "+" : ""}$${o.realized_pnl.toFixed(2)}`
                        : "—"}
                    </td>
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
