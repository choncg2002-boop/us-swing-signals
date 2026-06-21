import { useState, type FormEvent } from "react";
import type { PortfolioSummary } from "../../types/portfolio";
import { depositCash, withdrawCash } from "../../api/client";

interface Props {
  cashAvailable: number;
  onSuccess: (portfolio: PortfolioSummary) => void;
  disabled?: boolean;
}

export default function PaperCashPanel({ cashAvailable, onSuccess, disabled = false }: Props) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loading, setLoading] = useState<"deposit" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const dep = parseFloat(depositAmount) || 0;
  const wit = parseFloat(withdrawAmount) || 0;
  const canDeposit = dep > 0 && !loading && !disabled;
  const canWithdraw = wit > 0 && wit <= cashAvailable + 0.01 && !loading && !disabled;

  const handleDeposit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canDeposit) return;

    setError(null);
    setLastMessage(null);
    setLoading("deposit");
    try {
      const updated = await depositCash(dep);
      setDepositAmount("");
      setLastMessage(`เข้าเงิน $${dep.toFixed(2)} สำเร็จ`);
      onSuccess(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าเงินไม่สำเร็จ");
    } finally {
      setLoading(null);
    }
  };

  const handleWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWithdraw) return;

    setError(null);
    setLastMessage(null);
    setLoading("withdraw");
    try {
      const updated = await withdrawCash(wit);
      setWithdrawAmount("");
      setLastMessage(`ถอนเงิน $${wit.toFixed(2)} สำเร็จ`);
      onSuccess(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ถอนเงินไม่สำเร็จ");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-graphite bg-charcoal p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-silver">เงินสดจำลอง</h3>
        <p className="font-mono text-xl font-bold text-electric mt-1">
          ${cashAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      <form onSubmit={handleDeposit} className="space-y-2">
        <label className="block space-y-1 text-xs">
          <span className="text-muted">เข้าเงิน (USD)</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="1000"
            className="w-full rounded-lg border border-graphite bg-slate px-3 py-2 font-mono text-sm outline-none focus:border-neon/50"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {[1000, 5000, 10000].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setDepositAmount(String(q))}
              className="rounded-md border border-graphite bg-slate px-2 py-1 text-xs font-mono text-silver hover:border-neon/40"
            >
              +${q.toLocaleString()}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={!canDeposit}
          className="w-full rounded-lg py-2 text-sm font-semibold bg-neon/15 border border-neon/40 text-neon hover:bg-neon/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading === "deposit" ? "กำลังเข้าเงิน..." : "เข้าเงิน"}
        </button>
      </form>

      <form onSubmit={handleWithdraw} className="space-y-2 border-t border-graphite pt-4">
        <label className="block space-y-1 text-xs">
          <span className="text-muted">ถอนเงิน (USD)</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="500"
            className="w-full rounded-lg border border-graphite bg-slate px-3 py-2 font-mono text-sm outline-none focus:border-crimson/50"
          />
        </label>
        {cashAvailable > 0 && (
          <button
            type="button"
            onClick={() => setWithdrawAmount(cashAvailable.toFixed(2))}
            className="text-xs font-mono text-crimson hover:underline"
          >
            ถอนทั้งหมด (${cashAvailable.toFixed(2)})
          </button>
        )}
        <button
          type="submit"
          disabled={!canWithdraw}
          className="w-full rounded-lg py-2 text-sm font-semibold bg-crimson/15 border border-crimson/40 text-crimson hover:bg-crimson/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading === "withdraw" ? "กำลังถอน..." : "ถอนเงิน"}
        </button>
      </form>

      {error && <p className="text-xs text-crimson">{error}</p>}
      {lastMessage && <p className="text-xs font-semibold text-neon">✓ {lastMessage}</p>}
    </div>
  );
}
