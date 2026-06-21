"""Background price polling and scheduled scans for WebSocket push."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import get_settings
from app.core.cache import cache
from app.core.websocket_manager import price_manager, signal_manager
from app.data.yfinance_client import yfinance_client
from app.portfolio.service import sync_order_history_day
from app.strategy.scanner import scanner

logger = logging.getLogger(__name__)

_scheduler: Optional[BackgroundScheduler] = None
_loop: Optional[asyncio.AbstractEventLoop] = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def _run_async(coro) -> None:
    if _loop and _loop.is_running():
        asyncio.run_coroutine_threadsafe(coro, _loop)
    else:
        asyncio.run(coro)


async def _broadcast_prices(prices: dict) -> None:
    for ticker, payload in prices.items():
        await price_manager.broadcast(f"price:{ticker}", {"type": "price_update", "data": payload})


async def _broadcast_scan_complete(summary: dict) -> None:
    await signal_manager.broadcast("signals", {"type": "scan_complete", "data": summary})


def poll_prices() -> None:
    """Fetch latest prices for all WS-subscribed tickers."""
    if _loop is None:
        return

    async def _poll() -> None:
        tickers = await price_manager.get_subscribed_tickers()
        if not tickers:
            return
        prices = yfinance_client.fetch_latest_prices(sorted(tickers))
        if prices:
            await _broadcast_prices(prices)

    _run_async(_poll())


def run_scheduled_scan() -> None:
    """Full S&P 500 scan, cache results, push via WebSocket."""
    if _loop is None:
        return

    async def _scan() -> None:
        from app.data.universe import get_scan_universe

        logger.info("Starting scheduled S&P 500 scan")
        universe = get_scan_universe()
        summary = scanner.scan_universe(universe, force_refresh=False)
        cache_key = f"scan:{','.join(universe[:5])}:{len(universe)}"
        cache.set(cache_key, summary.model_dump(), ttl=get_settings().signal_cache_ttl)
        await _broadcast_scan_complete(summary.model_dump())
        logger.info("Scan complete: %d signals", summary.signals_found)

    _run_async(_scan())


def run_daily_order_history_clear() -> None:
    """Clear paper order history at the start of each calendar day."""
    removed = sync_order_history_day()
    if removed:
        logger.info("Scheduled daily paper order clear: removed %d order(s)", removed)


def start_scheduler(loop: asyncio.AbstractEventLoop) -> BackgroundScheduler:
    global _scheduler, _loop
    _loop = loop
    settings = get_settings()

    if _scheduler is not None:
        return _scheduler

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        poll_prices,
        "interval",
        seconds=settings.price_poll_interval_sec,
        id="price_poll",
        replace_existing=True,
    )
    _scheduler.add_job(
        run_scheduled_scan,
        "cron",
        hour=settings.scan_cron_hour,
        minute=settings.scan_cron_minute,
        id="daily_scan",
        replace_existing=True,
    )
    _scheduler.add_job(
        run_daily_order_history_clear,
        "cron",
        hour=settings.order_history_clear_hour,
        minute=settings.order_history_clear_minute,
        timezone=settings.order_history_timezone,
        id="daily_order_clear",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "Scheduler started (price poll every %ss, scan at %02d:%02d UTC, "
        "order clear at %02d:%02d %s)",
        settings.price_poll_interval_sec,
        settings.scan_cron_hour,
        settings.scan_cron_minute,
        settings.order_history_clear_hour,
        settings.order_history_clear_minute,
        settings.order_history_timezone,
    )
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
