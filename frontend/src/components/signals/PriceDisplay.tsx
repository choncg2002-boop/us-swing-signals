interface Props {
  label: string;
  value: number | string;
  suffix?: string;
  variant?: "default" | "profit" | "loss" | "neutral";
}

export default function PriceDisplay({
  label,
  value,
  suffix,
  variant = "default",
}: Props) {
  const color =
    variant === "profit"
      ? "text-neon"
      : variant === "loss"
        ? "text-crimson"
        : variant === "neutral"
          ? "text-electric"
          : "text-white";

  const display =
    typeof value === "number" ? `$${value.toFixed(2)}` : value;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      <span className={`font-mono text-2xl font-bold ${color}`}>
        {display}
        {suffix && (
          <span className="ml-2 text-base font-semibold">{suffix}</span>
        )}
      </span>
    </div>
  );
}
