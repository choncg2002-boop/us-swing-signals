"""Fibonacci retracement for short-term swing trading (≤3 months)."""

from dataclasses import dataclass
from typing import Literal, Optional

import pandas as pd

FibAction = Literal["ซื้อ", "ขาย", "รอ"]
FibTrend = Literal["ขาขึ้น", "ขาลง"]


@dataclass
class FibonacciLevels:
    trend: FibTrend
    swing_high: float
    swing_low: float
    current_price: float
    fib_382: float
    fib_500: float
    fib_618: float
    action: FibAction
    action_reason: str
    entry_low: float
    entry_high: float
    take_profit: float
    stop_loss: float
    reward_pct: float
    risk_pct: float
    reward_risk: float
    indicator_note: str


def _find_swings(df: pd.DataFrame, lookback: int) -> tuple[float, float, FibTrend]:
    window = df.tail(lookback)
    swing_high = float(window["High"].max())
    swing_low = float(window["Low"].min())

    high_idx = window["High"].idxmax()
    low_idx = window["Low"].idxmin()
    trend: FibTrend = "ขาขึ้น" if low_idx <= high_idx else "ขาลง"
    return swing_high, swing_low, trend


def compute_fibonacci_plan(
    df: pd.DataFrame,
    price: float,
    *,
    lookback: int = 63,
    ema20: float = 0.0,
    sma50: float = 0.0,
    macd: float = 0.0,
    macd_signal: float = 0.0,
) -> Optional[FibonacciLevels]:
    """Build Fibonacci retracement plan from recent swing high/low (~3 months)."""
    if df is None or len(df) < 20:
        return None

    lookback = min(lookback, len(df))
    swing_high, swing_low, trend = _find_swings(df, lookback)
    span = swing_high - swing_low
    if span <= 0:
        return None

    macd_bearish = macd < macd_signal
    below_ema = ema20 > 0 and price < ema20
    indicator_bits: list[str] = []
    if below_ema:
        indicator_bits.append("ราคาหลุด EMA20")
    if macd_bearish:
        indicator_bits.append("MACD ตัดลง")
    indicator_note = " · ".join(indicator_bits) if indicator_bits else "ไม่มีสัญญาณเสียเพิ่ม"

    if trend == "ขาขึ้น":
        fib_382 = swing_high - 0.382 * span
        fib_500 = swing_high - 0.500 * span
        fib_618 = swing_high - 0.618 * span

        if price > swing_high:
            action: FibAction = "รอ"
            reason = "ราคาทำ high ใหม่ — รอ pullback มาโซน 38.2–61.8%"
            entry_low, entry_high = fib_618, fib_382
        elif price >= fib_382:
            action = "รอ"
            reason = "Pullback ตื้น — รอย่อลงโซน 50–61.8% ก่อนเข้า"
            entry_low, entry_high = fib_618, fib_500
        elif price >= fib_618:
            action = "ซื้อ"
            reason = "ราคาอยู่โซนทอง 50–61.8% ของเทรนขาขึ้น"
            entry_low, entry_high = fib_618, fib_500
        elif price >= swing_low:
            action = "รอ"
            reason = "Pullback ลึกเกิน 61.8% — รอ confirm กลับเหนือ 61.8%"
            entry_low, entry_high = fib_618, fib_500
        else:
            action = "ขาย"
            reason = "หลุด Swing Low — โครงสร้างขาขึ้นเสีย"
            entry_low, entry_high = fib_500, fib_382

        take_profit = swing_high
        stop_loss = min(swing_low * 0.99, fib_618 - span * 0.05)
    else:
        fib_382 = swing_low + 0.382 * span
        fib_500 = swing_low + 0.500 * span
        fib_618 = swing_low + 0.618 * span

        if price < swing_low:
            action = "รอ"
            reason = "ราคาทำ low ใหม่ — รอ bounce มาโซน 38.2–61.8%"
            entry_low, entry_high = fib_382, fib_618
        elif price <= fib_618:
            action = "รอ"
            reason = "Bounce อ่อน — รอ reject ที่โซน 50–61.8%"
            entry_low, entry_high = fib_500, fib_618
        elif price <= fib_382:
            action = "ขาย"
            reason = "ราคาอยู่โซน 38.2–61.8% ของเทรนขาลง (short / หลีก long)"
            entry_low, entry_high = fib_618, fib_500
        elif price <= swing_high:
            action = "รอ"
            reason = "Bounce แรง — รอ reject ใกล้ 61.8% หรือ swing high"
            entry_low, entry_high = fib_618, fib_382
        else:
            action = "รอ"
            reason = "ทะลุ swing high — โครงสร้างขาลงเปลี่ยน"
            entry_low, entry_high = fib_500, fib_382

        take_profit = swing_low
        stop_loss = max(swing_high * 1.01, fib_618 + span * 0.05)

    if below_ema and action == "ซื้อ":
        action = "รอ"
        reason = f"{reason} · แต่ราคายังต่ำ EMA20 ควรรอ confirm"
    if macd_bearish and action == "ซื้อ":
        action = "รอ"
        reason = f"{reason} · MACD ยัง bearish"

    risk = abs(price - stop_loss)
    reward = abs(take_profit - price)
    risk_pct = (risk / price * 100) if price > 0 else 0.0
    reward_pct = (reward / price * 100) if price > 0 else 0.0
    rrr = (reward / risk) if risk > 0 else 0.0

    return FibonacciLevels(
        trend=trend,
        swing_high=round(swing_high, 2),
        swing_low=round(swing_low, 2),
        current_price=round(price, 2),
        fib_382=round(fib_382, 2),
        fib_500=round(fib_500, 2),
        fib_618=round(fib_618, 2),
        action=action,
        action_reason=reason,
        entry_low=round(min(entry_low, entry_high), 2),
        entry_high=round(max(entry_low, entry_high), 2),
        take_profit=round(take_profit, 2),
        stop_loss=round(stop_loss, 2),
        reward_pct=round(reward_pct, 2),
        risk_pct=round(risk_pct, 2),
        reward_risk=round(rrr, 2),
        indicator_note=indicator_note,
    )
