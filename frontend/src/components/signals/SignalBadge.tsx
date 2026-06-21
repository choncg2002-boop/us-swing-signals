import type { Verdict } from "../../types/signals";

const CONFIG: Record<
  Verdict,
  { label: string; labelTh: string; className: string; glow?: string }
> = {
  ENTRY_READY: {
    label: "ENTRY READY",
    labelTh: "เข้าได้",
    className: "bg-neon/10 text-neon border-neon/40",
    glow: "shadow-neon-glow",
  },
  WAIT: {
    label: "WAIT",
    labelTh: "รอ",
    className: "bg-amber/10 text-amber border-amber/30",
  },
  AVOID: {
    label: "AVOID",
    labelTh: "หลีกเลี่ยง",
    className: "bg-crimson/10 text-crimson border-crimson/30",
  },
};

const FALLBACK = {
  label: "UNKNOWN",
  labelTh: "ไม่ทราบ",
  className: "bg-graphite text-muted border-graphite",
};

interface Props {
  verdict: Verdict;
  size?: "sm" | "lg";
}

export default function SignalBadge({ verdict, size = "lg" }: Props) {
  const cfg = CONFIG[verdict] ?? FALLBACK;
  const sizeClass = size === "lg" ? "px-4 py-1.5 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold tracking-wide ${sizeClass} ${cfg.className} ${cfg.glow ?? ""}`}
    >
      {cfg.labelTh}
      <span className="sr-only">{cfg.label}</span>
    </span>
  );
}
