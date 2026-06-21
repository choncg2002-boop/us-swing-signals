import { useMemo, useState, type FormEvent } from "react";
import type { SignalResult } from "../../types/signals";
import { submitBuyOrder, submitSellOrder } from "../../api/client";

interface Props {
  ticker: string;
  livePrice: number | null;
  signal: SignalResult | null;
  cashAvailable?: number;
  heldShares?: number;
  heldValue?: number;
  onSuccess: () => void;
}

export default function OrderForm({
  ticker,
  livePrice,
  signal,
  cashAvailable = 0,
  heldShares = 0,
  heldValue = 0,
  onSuccess,
}: Props) {
  const plan = signal?.trade_plan;
  const defaultPrice = livePrice ?? signal?.price ?? plan?.entry ?? 0;
  const defaultBuyUsd = plan
    ? Math.round(plan.suggested_shares * plan.entry)
    : 500;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amountUsd, setAmountUsd] = useState(String(defaultBuyUsd));
  const [price, setPrice] = useState(defaultPrice > 0 ? defaultPrice.toFixed(2) : "");
  const [stopLoss, setStopLoss] = useState(plan?.stop_loss?.toFixed(2) ?? "");
  const [target, setTarget] = useState(plan?.target_1?.toFixed(2) ?? "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pr = parseFloat(price) || 0;
  const amt = parseFloat(amountUsd) || 0;
  const estimatedShares = pr > 0 && amt > 0 ? amt / pr : 0;

  const maxBuyUsd = cashAvailable;
  const maxSellUsd = heldValue;

  const quickAmounts = useMemo(() => {
    if (side === "buy") {
      return [500, 1000, 2500, 5000].filter((a) => a <= maxBuyUsd || maxBuyUsd === 0);
    }
    if (maxSellUsd <= 0) return [];
    const half = Math.round(maxSellUsd / 2);
    return [half, maxSellUsd].filter((v, i, a) => a.indexOf(v) === i && v > 0);
  }, [side, maxBuyUsd, maxSellUsd]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amt || amt <= 0 || !pr || pr <= 0) {
      setError("กรุณาใส่จำนวนเงิน ($) และราคาให้ถูกต้อง");
      return;
    }

    const shares = Math.round((amt / pr) * 10000) / 10000;
    if (shares <= 0) {
      setError("จำนวนเงินน้อยเกินไปสำหรับราคานี้");
      return;
    }

    if (side === "buy" && amt > cashAvailable + 0.01) {
      setError(`เงินสดไม่พอ — มี $${cashAvailable.toFixed(2)}`);
      return;
    }

    if (side === "sell" && amt > maxSellUsd + 0.01) {
      setError(`มูลค่าที่ถือไม่พอ — ถืออยู่ ~$${maxSellUsd.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      if (side === "buy") {
        await submitBuyOrder({
          ticker,
          shares,
          price: pr,
          note: note || `ซื้อ $${amt.toFixed(2)}`,
          stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
          target: target ? parseFloat(target) : undefined,
        });
      } else {
        await submitSellOrder({
          ticker,
          shares,
          price: pr,
          note: note || `ขาย $${amt.toFixed(2)}`,
        });
      }
      setNote("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งคำสั่งไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-graphite bg-charcoal p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-silver">ซื้อ / ขาย (USD)</h3>
        <div className="inline-flex rounded-lg border border-graphite bg-slate p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => {
              setSide("buy");
              setAmountUsd(String(defaultBuyUsd));
            }}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              side === "buy" ? "bg-neon/20 text-neon border border-neon/40" : "text-muted"
            }`}
          >
            ซื้อ
          </button>
          <button
            type="button"
            onClick={() => {
              setSide("sell");
              setAmountUsd(maxSellUsd > 0 ? String(Math.round(maxSellUsd)) : "");
            }}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              side === "sell" ? "bg-crimson/20 text-crimson border border-crimson/40" : "text-muted"
            }`}
          >
            ขาย
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-slate px-3 py-2 text-xs text-muted flex justify-between">
        <span>{ticker}</span>
        {side === "buy" ? (
          <span>เงินสดคงเหลือ <span className="font-mono text-electric">${cashAvailable.toLocaleString()}</span></span>
        ) : (
          <span>
            ถืออยู่{" "}
            <span className="font-mono text-amber">${maxSellUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            {heldShares > 0 && (
              <span className="text-muted ml-1">({heldShares.toFixed(2)} หุ้น)</span>
            )}
          </span>
        )}
      </div>

      <label className="block space-y-1 text-xs">
        <span className="text-muted">จำนวนเงิน ($)</span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-mono">$</span>
          <input
            type="number"
            step="1"
            min="1"
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value)}
            placeholder={side === "buy" ? "500" : "0"}
            className="w-full rounded-lg border border-graphite bg-slate pl-7 pr-3 py-2.5 font-mono text-lg font-bold outline-none focus:border-electric/50"
          />
        </div>
      </label>

      {quickAmounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmountUsd(String(q))}
              className="rounded-md border border-graphite bg-slate px-2 py-1 text-xs font-mono text-silver hover:border-electric/40"
            >
              ${q.toLocaleString()}
            </button>
          ))}
          {side === "sell" && maxSellUsd > 0 && (
            <button
              type="button"
              onClick={() => setAmountUsd(maxSellUsd.toFixed(2))}
              className="rounded-md border border-crimson/30 bg-crimson/10 px-2 py-1 text-xs font-mono text-crimson"
            >
              ขายทั้งหมด
            </button>
          )}
        </div>
      )}

      <label className="block space-y-1 text-xs">
        <span className="text-muted">ราคาต่อหุ้น ($)</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-lg border border-graphite bg-slate px-3 py-2 font-mono text-sm outline-none focus:border-electric/50"
        />
      </label>

      {estimatedShares > 0 && (
        <p className="text-xs text-muted font-mono">
          ≈ {estimatedShares.toFixed(4)} หุ้น · รวม ${amt.toFixed(2)}
        </p>
      )}

      {side === "buy" && plan && (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs">
            <span className="text-muted">Stop Loss ($)</span>
            <input
              type="number"
              step="0.01"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full rounded-lg border border-graphite bg-slate px-3 py-2 font-mono text-sm outline-none focus:border-crimson/50"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted">Target ($)</span>
            <input
              type="number"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-lg border border-graphite bg-slate px-3 py-2 font-mono text-sm outline-none focus:border-neon/50"
            />
          </label>
        </div>
      )}

      {error && <p className="text-xs text-crimson">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
          side === "buy"
            ? "bg-neon/15 border border-neon/40 text-neon hover:bg-neon/25"
            : "bg-crimson/15 border border-crimson/40 text-crimson hover:bg-crimson/25"
        }`}
      >
        {loading
          ? "กำลังบันทึก..."
          : side === "buy"
            ? `ยืนยันซื้อ $${amt > 0 ? amt.toFixed(0) : "—"}`
            : `ยืนยันขาย $${amt > 0 ? amt.toFixed(0) : "—"}`}
      </button>
    </form>
  );
}
