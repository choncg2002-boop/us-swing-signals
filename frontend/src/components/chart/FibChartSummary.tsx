import type { FibChartAnalysis } from "../../utils/fibonacciChart";

interface Props {
  analysis: FibChartAnalysis;
}

export default function FibChartSummary({ analysis }: Props) {
  return (
    <div className="rounded-xl border border-graphite bg-charcoal px-4 py-3 space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted">Fibonacci จุดสำคัญ</span>
        <span className="rounded-md bg-slate px-2 py-0.5 text-xs font-mono">
          เทรนด์: {analysis.trend}
        </span>
        <span className="text-xs text-muted font-mono">
          Swing H {analysis.swingHigh.toFixed(2)} · L {analysis.swingLow.toFixed(2)}
        </span>
      </div>

      <ul className="space-y-1.5 text-xs text-silver list-none">
        {analysis.summary.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-electric shrink-0">{i + 1}.</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <p className="text-[10px] text-muted border-t border-graphite pt-2">
        แสดงเฉพาะ Fib 38.2% · 61.8% · Swing Low · High 100% · Extension 127.2/161.8%
      </p>
    </div>
  );
}
