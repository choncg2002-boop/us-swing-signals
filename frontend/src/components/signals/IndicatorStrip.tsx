import type { SignalResult } from "../../types/signals";

interface Props {
  signal: SignalResult;
}

export default function IndicatorStrip({ signal }: Props) {
  const macdOk = signal.macd > signal.macd_signal && signal.macd_histogram > 0;
  const trendOk = signal.price > signal.ema20 && signal.price > signal.sma50;
  const rsiOk = signal.rsi14 >= 50 && signal.rsi14 <= 70;
  const volOk = signal.volume_ratio >= 1.5;
  const rsOk = (signal.relative_strength ?? 0) > 0;

  const items = [
    { label: "Trend", value: trendOk ? "Above EMA20/SMA50" : "Weak", ok: trendOk },
    { label: "RSI(14)", value: signal.rsi14.toFixed(1), ok: rsiOk },
    {
      label: "MACD",
      value: macdOk ? "Bullish" : "Bearish",
      ok: macdOk,
    },
    { label: "Volume", value: `${signal.volume_ratio}x`, ok: volOk },
    {
      label: "RS vs SPY",
      value: signal.relative_strength != null ? `${signal.relative_strength > 0 ? "+" : ""}${signal.relative_strength.toFixed(1)}%` : "—",
      ok: rsOk,
    },
    {
      label: "EMA20",
      value: `$${signal.ema20.toFixed(2)}`,
      ok: signal.price > signal.ema20,
    },
  ];

  return (
    <div className="flex flex-wrap gap-3 rounded-xl border border-graphite bg-charcoal px-4 py-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 rounded-lg bg-slate px-3 py-2 text-sm"
        >
          <span className="text-muted">{item.label}</span>
          <span className={`font-mono font-semibold ${item.ok ? "text-neon" : "text-silver"}`}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
