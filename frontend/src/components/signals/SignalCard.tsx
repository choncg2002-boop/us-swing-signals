import type { SignalResult, TrendBias } from "../../types/signals";
import SignalBadge from "./SignalBadge";
import PriceDisplay from "./PriceDisplay";
import ConditionChecklist from "./ConditionChecklist";
import FibonacciPanel from "./FibonacciPanel";

interface Props {
  signal: SignalResult | null;
  loading?: boolean;
}

function biasLabel(b: TrendBias): string {
  return b === "bullish" ? "ขาขึ้น" : b === "bearish" ? "ขาลง" : "กลางๆ";
}

function volLabel(v: string): string {
  if (v === "accumulation") return "สะสม";
  if (v === "distribution") return "แจกจ่าย";
  return "ปกติ";
}

function rsLabel(v: string): string {
  if (v === "outperform") return "ดีกว่าตลาด";
  if (v === "underperform") return "แย่กว่าตลาด";
  return "เท่าตลาด";
}

export default function SignalCard({ signal, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-graphite bg-charcoal p-6 animate-pulse">
        <div className="h-6 w-32 rounded bg-graphite mb-4" />
        <div className="space-y-4">
          <div className="h-10 w-full rounded bg-graphite" />
          <div className="h-10 w-full rounded bg-graphite" />
          <div className="h-10 w-full rounded bg-graphite" />
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="rounded-xl border border-graphite bg-charcoal p-6 text-center text-muted">
        เลือกหุ้นเพื่อดูแผนเทรด
      </div>
    );
  }

  if (!signal.overview || !signal.score_breakdown || !signal.verdict) {
    return (
      <div className="rounded-xl border border-amber/40 bg-amber/10 p-6 text-sm text-amber space-y-3">
        <p className="font-semibold">Backend ยังเป็นเวอร์ชันเก่า</p>
        <p className="text-xs opacity-90">
          ต้อง restart backend ให้โหลดโค้ดใหม่ แล้ว refresh หน้านี้
        </p>
        <code className="block text-xs font-mono text-silver">
          uvicorn app.main:app --host 127.0.0.1 --port 8003 --reload
        </code>
      </div>
    );
  }

  const plan = signal.trade_plan;
  const ov = signal.overview;
  const sb = signal.score_breakdown;

  return (
    <div className="rounded-xl border border-graphite bg-charcoal p-6 space-y-5 max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <SignalBadge verdict={signal.verdict} />
        <span className="font-mono text-2xl font-bold">{signal.ticker}</span>
      </div>

      <div
        className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
          signal.verdict === "ENTRY_READY"
            ? "bg-neon/10 border border-neon/30 text-neon"
            : signal.verdict === "WAIT"
              ? "bg-amber/10 border border-amber/30 text-amber"
              : "bg-crimson/10 border border-crimson/30 text-crimson"
        }`}
      >
        <p className="font-semibold">D) คำตัดสิน: {signal.verdict === "ENTRY_READY" ? "เข้าได้เมื่อเงื่อนไขครบ" : signal.verdict === "WAIT" ? "รอ" : "หลีกเลี่ยง"}</p>
        <p className="mt-1 text-xs opacity-90">{signal.verdict_reason}</p>
        {signal.blockers.length > 0 && (
          <p className="mt-1 text-xs opacity-80">⚠ {signal.blockers.join(" · ")}</p>
        )}
      </div>

      {/* A) Overview */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-muted">A) ภาพรวมอินดิเคเตอร์</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-slate px-3 py-2">
            <span className="text-muted text-xs">Trend</span>
            <p className="font-mono font-semibold">{biasLabel(ov.trend)}</p>
          </div>
          <div className="rounded-lg bg-slate px-3 py-2">
            <span className="text-muted text-xs">Momentum</span>
            <p className="font-mono font-semibold">{biasLabel(ov.momentum)}</p>
          </div>
          <div className="rounded-lg bg-slate px-3 py-2">
            <span className="text-muted text-xs">Volume</span>
            <p className="font-mono font-semibold">{volLabel(ov.volume)}</p>
          </div>
          <div className="rounded-lg bg-slate px-3 py-2">
            <span className="text-muted text-xs">Rel. Strength</span>
            <p className="font-mono font-semibold">{rsLabel(ov.relative_strength)}</p>
          </div>
        </div>
        <p className="text-xs text-muted">
          ATR(14) ${ov.atr14.toFixed(2)} ({ov.atr_pct.toFixed(1)}% ของราคา) · Daily {biasLabel(signal.daily.trend)}/{biasLabel(signal.daily.momentum)} · Weekly {biasLabel(signal.weekly.trend)}/{biasLabel(signal.weekly.momentum)}
        </p>
      </section>

      {/* B) Score */}
      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-muted">B) คะแนนเทคนิค {sb.total}/100</h3>
        <div className="space-y-1 text-xs">
          {[
            ["Trend (EMA/SMA)", sb.trend, 30],
            ["Momentum (RSI+MACD)", sb.momentum, 25],
            ["Volume", sb.volume, 15],
            ["Relative Strength", sb.relative_strength, 15],
            ["Risk/Reward + ATR", sb.risk_reward, 15],
          ].map(([label, val, max]) => (
            <div key={String(label)} className="flex items-center gap-2">
              <span className="text-muted w-36 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded bg-graphite overflow-hidden">
                <div
                  className="h-full bg-neon rounded"
                  style={{ width: `${(Number(val) / Number(max)) * 100}%` }}
                />
              </div>
              <span className="font-mono w-10 text-right">{val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* C) Trade Plan */}
      {plan ? (
        <section className="space-y-3 border-t border-graphite pt-4">
          <h3 className="text-xs uppercase tracking-wider text-muted">C) แผนเทรด (≤3 เดือน)</h3>
          <PriceDisplay label="จุดซื้อ (Entry)" value={plan.entry} />
          <PriceDisplay
            label="Target 1 (ขายบางส่วน)"
            value={plan.target_1}
            suffix={`(+${plan.reward_pct_t1.toFixed(1)}%)`}
            variant="profit"
          />
          <PriceDisplay
            label="Target 2 (ขายเพิ่ม)"
            value={plan.target_2}
            suffix={`(+${plan.reward_pct_t2.toFixed(1)}%)`}
            variant="profit"
          />
          <PriceDisplay
            label="Stop Loss (ตัดขาดทุน)"
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
          <div className="rounded-lg bg-slate px-3 py-2 text-xs space-y-1">
            <p><span className="text-muted">จำนวนหุ้นแนะนำ</span> <span className="font-mono font-semibold">{plan.suggested_shares}</span> หุ้น (risk $500/ดีล)</p>
            <p><span className="text-muted">ระยะถือ</span> {plan.hold_period}</p>
          </div>
          {plan.entry_conditions.length > 0 && (
            <ul className="text-xs text-muted space-y-1 list-disc list-inside">
              {plan.entry_conditions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="rounded-lg bg-crimson/10 border border-crimson/30 px-4 py-3 text-sm text-crimson">
          ข้อมูลไม่พอคำนวณ Entry / SL / Target
        </div>
      )}

      {signal.checklist?.length > 0 && (
        <ConditionChecklist items={signal.checklist} />
      )}

      {signal.fibonacci_plan && (
        <FibonacciPanel plan={signal.fibonacci_plan} />
      )}

      <p className="text-[10px] text-muted border-t border-graphite pt-3">
        * วิเคราะห์จากอินดิเคเตอร์เท่านั้น ไม่ใช่คำแนะนำการลงทุน · ไม่แม่น 100%
      </p>
    </div>
  );
}
