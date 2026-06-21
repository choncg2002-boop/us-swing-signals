import type { FibonacciPlan } from "../../types/signals";
import PriceDisplay from "./PriceDisplay";

interface Props {
  plan: FibonacciPlan;
}

const ACTION_STYLE: Record<string, string> = {
  ซื้อ: "bg-neon/10 border-neon/30 text-neon",
  ขาย: "bg-crimson/10 border-crimson/30 text-crimson",
  รอ: "bg-amber/10 border-amber/30 text-amber",
};

export default function FibonacciPanel({ plan }: Props) {
  const actionClass = ACTION_STYLE[plan.action] ?? ACTION_STYLE["รอ"];

  return (
    <section className="space-y-3 border-t border-graphite pt-4">
      <h3 className="text-xs uppercase tracking-wider text-muted">
        Fibonacci Retracement (≤3 เดือน)
      </h3>

      <div className={`rounded-lg border px-4 py-3 text-sm ${actionClass}`}>
        <p className="font-semibold">
          คำแนะนำ: {plan.action} · เทรนด์ {plan.trend}
        </p>
        <p className="mt-1 text-xs opacity-90">{plan.action_reason}</p>
        {plan.indicator_note !== "ไม่มีสัญญาณเสียเพิ่ม" && (
          <p className="mt-1 text-xs opacity-80">📊 {plan.indicator_note}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate px-3 py-2">
          <span className="text-muted">Swing High</span>
          <p className="font-mono font-semibold">${plan.swing_high.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-slate px-3 py-2">
          <span className="text-muted">Swing Low</span>
          <p className="font-mono font-semibold">${plan.swing_low.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <p className="text-muted uppercase tracking-wider">ระดับฟิโบสำคัญ</p>
        {[
          ["38.2%", plan.fib_382],
          ["50.0%", plan.fib_500],
          ["61.8%", plan.fib_618],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between rounded bg-slate px-3 py-1.5">
            <span className="text-muted">{label}</span>
            <span className="font-mono font-semibold">${Number(value).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <PriceDisplay
        label="Entry Zone"
        value={`$${plan.entry_low.toFixed(2)} – $${plan.entry_high.toFixed(2)}`}
        variant="neutral"
      />
      <PriceDisplay
        label="Take Profit"
        value={plan.take_profit}
        suffix={`(+${plan.reward_pct.toFixed(1)}%)`}
        variant="profit"
      />
      <PriceDisplay
        label="Stop Loss"
        value={plan.stop_loss}
        suffix={`(-${plan.risk_pct.toFixed(1)}%)`}
        variant="loss"
      />
      <div className="flex items-center gap-2 rounded-lg bg-slate px-3 py-2">
        <span className="text-xs text-muted">Reward : Risk</span>
        <span className="font-mono font-bold text-electric">
          1 : {plan.reward_risk.toFixed(1)}
        </span>
      </div>
    </section>
  );
}
