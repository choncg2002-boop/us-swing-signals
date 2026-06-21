from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from app.config import get_settings
from app.core.cache import cache
from app.data.universe import get_scan_universe, get_sp500_tickers
from app.data.yfinance_client import yfinance_client
from app.indicators.calculator import indicator_calc
from app.strategy.models import ScanSummary, SignalResult
from app.strategy.scanner import scanner

router = APIRouter(prefix="/api/v1")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": get_settings().app_name}


@router.get("/universe")
def get_universe(force_refresh: bool = Query(False)) -> dict:
    settings = get_settings()
    if settings.use_sp500_universe:
        tickers = get_sp500_tickers(force_refresh=force_refresh)
        return {"source": "sp500", "count": len(tickers), "tickers": tickers}
    tickers = settings.default_tickers
    return {"source": "custom", "count": len(tickers), "tickers": tickers}


@router.get("/signals", response_model=ScanSummary)
async def get_all_signals(
    force_refresh: bool = Query(False),
    tickers: Optional[str] = Query(None, description="Comma-separated tickers"),
) -> ScanSummary:
    ticker_list = [t.strip().upper() for t in tickers.split(",")] if tickers else None
    universe = get_scan_universe(ticker_list)
    cache_key = f"scan:{','.join(universe[:5])}:{len(universe)}"
    if not force_refresh:
        cached = cache.get(cache_key)
        if cached:
            return ScanSummary(**cached)

    summary = await run_in_threadpool(scanner.scan_universe, universe, force_refresh)
    cache.set(cache_key, summary.model_dump(), ttl=get_settings().signal_cache_ttl)
    return summary


@router.get("/signals/{ticker}", response_model=SignalResult)
def get_signal(ticker: str, force_refresh: bool = False) -> SignalResult:
    ticker = ticker.upper()
    df = yfinance_client.fetch_analysis_ohlcv(ticker, force_refresh=force_refresh)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {ticker}")
    return scanner.analyze_ticker(ticker, df)


@router.get("/ohlcv/{ticker}")
def get_ohlcv(
    ticker: str,
    tf: str = Query("1D", pattern="^(1D|1W|1M|1Y)$"),
    force_refresh: bool = False,
) -> dict:
    ticker = ticker.upper()
    df = yfinance_client.fetch_ohlcv(ticker, timeframe=tf, force_refresh=force_refresh)
    if df is None:
        raise HTTPException(status_code=404, detail=f"No OHLCV for {ticker}")

    records = df.reset_index().rename(columns={"Date": "date"}).to_dict(orient="records")
    for row in records:
        date_val = row.get("date")
        if hasattr(date_val, "isoformat"):
            row["date"] = date_val.isoformat()
    return {"ticker": ticker, "timeframe": tf, "data": records}


@router.get("/indicators/{ticker}")
def get_indicators(ticker: str) -> dict:
    ticker = ticker.upper()
    df = yfinance_client.fetch_analysis_ohlcv(ticker)
    if df is None:
        raise HTTPException(status_code=404, detail=f"No data for {ticker}")

    enriched = indicator_calc.compute_all(df)
    latest = enriched.iloc[-1]
    volume_ratio = latest["Volume_Ratio"]
    bench = yfinance_client.fetch_analysis_ohlcv(get_settings().market_benchmark)
    rs = None
    if bench is not None:
        rs = indicator_calc.relative_strength_vs_benchmark(
            enriched["Close"],
            bench["Close"],
            get_settings().rs_lookback,
        )
    return {
        "ticker": ticker,
        "ema20": round(float(latest["EMA20"]), 2),
        "sma50": round(float(latest["SMA50"]), 2),
        "sma200": round(float(latest["SMA200"]), 2),
        "rsi14": round(float(latest["RSI14"]), 1),
        "macd": round(float(latest["MACD"]), 4),
        "macd_signal": round(float(latest["MACD_Signal"]), 4),
        "macd_histogram": round(float(latest["MACD_Hist"]), 4),
        "atr14": round(float(latest["ATR14"]), 2),
        "volume_ratio": round(float(volume_ratio), 2) if pd.notna(volume_ratio) else None,
        "relative_strength": round(rs * 100, 2) if rs is not None else None,
    }
