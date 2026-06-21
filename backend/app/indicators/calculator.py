import numpy as np
import pandas as pd

from app.config import get_settings


class IndicatorCalculator:
    """EMA, SMA, RSI, MACD, ATR, volume, and relative strength."""

    def __init__(self) -> None:
        self.settings = get_settings()

    @staticmethod
    def ema(series: pd.Series, period: int) -> pd.Series:
        return series.ewm(span=period, adjust=False).mean()

    @staticmethod
    def sma(series: pd.Series, period: int) -> pd.Series:
        return series.rolling(period).mean()

    @staticmethod
    def rsi(series: pd.Series, period: int = 14) -> pd.Series:
        delta = series.diff()
        gain = delta.where(delta > 0, 0.0)
        loss = (-delta).where(delta < 0, 0.0)
        avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        return 100 - (100 / (1 + rs))

    @staticmethod
    def macd(
        series: pd.Series,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
    ) -> tuple[pd.Series, pd.Series, pd.Series]:
        ema_fast = series.ewm(span=fast, adjust=False).mean()
        ema_slow = series.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram

    @staticmethod
    def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
        high = df["High"]
        low = df["Low"]
        close = df["Close"]
        prev_close = close.shift(1)
        tr = pd.concat(
            [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
            axis=1,
        ).max(axis=1)
        return tr.rolling(period).mean()

    @staticmethod
    def resample_weekly(df: pd.DataFrame) -> pd.DataFrame:
        weekly = df.resample("W-FRI").agg(
            {
                "Open": "first",
                "High": "max",
                "Low": "min",
                "Close": "last",
                "Volume": "sum",
            }
        )
        return weekly.dropna()

    def compute_all(self, df: pd.DataFrame) -> pd.DataFrame:
        settings = self.settings
        out = df.copy()

        out["EMA20"] = self.ema(out["Close"], settings.ema_short_period)
        out["SMA50"] = self.sma(out["Close"], settings.sma_mid_period)
        out["SMA200"] = self.sma(out["Close"], settings.sma_long_period)
        out["RSI14"] = self.rsi(out["Close"], settings.rsi_period)
        macd, signal, hist = self.macd(out["Close"])
        out["MACD"] = macd
        out["MACD_Signal"] = signal
        out["MACD_Hist"] = hist
        out["Volume_MA20"] = out["Volume"].rolling(settings.volume_ma_period).mean()
        out["Volume_Ratio"] = out["Volume"] / out["Volume_MA20"]
        out["ATR14"] = self.atr(out, settings.atr_period)

        return out

    @staticmethod
    def relative_strength_vs_benchmark(
        stock_close: pd.Series,
        bench_close: pd.Series,
        lookback: int = 20,
    ) -> float | None:
        aligned = pd.concat([stock_close, bench_close], axis=1, join="inner").dropna()
        if len(aligned) < lookback + 1:
            return None

        stock_ret = aligned.iloc[-1, 0] / aligned.iloc[-lookback - 1, 0] - 1
        bench_ret = aligned.iloc[-1, 1] / aligned.iloc[-lookback - 1, 1] - 1
        return float(stock_ret - bench_ret)

    @staticmethod
    def ema_above_sma_or_crossing(
        ema: pd.Series,
        sma: pd.Series,
        lookback: int = 5,
    ) -> bool:
        if len(ema) < lookback + 1 or pd.isna(ema.iloc[-1]) or pd.isna(sma.iloc[-1]):
            return False
        if ema.iloc[-1] > sma.iloc[-1]:
            return True
        for i in range(-lookback, 0):
            prev = ema.iloc[i - 1] <= sma.iloc[i - 1]
            curr = ema.iloc[i] > sma.iloc[i]
            if prev and curr:
                return True
        return False

    @staticmethod
    def above_or_reclaiming_sma200(
        close: pd.Series,
        sma200: pd.Series,
        lookback: int = 10,
    ) -> bool:
        if len(close) < lookback + 1 or pd.isna(sma200.iloc[-1]):
            return False
        if close.iloc[-1] > sma200.iloc[-1]:
            return True
        for i in range(-lookback, 0):
            if close.iloc[i - 1] < sma200.iloc[i - 1] and close.iloc[i] > sma200.iloc[i]:
                return True
        return False

    @staticmethod
    def sma_pointing_down(sma: pd.Series, bars: int = 5) -> bool:
        if len(sma) < bars + 1 or pd.isna(sma.iloc[-1]) or pd.isna(sma.iloc[-bars]):
            return False
        return float(sma.iloc[-1]) < float(sma.iloc[-bars])

    @staticmethod
    def trend_bias(close: float, ema20: float, sma50: float, sma200: float) -> str:
        if any(pd.isna(v) for v in (ema20, sma50, sma200)):
            return "neutral"
        if close > ema20 > sma50 > sma200:
            return "bullish"
        if close < ema20 < sma50 < sma200:
            return "bearish"
        return "neutral"

    @staticmethod
    def momentum_bias(rsi: float, macd: float, macd_signal: float, macd_hist: float) -> str:
        if pd.isna(rsi) or pd.isna(macd) or pd.isna(macd_signal):
            return "neutral"
        if rsi >= 50 and macd > macd_signal and macd_hist > 0:
            return "bullish"
        if rsi < 45 or macd < macd_signal:
            return "bearish"
        return "neutral"

    @staticmethod
    def volume_bias(volume_ratio: float, price_up: bool) -> str:
        if pd.isna(volume_ratio):
            return "normal"
        if volume_ratio >= 1.5:
            return "accumulation"
        if price_up and volume_ratio < 1.0:
            return "distribution"
        return "normal"

    @staticmethod
    def rs_bias(rs: float | None) -> str:
        if rs is None:
            return "neutral"
        if rs > 0.01:
            return "outperform"
        if rs < -0.01:
            return "underperform"
        return "neutral"


indicator_calc = IndicatorCalculator()
