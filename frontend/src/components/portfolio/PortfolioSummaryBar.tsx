import type { PortfolioSummary } from "../../types/portfolio";

interface Props {
  portfolio: PortfolioSummary | null;
  onOpenPortfolio?: () => void;
}

function pnlClass(v: number): string {
  if (v > 0) return "text-neon";
  if (v < 0) return "text-crimson";
  return "text-silver";
}

export default function PortfolioSummaryBar({ portfolio, onOpenPortfolio }: Props) {
  if (!portfolio) return null;

  const pnl = portfolio.unrealized_pnl;
  const pnlSign = pnl >= 0 ? "+" : "";

  return (
    <button
      type="button"
      onClick={onOpenPortfolio}
      className="w-full border-b border-graphite bg-charcoal/80 hover:bg-charcoal transition-colors text-left"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-xs">
        <span className="text-muted uppercase tracking-wider shrink-0">พอร์ตรวม</span>
        <span className="font-mono font-bold text-white text-sm">
          ${portfolio.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-muted">
          เงินสด{" "}
          <span className="font-mono text-electric">
            ${portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </span>
        <span className="text-muted">
          ลงทุน{" "}
          <span className="font-mono text-silver">
            ${portfolio.invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </span>
        <span className="text-muted">
          กำไร/ขาดทุน{" "}
          <span className={`font-mono font-semibold ${pnlClass(pnl)}`}>
            {pnlSign}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })} ({pnlSign}{portfolio.unrealized_pnl_pct}%)
          </span>
        </span>
        <span className="text-muted ml-auto hidden sm:inline">
          {portfolio.positions.length} หุ้น · คลิกดูรายละเอียด →
        </span>
      </div>
    </button>
  );
}
