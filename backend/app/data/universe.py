"""S&P 500 universe loader with cache and Wikipedia fallback."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd

from app.config import get_settings
from app.core.cache import cache

logger = logging.getLogger(__name__)

BUNDLE_PATH = Path(__file__).resolve().parent / "sp500_tickers.json"
WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
CACHE_KEY = "universe:sp500"
CACHE_TTL = 86400 * 7  # refresh weekly


def _normalize_symbol(symbol: str) -> str:
    """Yahoo Finance uses dashes instead of dots (BRK.B -> BRK-B)."""
    return symbol.strip().upper().replace(".", "-")


def _load_bundle() -> list[str]:
    if not BUNDLE_PATH.exists():
        return []
    payload = json.loads(BUNDLE_PATH.read_text(encoding="utf-8"))
    return [_normalize_symbol(t) for t in payload.get("tickers", [])]


def _save_bundle(tickers: list[str]) -> None:
    payload = {
        "source": "wikipedia",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(tickers),
        "tickers": sorted(tickers),
    }
    BUNDLE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _fetch_from_wikipedia() -> list[str]:
    import io

    import requests

    headers = {
        "User-Agent": "US-Swing-Signals/1.0 (fintech; contact@example.com)",
    }
    response = requests.get(WIKIPEDIA_URL, headers=headers, timeout=30)
    response.raise_for_status()
    tables = pd.read_html(io.StringIO(response.text))
    df = tables[0]
    column = "Symbol" if "Symbol" in df.columns else df.columns[0]
    tickers = [_normalize_symbol(str(s)) for s in df[column].tolist()]
    return sorted(set(tickers))


def get_sp500_tickers(force_refresh: bool = False) -> list[str]:
    settings = get_settings()

    if not force_refresh:
        cached = cache.get(CACHE_KEY)
        if cached and isinstance(cached, list) and len(cached) > 400:
            return cached

    tickers: list[str] = []

    if not force_refresh:
        tickers = _load_bundle()

    if len(tickers) < 400 or force_refresh:
        try:
            tickers = _fetch_from_wikipedia()
            _save_bundle(tickers)
            logger.info("Loaded %d S&P 500 tickers from Wikipedia", len(tickers))
        except Exception as exc:
            logger.warning("Wikipedia fetch failed: %s", exc)
            if not tickers:
                tickers = [_normalize_symbol(t) for t in settings.default_tickers]

    cache.set(CACHE_KEY, tickers, ttl=CACHE_TTL)
    return tickers


def get_scan_universe(tickers: Optional[list[str]] = None) -> list[str]:
    """Resolve ticker list for scanner: explicit > S&P 500 > defaults."""
    if tickers:
        return [_normalize_symbol(t) for t in tickers]

    settings = get_settings()
    if settings.use_sp500_universe:
        return get_sp500_tickers()

    return [_normalize_symbol(t) for t in settings.default_tickers]
