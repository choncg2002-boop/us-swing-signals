import { motion } from "framer-motion";
import type { Timeframe } from "../../types/signals";

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "1Y"];

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export default function TimeframeSwitcher({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-graphite bg-slate p-1 gap-1">
      {TIMEFRAMES.map((tf) => {
        const active = tf === value;
        return (
          <button
            key={tf}
            type="button"
            onClick={() => onChange(tf)}
            className="relative rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {active && (
              <motion.span
                layoutId="timeframe-pill"
                className="absolute inset-0 rounded-md bg-electric/20 border border-electric/40"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`relative z-10 ${active ? "text-electric" : "text-muted hover:text-white"}`}>
              {tf}
            </span>
          </button>
        );
      })}
    </div>
  );
}
