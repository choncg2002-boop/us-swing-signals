import { useEffect, useState, type FormEvent } from "react";
import type { PositionView, PortfolioSummary } from "../../types/portfolio";
import { submitBuyOrder, submitSellOrder } from "../../api/client";

interface Props {
  ticker: string;
  livePrice: number | null;
  referencePrice?: number | null;
  cashAvailable: number;
  positions: PositionView[];
  onSuccess: (portfolio: PortfolioSummary) => void;
  disabled?: boolean;
}

export default function PaperOrderForm({
  ticker: defaultTicker,
  livePrice,
  referencePrice,
  cashAvailable,
  positions,
  onSuccess,
  disabled = false,
}: Props) {
  const [symbol, setSymbol] = useState(defaultTicker);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  useEffect(() => {
    setSymbol(defaultTicker);
  }, [defaultTicker]);

  useEffect(() => {
    const px = livePrice ?? referencePrice;
    if (px != null && px > 0) {
      setPrice(px.toFixed(2));
    }
  }, [livePrice, referencePrice, defaultTicker]);

  const sym = symbol.trim().toUpperCase();
  const heldForSymbol = positions.find((p) => p.ticker === sym)?.shares ?? 0;
  const pr = parseFloat(price) || 0;
  const amt = parseFloat(amountUsd) || 0;
  const maxSellUsd = pr > 0 ? Math.round(heldForSymbol * pr * 100) / 100 : 0;
  const rawQuantity = pr > 0 && amt > 0 ? amt / pr : 0;
  const quantity =
    side === "sell" && rawQuantity > 0
      ? Math.min(Math.round(rawQuantity * 10000) / 10000, heldForSymbol)
      : Math.round(rawQuantity * 10000) / 10000;
  const canSubmit =
    pr > 0 &&
    amt > 0 &&
    !loading &&
    !disabled &&
    (side === "buy" || heldForSymbol > 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setLastStatus(null);

    const symUpper = symbol.trim().toUpperCase();
    if (!symUpper) {
      setError("กรุณาใส่ Symbol");
      return;
    }

    const heldShares = positions.find((p) => p.ticker === symUpper)?.shares ?? 0;
    if (side === "sell" && heldShares <= 0) {
      setError(`ไม่มีหุ้น ${symUpper} ในพอร์ตจำลอง`);
      return;
    }

    let shares = Math.round((amt / pr) * 10000) / 10000;
    if (shares <= 0) {
      setError("จำนวนเงินน้อยเกินไปสำหรับราคานี้");
      return;
    }

    if (side === "buy" && amt > cashAvailable + 0.01) {
      setError(`เงินสดจำลองไม่พอ — มี $${cashAvailable.toFixed(2)}`);
      return;
    }

    if (side === "sell") {
      const maxUsd = Math.round(heldShares * pr * 100) / 100;
      if (amt > maxUsd + 0.02) {
        setError(`ขายได้สูงสุด ~$${maxUsd.toFixed(2)} (${heldShares.toFixed(4)} หุ้น)`);
        return;
      }
      if (shares > heldShares) {
        shares = heldShares;
      }
    }

    setLoading(true);
    try {
      if (side === "buy") {
        const updated = await submitBuyOrder({
          ticker: symUpper,
          shares,
          price: pr,
          note: `Paper Buy $${amt.toFixed(2)}`,
        });
        setLastStatus("Paper Buy · Filled");
        setAmountUsd("");
        onSuccess(updated);
      } else {
        const updated = await submitSellOrder({
          ticker: symUpper,
          shares,
          price: pr,
          note: `Paper Sell $${amt.toFixed(2)}`,
        });
        setLastStatus("Paper Sell · Filled");
        setAmountUsd("");
        onSuccess(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึก Paper Trade ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-graphite bg-charcoal p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-silver">Paper Trading</h3>
        <p className="text-[10px] text-muted mt-0.5">
          พอร์ตจำลองเท่านั้น · ไม่เชื่อมโบรกเกอร์ · ไม่ส่งคำสั่งจริง
        </p>
      </div>

      <div className="inline-flex w-full rounded-lg border border-graphite bg-slate p-0.5 gap-0.5">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
            side === "buy" ? "bg-neon text-obsidian" : "text-muted hover:text-silver"
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
            side === "sell" ? "bg-crimson text-white" : "text-muted hover:text-silver"
          }`}
        >
          Sell
        </button>
      </div>

      <label className="block space-y-1 text-xs">
        <span className="text-muted">Symbol / ชื่อหุ้น</span>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="w-full rounded-lg border border-graphite bg-slate px-3 py-2 font-mono text-sm uppercase outline-none focus:border-electric/50"
        />
      </label>

      <label className="block space-y-1 text-xs">
        <span className="text-muted">Price ($)</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-graphite bg-slate px-3 py-2 font-mono text-sm outline-none focus:border-electric/50"
        />
      </label>

      <label className="block space-y-1 text-xs">
        <span className="text-muted">Amount USD ($)</span>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amountUsd}
          onChange={(e) => setAmountUsd(e.target.value)}
          placeholder={side === "sell" && maxSellUsd > 0 ? maxSellUsd.toFixed(2) : "500"}
          className="w-full rounded-lg border border-graphite bg-slate px-3 py-2 font-mono text-sm outline-none focus:border-electric/50"
        />
      </label>

      {side === "sell" && heldForSymbol > 0 && maxSellUsd > 0 && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">
            ขายได้สูงสุด ~${maxSellUsd.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setAmountUsd(maxSellUsd.toFixed(2))}
            className="rounded-md border border-crimson/30 bg-crimson/10 px-2 py-1 font-mono text-crimson hover:bg-crimson/20"
          >
            ขายทั้งหมด
          </button>
        </div>
      )}

      {side === "sell" && heldForSymbol <= 0 && (
        <p className="text-xs text-amber">ไม่มีหุ้น {sym} ในพอร์ตจำลอง</p>
      )}

      <div className="rounded-lg bg-slate px-3 py-2 text-xs">
        <span className="text-muted">Quantity (คำนวณอัตโนมัติ)</span>
        <p className="font-mono text-base font-bold text-white mt-0.5">
          {quantity > 0 ? quantity.toFixed(4) : "—"} หุ้น
        </p>
      </div>

      <div className="text-xs text-muted flex justify-between">
        <span>เงินสดจำลอง: ${cashAvailable.toLocaleString()}</span>
        {heldForSymbol > 0 && (
          <span>ถือ {symbol}: {heldForSymbol.toFixed(4)} หุ้น</span>
        )}
      </div>

      {error && <p className="text-xs text-crimson">{error}</p>}
      {lastStatus && (
        <p className={`text-xs font-semibold ${side === "buy" ? "text-neon" : "text-crimson"}`}>
          ✓ {lastStatus}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          side === "buy"
            ? "bg-neon text-obsidian hover:bg-neon/90"
            : "bg-crimson text-white hover:bg-crimson/90"
        }`}
      >
        {loading
          ? "กำลังบันทึก..."
          : side === "buy"
            ? "Paper Buy"
            : "Paper Sell"}
      </button>
    </form>
  );
}
