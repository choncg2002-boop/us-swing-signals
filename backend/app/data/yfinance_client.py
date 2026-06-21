from app.config import get_settings
from app.core.paths import configure_yfinance_environment

get_settings()  # load .env path overrides before yfinance/curl init
configure_yfinance_environment()

import yfinance as yf  # noqa: E402

from typing import Optional

import pandas as pd

from app.config import get_settings
from app.core.cache import cache
from app.core.rate_limiter import rate_limiter, with_retry


class YFinanceClient:
    """Fetch OHLCV with cache and rate limit protection."""

    PERIOD_MAP = {
        "1D": ("1y", "1d"),
        "1W": ("5y", "1wk"),
        "1M": ("10y", "1mo"),
        "1Y": ("max", "1mo"),
    }

    def __init__(self) -> None:
        self.settings = get_settings()

    def _cache_key(self, ticker: str, period: str, interval: str) -> str:
        return f"ohlcv:{ticker}:{period}:{interval}"

    @staticmethod
    def _serialize_df(df: pd.DataFrame) -> list[dict]:
        records = df.reset_index().rename(columns={"index": "Date"}).to_dict(orient="records")
        for row in records:
            date_val = row.get("Date")
            if hasattr(date_val, "isoformat"):
                row["Date"] = date_val.isoformat()
        return records

    @staticmethod
    def _deserialize_df(records: list[dict]) -> pd.DataFrame:
        df = pd.DataFrame(records)
        if "Date" in df.columns:
            df["Date"] = pd.to_datetime(df["Date"])
            df.set_index("Date", inplace=True)
        return df

    @with_retry()
    def fetch_ohlcv(
        self,
        ticker: str,
        timeframe: str = "1D",
        force_refresh: bool = False,
        period: Optional[str] = None,
    ) -> Optional[pd.DataFrame]:
        default_period, interval = self.PERIOD_MAP.get(timeframe, ("1y", "1d"))
        period = period or default_period
        cache_key = self._cache_key(ticker, period, interval)

        if not force_refresh:
            cached = cache.get(cache_key)
            if cached:
                return self._deserialize_df(cached)

        rate_limiter.sync_wait()

        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval=interval, auto_adjust=True)

        if df is None or df.empty:
            return None

        df.index = pd.to_datetime(df.index)
        if getattr(df.index, "tz", None) is not None:
            df.index = df.index.tz_localize(None)
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()

        cache.set(cache_key, self._serialize_df(df), ttl=self.settings.ohlcv_cache_ttl)
        return df

    def _parse_batch_download(
        self,
        raw: pd.DataFrame,
        batch: list[str],
        min_bars: int,
    ) -> dict[str, pd.DataFrame]:
        results: dict[str, pd.DataFrame] = {}
        if raw is None or raw.empty:
            return results

        if len(batch) == 1:
            ticker = batch[0]
            df = raw.copy()
            if len(df.columns.levels) > 1 if hasattr(df.columns, "levels") else False:
                df = raw[ticker].copy() if ticker in raw.columns.get_level_values(0) else raw
            df = self._normalize_ohlcv_df(df)
            if df is not None and len(df) >= min_bars:
                results[ticker] = df
            return results

        for ticker in batch:
            try:
                if ticker not in raw.columns.get_level_values(0):
                    continue
                df = raw[ticker].copy()
                df = self._normalize_ohlcv_df(df)
                if df is not None and len(df) >= min_bars:
                    results[ticker] = df
            except Exception:
                continue
        return results

    @staticmethod
    def _normalize_ohlcv_df(df: pd.DataFrame) -> Optional[pd.DataFrame]:
        if df is None or df.empty:
            return None
        df = df.dropna(how="all")
        df.columns = [str(c).title() for c in df.columns]
        required = {"Open", "High", "Low", "Close", "Volume"}
        if not required.issubset(set(df.columns)):
            return None
        df.index = pd.to_datetime(df.index)
        if getattr(df.index, "tz", None) is not None:
            df.index = df.index.tz_localize(None)
        return df[["Open", "High", "Low", "Close", "Volume"]].copy()

    @with_retry()
    def _download_batch(self, batch: list[str], period: str = "1y", interval: str = "1d") -> pd.DataFrame:
        rate_limiter.sync_wait()
        return yf.download(
            batch if len(batch) > 1 else batch[0],
            period=period,
            interval=interval,
            auto_adjust=True,
            group_by="ticker",
            threads=True,
            progress=False,
        )

    def fetch_analysis_ohlcv(
        self,
        ticker: str,
        force_refresh: bool = False,
    ) -> Optional[pd.DataFrame]:
        return self.fetch_ohlcv(
            ticker,
            timeframe="1D",
            force_refresh=force_refresh,
            period=self.settings.analysis_period,
        )

    def fetch_batch_daily(
        self,
        tickers: list[str],
        force_refresh: bool = False,
        period: Optional[str] = None,
    ) -> dict[str, pd.DataFrame]:
        results: dict[str, pd.DataFrame] = {}
        batch_size = self.settings.batch_size
        min_bars = self.settings.sma_long_period + 10
        period = period or self.settings.scan_period
        interval = "1d"

        for i in range(0, len(tickers), batch_size):
            batch = tickers[i : i + batch_size]

            if not force_refresh:
                batch_missing = []
                for ticker in batch:
                    cache_key = self._cache_key(ticker, period, interval)
                    cached = cache.get(cache_key)
                    if cached:
                        df = self._deserialize_df(cached)
                        if len(df) >= min_bars:
                            results[ticker] = df
                            continue
                    batch_missing.append(ticker)
                if not batch_missing:
                    continue
                batch = batch_missing

            try:
                raw = self._download_batch(batch, period, interval)
                parsed = self._parse_batch_download(raw, batch, min_bars)
                for ticker, df in parsed.items():
                    cache_key = self._cache_key(ticker, period, interval)
                    cache.set(cache_key, self._serialize_df(df), ttl=self.settings.ohlcv_cache_ttl)
                    results[ticker] = df
            except Exception:
                for ticker in batch:
                    df = self.fetch_ohlcv(
                        ticker,
                        timeframe="1D",
                        force_refresh=force_refresh,
                        period=period,
                    )
                    if df is not None and len(df) >= min_bars:
                        results[ticker] = df

        return results

    def fetch_latest_prices(self, tickers: list[str]) -> dict[str, dict]:
        """Fast snapshot for WebSocket price stream."""
        if not tickers:
            return {}

        unique = sorted(set(tickers))
        prices: dict[str, dict] = {}

        for i in range(0, len(unique), self.settings.batch_size):
            batch = unique[i : i + self.settings.batch_size]
            try:
                rate_limiter.sync_wait()
                raw = yf.download(
                    batch if len(batch) > 1 else batch[0],
                    period="1d",
                    interval="1m",
                    auto_adjust=True,
                    group_by="ticker",
                    threads=True,
                    progress=False,
                )
                now = pd.Timestamp.utcnow().isoformat()

                if len(batch) == 1:
                    ticker = batch[0]
                    df = self._normalize_ohlcv_df(raw)
                    if df is not None and not df.empty:
                        row = df.iloc[-1]
                        prices[ticker] = {
                            "ticker": ticker,
                            "price": round(float(row["Close"]), 2),
                            "open": round(float(row["Open"]), 2),
                            "high": round(float(row["High"]), 2),
                            "low": round(float(row["Low"]), 2),
                            "volume": int(row["Volume"]),
                            "updated_at": now,
                        }
                    continue

                for ticker in batch:
                    try:
                        if ticker not in raw.columns.get_level_values(0):
                            continue
                        df = self._normalize_ohlcv_df(raw[ticker])
                        if df is None or df.empty:
                            continue
                        row = df.iloc[-1]
                        prices[ticker] = {
                            "ticker": ticker,
                            "price": round(float(row["Close"]), 2),
                            "open": round(float(row["Open"]), 2),
                            "high": round(float(row["High"]), 2),
                            "low": round(float(row["Low"]), 2),
                            "volume": int(row["Volume"]),
                            "updated_at": now,
                        }
                    except Exception:
                        continue
            except Exception:
                continue

        return prices


yfinance_client = YFinanceClient()
