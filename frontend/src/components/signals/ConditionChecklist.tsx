import type { ConditionCheck } from "../../types/signals";

interface Props {
  items: ConditionCheck[];
}

export default function ConditionChecklist({ items }: Props) {
  const passed = items.filter((i) => i.passed).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted uppercase tracking-wider">เงื่อนไขเข้า Long (8 ข้อ)</span>
        <span className="font-mono text-silver">{passed}/{items.length}</span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-lg border px-3 py-2 text-sm ${
              item.passed
                ? "border-neon/30 bg-neon/5"
                : "border-graphite bg-slate/50"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={item.passed ? "text-neon" : "text-crimson"}>
                {item.passed ? "✓" : "✗"}
              </span>
              <div>
                <p className={item.passed ? "text-neon" : "text-silver"}>{item.label}</p>
                <p className="text-xs text-muted mt-0.5">{item.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
