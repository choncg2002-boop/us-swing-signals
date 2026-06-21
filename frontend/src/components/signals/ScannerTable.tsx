import type { SignalResult } from "../../types/signals";
import SignalBadge from "./SignalBadge";

interface Props {
  signals: SignalResult[];
  selectedTicker: string;
  onSelect: (ticker: string) => void;
}

export default function ScannerTable({ signals, selectedTicker, onSelect }: Props) {
  if (signals.length === 0) {
    return (
      <div className="rounded-xl border border-graphite bg-charcoal p-8 text-center space-y-2">
        <p className="text-silver font-medium">ยังไม่มีสัญญาณเข้า/รอในตลาดตอนนี้</p>
        <p className="text-sm text-muted max-w-lg mx-auto">
          เลือกหุ้นด้านบนเพื่อดูแผนเทรด Entry / Target / Stop Loss ตามอินดิเคเตอร์เทคนิค
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-graphite bg-charcoal overflow-hidden">
      <div className="border-b border-graphite px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-silver">
          สัญญาณเทคนิค (เข้าได้ / รอ)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-graphite text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3">หุ้น</th>
              <th className="px-4 py-3">คำตัดสิน</th>
              <th className="px-4 py-3">Entry</th>
              <th className="px-4 py-3">T1</th>
              <th className="px-4 py-3">T2</th>
              <th className="px-4 py-3">SL</th>
              <th className="px-4 py-3">R:R</th>
              <th className="px-4 py-3">RSI</th>
              <th className="px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => {
              const active = s.ticker === selectedTicker;
              const plan = s.trade_plan;
              return (
                <tr
                  key={s.ticker}
                  onClick={() => onSelect(s.ticker)}
                  className={`cursor-pointer border-b border-graphite/50 transition-colors hover:bg-slate ${
                    active ? "bg-slate/80" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-bold">{s.ticker}</td>
                  <td className="px-4 py-3">
                    <SignalBadge verdict={s.verdict} size="sm" />
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {plan ? `$${plan.entry.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-neon">
                    {plan ? `$${plan.target_1.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-neon">
                    {plan ? `$${plan.target_2.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-crimson">
                    {plan ? `$${plan.stop_loss.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-electric">
                    {plan ? `1:${plan.reward_risk.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono">{s.rsi14}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-neon">
                    {s.score}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
