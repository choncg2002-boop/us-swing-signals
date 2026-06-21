import logging
import time
from typing import Optional

import pandas as pd

from app.config import get_settings
from app.data.universe import get_scan_universe
from app.data.yfinance_client import yfinance_client
from app.indicators.calculator import indicator_calc
from app.indicators.fibonacci import compute_fibonacci_plan
from app.strategy.models import (
    ConditionCheck,
    FibonacciPlan,
    IndicatorOverview,
    RelativeStrengthBias,
    ScanSummary,
    ScoreBreakdown,
    SignalResult,
    TimeframeAnalysis,
    TradePlan,
    TrendBias,
    Verdict,
    VolumeBias,
)


class TechnicalTradeScanner:
    """
    Short-term swing (≤3 months) technical analysis.

    Indicators: EMA20, SMA50, SMA200, RSI(14), MACD(12,26,9),
    Volume vs MA20, ATR(14), Relative Strength vs market benchmark.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self._benchmark_df: Optional[pd.DataFrame] = None

    def _get_benchmark_closes(self, force_refresh: bool = False) -> pd.Series:
        bench = self.settings.market_benchmark
        if self._benchmark_df is None or force_refresh:
            df = yfinance_client.fetch_analysis_ohlcv(bench, force_refresh=force_refresh)
            self._benchmark_df = df
        if self._benchmark_df is None or self._benchmark_df.empty:
            return pd.Series(dtype=float)
        return self._benchmark_df["Close"]

    def _analyze_timeframe(self, df: pd.DataFrame) -> tuple[TrendBias, TrendBias]:
        enriched = indicator_calc.compute_all(df)
        latest = enriched.iloc[-1]
        price = float(latest["Close"])
        ema20 = float(latest["EMA20"])
        sma50 = float(latest["SMA50"])
        sma200 = float(latest["SMA200"])
        rsi14 = float(latest["RSI14"])
        macd = float(latest["MACD"])
        macd_signal = float(latest["MACD_Signal"])
        macd_hist = float(latest["MACD_Hist"])

        trend = TrendBias(indicator_calc.trend_bias(price, ema20, sma50, sma200))
        momentum = TrendBias(
            indicator_calc.momentum_bias(rsi14, macd, macd_signal, macd_hist)
        )
        return trend, momentum

    def _build_trade_plan(
        self,
        df: pd.DataFrame,
        entry: float,
        ema20: float,
        sma50: float,
        atr14: float,
        entry_conditions: list[str],
        all_long_ready: bool,
    ) -> Optional[TradePlan]:
        settings = self.settings

        structural_sl = min(ema20, sma50) * 0.99
        atr_sl = entry - settings.atr_sl_multiplier * atr14
        stop_loss = max(structural_sl, atr_sl)

        if stop_loss >= entry:
            stop_loss = entry * (1 - settings.max_risk_pct / 100)

        risk = entry - stop_loss
        if risk <= 0:
            return None

        risk_pct = (risk / entry) * 100
        if risk_pct > settings.max_risk_pct:
            stop_loss = entry * (1 - settings.max_risk_pct / 100)
            risk = entry - stop_loss
            risk_pct = settings.max_risk_pct

        recent_high = float(df["High"].iloc[-20:].max())
        target_1 = entry + risk * settings.min_rrr
        target_2 = max(entry + risk * 3, recent_high)

        reward_t1 = target_1 - entry
        reward_t2 = target_2 - entry
        rrr = reward_t1 / risk if risk > 0 else 0

        if rrr < settings.min_rrr:
            target_1 = entry + risk * settings.min_rrr
            reward_t1 = target_1 - entry
            rrr = settings.min_rrr

        suggested_shares = settings.risk_per_trade_usd / risk

        if all_long_ready:
            hold = "2–8 สัปดาห์"
        else:
            hold = "2–12 สัปดาห์ (รอเงื่อนไขก่อนเข้า)"

        return TradePlan(
            entry=round(entry, 2),
            entry_conditions=entry_conditions,
            stop_loss=round(stop_loss, 2),
            target_1=round(target_1, 2),
            target_2=round(target_2, 2),
            reward_risk=round(rrr, 2),
            risk_per_share=round(risk, 2),
            risk_pct=round(risk_pct, 2),
            reward_pct_t1=round((reward_t1 / entry) * 100, 2),
            reward_pct_t2=round((reward_t2 / entry) * 100, 2),
            suggested_shares=round(suggested_shares, 1),
            hold_period=hold,
        )

    def _score_trend(
        self,
        price: float,
        ema20: float,
        sma50: float,
        sma200: float,
        ema_cross: bool,
        sma200_ok: bool,
        weekly_trend: TrendBias,
        weekly_above_sma200: bool,
    ) -> float:
        score = 0.0
        if price > ema20:
            score += 5
        if price > sma50:
            score += 5
        if sma200_ok:
            score += 5
        if ema_cross:
            score += 5
        if weekly_trend == TrendBias.BULLISH:
            score += 5
        elif weekly_trend == TrendBias.NEUTRAL:
            score += 2
        if weekly_above_sma200:
            score += 5
        return min(30, score)

    def _score_momentum(
        self,
        rsi14: float,
        macd: float,
        macd_signal: float,
        macd_hist: float,
    ) -> float:
        s = self.settings
        score = 0.0
        if s.rsi_entry_low <= rsi14 <= s.rsi_entry_high:
            score += 10
        elif 45 <= rsi14 < s.rsi_entry_low:
            score += 5
        elif s.rsi_entry_high < rsi14 <= 75:
            score += 3

        if macd > macd_signal:
            score += 8
        if macd_hist > 0:
            score += 7
        return min(25, score)

    def _score_volume(self, volume_ratio: float, price_up: bool) -> float:
        if pd.isna(volume_ratio):
            return 0
        if volume_ratio >= 1.5:
            return 15
        if volume_ratio >= 1.2:
            return 10
        if volume_ratio >= 1.0:
            return 5
        if price_up and volume_ratio < 1.0:
            return 0
        return 3

    def _score_relative_strength(self, rs: Optional[float]) -> float:
        if rs is None:
            return 7
        if rs > 0.01:
            return 15
        if rs > -0.01:
            return 7
        return 0

    def _score_risk_reward(self, rrr: float, atr_pct: float) -> float:
        score = 0.0
        if rrr >= 3:
            score = 15
        elif rrr >= 2:
            score = 12
        elif rrr >= 1.5:
            score = 6
        if atr_pct > 5:
            score = max(0, score - 3)
        return score

    def _build_checklist(
        self,
        price: float,
        ema20: float,
        sma50: float,
        sma200: float,
        rsi14: float,
        macd: float,
        macd_signal: float,
        macd_hist: float,
        volume_ratio: float,
        rs: Optional[float],
        ema_cross: bool,
        sma200_ok: bool,
        rrr: float,
    ) -> list[ConditionCheck]:
        s = self.settings
        rs_ok = rs is not None and rs > 0
        rsi_ok = s.rsi_entry_low <= rsi14 <= s.rsi_entry_high
        macd_ok = macd > macd_signal and macd_hist > 0
        vol_ok = volume_ratio >= s.volume_multiplier if pd.notna(volume_ratio) else False
        rrr_ok = rrr >= s.min_rrr

        rs_detail = (
            f"RS vs {s.market_benchmark} = {rs * 100:+.1f}% (20D)"
            if rs is not None
            else "ข้อมูล RS ไม่พอ"
        )

        return [
            ConditionCheck(
                id="trend",
                label="ราคา > EMA20 และ SMA50",
                passed=price > ema20 and price > sma50,
                detail=f"${price:.2f} | EMA20 ${ema20:.2f} | SMA50 ${sma50:.2f}",
            ),
            ConditionCheck(
                id="ema_cross",
                label="EMA20 > SMA50 หรือกำลังตัดขึ้น",
                passed=ema_cross,
                detail="EMA20 นำเทรน" if ema_cross else "EMA20 ยังไม่นำ SMA50",
            ),
            ConditionCheck(
                id="sma200",
                label="ยืนเหนือ SMA200 หรือ reclaim",
                passed=sma200_ok,
                detail=f"SMA200 ${sma200:.2f}" if not pd.isna(sma200) else "SMA200 ยังไม่พร้อม",
            ),
            ConditionCheck(
                id="rsi",
                label=f"RSI(14) อยู่ {s.rsi_entry_low:.0f}–{s.rsi_entry_high:.0f}",
                passed=rsi_ok,
                detail=f"RSI = {rsi14:.1f}",
            ),
            ConditionCheck(
                id="macd",
                label="MACD > Signal และ Histogram บวก",
                passed=macd_ok,
                detail=f"MACD {macd:.3f} / Signal {macd_signal:.3f} / Hist {macd_hist:.3f}",
            ),
            ConditionCheck(
                id="volume",
                label=f"Volume ≥ {s.volume_multiplier}x MA20",
                passed=vol_ok,
                detail=f"{volume_ratio:.2f}x" if pd.notna(volume_ratio) else "—",
            ),
            ConditionCheck(
                id="rs",
                label=f"Relative Strength > {s.market_benchmark}",
                passed=rs_ok,
                detail=rs_detail,
            ),
            ConditionCheck(
                id="rrr",
                label=f"Reward/Risk ≥ {s.min_rrr:.0f}:1",
                passed=rrr_ok,
                detail=f"R:R = 1:{rrr:.1f}",
            ),
        ]

    def analyze_ticker(
        self,
        ticker: str,
        df: pd.DataFrame,
        bench_closes: Optional[pd.Series] = None,
    ) -> SignalResult:
        settings = self.settings

        if df is None or df.empty or len(df) < settings.sma_long_period + 10:
            raise ValueError(f"Insufficient OHLCV data for {ticker}")

        daily = indicator_calc.compute_all(df)
        latest = daily.iloc[-1]
        prev = daily.iloc[-2]

        price = float(latest["Close"])
        ema20 = float(latest["EMA20"])
        sma50 = float(latest["SMA50"])
        sma200 = float(latest["SMA200"]) if pd.notna(latest["SMA200"]) else float("nan")
        rsi14 = float(latest["RSI14"])
        macd = float(latest["MACD"])
        macd_signal = float(latest["MACD_Signal"])
        macd_hist = float(latest["MACD_Hist"])
        vol_ratio = float(latest["Volume_Ratio"]) if pd.notna(latest["Volume_Ratio"]) else 0.0
        atr14 = float(latest["ATR14"]) if pd.notna(latest["ATR14"]) else 0.0
        atr_pct = (atr14 / price * 100) if price > 0 else 0.0
        price_up = price > float(prev["Close"])

        weekly_df = indicator_calc.resample_weekly(df)
        weekly_trend, weekly_momentum = self._analyze_timeframe(weekly_df)
        weekly_enriched = indicator_calc.compute_all(weekly_df)
        weekly_latest = weekly_enriched.iloc[-1]
        weekly_sma200 = weekly_latest.get("SMA200")
        if pd.notna(weekly_sma200):
            weekly_above_sma200 = float(weekly_latest["Close"]) > float(weekly_sma200)
        else:
            weekly_above_sma200 = not pd.isna(sma200) and price > sma200

        daily_trend, daily_momentum = self._analyze_timeframe(df)

        if bench_closes is None:
            bench_closes = self._get_benchmark_closes()
        rs = indicator_calc.relative_strength_vs_benchmark(
            daily["Close"],
            bench_closes,
            settings.rs_lookback,
        )

        ema_cross = indicator_calc.ema_above_sma_or_crossing(daily["EMA20"], daily["SMA50"])
        sma200_ok = indicator_calc.above_or_reclaiming_sma200(daily["Close"], daily["SMA200"])

        # Hard blockers
        blockers: list[str] = []
        if not pd.isna(sma200) and price < sma200 and indicator_calc.sma_pointing_down(
            daily["SMA50"]
        ):
            blockers.append("ราคาต่ำกว่า SMA200 และ SMA50 ชี้ลง")
        if rsi14 < settings.rsi_avoid_low:
            blockers.append(f"RSI ต่ำเกินไป ({rsi14:.1f})")
        if rsi14 > settings.rsi_avoid_high:
            blockers.append(f"RSI สูงเกินไป ({rsi14:.1f})")
        if macd < macd_signal:
            blockers.append("MACD ยังต่ำกว่า Signal line")
        if price_up and vol_ratio < 1.0:
            blockers.append("Volume เบาในวันที่ราคาขึ้น")
        if price < ema20 and vol_ratio >= 1.5:
            blockers.append("ราคาหลุด EMA20 พร้อม volume สูง")

        # Preliminary trade plan for R:R scoring
        pre_plan = self._build_trade_plan(
            df, price, ema20, sma50, atr14, [], False
        )
        rrr = pre_plan.reward_risk if pre_plan else 0.0

        if pre_plan and rrr < settings.min_rrr:
            blockers.append(f"Reward/Risk ต่ำกว่า {settings.min_rrr:.0f}:1")

        trend_score = self._score_trend(
            price, ema20, sma50, sma200, ema_cross, sma200_ok,
            weekly_trend, weekly_above_sma200,
        )
        momentum_score = self._score_momentum(rsi14, macd, macd_signal, macd_hist)
        volume_score = self._score_volume(vol_ratio, price_up)
        rs_score = self._score_relative_strength(rs)
        rr_score = self._score_risk_reward(rrr, atr_pct)
        total_score = min(100, trend_score + momentum_score + volume_score + rs_score + rr_score)

        checklist = self._build_checklist(
            price, ema20, sma50, sma200, rsi14, macd, macd_signal, macd_hist,
            vol_ratio, rs, ema_cross, sma200_ok, rrr,
        )
        missing = [c.label for c in checklist if not c.passed]
        long_ready = len(missing) == 0

        entry_conditions = (
            ["เงื่อนไขครบ — เข้าได้ที่ราคาตลาดหรือย่อมา EMA20"]
            if long_ready
            else [f"รอ: {m}" for m in missing]
        )

        trade_plan = self._build_trade_plan(
            df, price, ema20, sma50, atr14, entry_conditions, long_ready
        )

        fib_raw = compute_fibonacci_plan(
            df, price, ema20=ema20, sma50=sma50, macd=macd, macd_signal=macd_signal
        )
        fibonacci_plan = (
            FibonacciPlan(
                trend=fib_raw.trend,
                swing_high=fib_raw.swing_high,
                swing_low=fib_raw.swing_low,
                fib_382=fib_raw.fib_382,
                fib_500=fib_raw.fib_500,
                fib_618=fib_raw.fib_618,
                action=fib_raw.action,
                action_reason=fib_raw.action_reason,
                entry_low=fib_raw.entry_low,
                entry_high=fib_raw.entry_high,
                take_profit=fib_raw.take_profit,
                stop_loss=fib_raw.stop_loss,
                reward_pct=fib_raw.reward_pct,
                risk_pct=fib_raw.risk_pct,
                reward_risk=fib_raw.reward_risk,
                indicator_note=fib_raw.indicator_note,
            )
            if fib_raw
            else None
        )

        overview = IndicatorOverview(
            trend=TrendBias(indicator_calc.trend_bias(price, ema20, sma50, sma200)),
            momentum=TrendBias(
                indicator_calc.momentum_bias(rsi14, macd, macd_signal, macd_hist)
            ),
            volume=VolumeBias(indicator_calc.volume_bias(vol_ratio, price_up)),
            relative_strength=RelativeStrengthBias(indicator_calc.rs_bias(rs)),
            atr14=round(atr14, 2),
            atr_pct=round(atr_pct, 2),
        )

        score_breakdown = ScoreBreakdown(
            trend=round(trend_score, 1),
            momentum=round(momentum_score, 1),
            volume=round(volume_score, 1),
            relative_strength=round(rs_score, 1),
            risk_reward=round(rr_score, 1),
            total=round(total_score, 1),
        )

        if blockers or total_score < 40:
            verdict = Verdict.AVOID
            reason = blockers[0] if blockers else f"คะแนนเทคนิคต่ำ ({total_score:.0f}/100)"
        elif long_ready and total_score >= 70:
            verdict = Verdict.ENTRY_READY
            reason = f"เงื่อนไข Long ครบ 8/8 · คะแนน {total_score:.0f}/100"
        else:
            verdict = Verdict.WAIT
            reason = f"ยังไม่ครบ — ขาด {len(missing)} เงื่อนไข · คะแนน {total_score:.0f}/100"

        return SignalResult(
            ticker=ticker,
            verdict=verdict,
            score=round(total_score, 1),
            overview=overview,
            score_breakdown=score_breakdown,
            trade_plan=trade_plan,
            fibonacci_plan=fibonacci_plan,
            daily=TimeframeAnalysis(
                timeframe="daily",
                trend=daily_trend,
                momentum=daily_momentum,
            ),
            weekly=TimeframeAnalysis(
                timeframe="weekly",
                trend=weekly_trend,
                momentum=weekly_momentum,
            ),
            verdict_reason=reason,
            checklist=checklist,
            missing_conditions=missing,
            blockers=blockers,
            price=round(price, 2),
            ema20=round(ema20, 2),
            sma50=round(sma50, 2),
            sma200=round(sma200, 2) if not pd.isna(sma200) else 0.0,
            rsi14=round(rsi14, 1),
            macd=round(macd, 4),
            macd_signal=round(macd_signal, 4),
            macd_histogram=round(macd_hist, 4),
            volume_ratio=round(vol_ratio, 2),
            relative_strength=round(rs * 100, 2) if rs is not None else None,
        )

    def scan_universe(
        self,
        tickers: Optional[list[str]] = None,
        force_refresh: bool = False,
    ) -> ScanSummary:
        start = time.time()
        universe = get_scan_universe(tickers)
        bench_closes = self._get_benchmark_closes(force_refresh)

        ohlcv_map = yfinance_client.fetch_batch_daily(universe, force_refresh)

        results: list[SignalResult] = []

        for ticker, df in ohlcv_map.items():
            try:
                result = self.analyze_ticker(ticker, df, bench_closes)
                if result.verdict != Verdict.AVOID:
                    results.append(result)
            except Exception as exc:
                logging.getLogger(__name__).debug("Skip %s: %s", ticker, exc)
                continue

        results.sort(key=lambda item: item.score, reverse=True)

        return ScanSummary(
            total_scanned=len(ohlcv_map),
            signals_found=len(results),
            entry_ready_count=sum(1 for r in results if r.verdict == Verdict.ENTRY_READY),
            wait_count=sum(1 for r in results if r.verdict == Verdict.WAIT),
            avoid_count=0,
            results=results,
            scan_duration_sec=round(time.time() - start, 2),
        )


scanner = TechnicalTradeScanner()
