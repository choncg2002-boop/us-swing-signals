from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.paths import resolve_paths_from_settings


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "US Swing Signals"
    debug: bool = True

    redis_url: str = "redis://localhost:6379/0"
    use_redis: bool = False

    batch_size: int = 50
    batch_delay_sec: float = 2.0
    max_retries: int = 3
    backoff_base_sec: float = 30.0

    ohlcv_cache_ttl: int = 86400
    price_cache_ttl: int = 60
    signal_cache_ttl: int = 300

    runtime_dir: Optional[str] = None
    cache_dir: Optional[str] = None
    yfinance_cache_dir: Optional[str] = None

    # Indicators
    ema_short_period: int = 20
    sma_mid_period: int = 50
    sma_long_period: int = 200
    rsi_period: int = 14
    rsi_entry_low: float = 50.0
    rsi_entry_high: float = 70.0
    rsi_avoid_low: float = 45.0
    rsi_avoid_high: float = 75.0
    volume_ma_period: int = 20
    volume_multiplier: float = 1.5
    atr_period: int = 14
    atr_sl_multiplier: float = 1.5
    market_benchmark: str = "SPY"
    rs_lookback: int = 20
    min_rrr: float = 2.0
    max_risk_pct: float = 5.0
    risk_per_trade_usd: float = 500.0
    analysis_period: str = "5y"
    scan_period: str = "2y"

    # Universe
    use_sp500_universe: bool = True

    # WebSocket / streaming
    price_poll_interval_sec: int = 60
    scan_cron_hour: int = 6
    scan_cron_minute: int = 0

    # Comma-separated origins for CORS (use * for public API)
    cors_origins: str = "*"

    # Paper portfolio starting cash
    portfolio_initial_cash: float = 100_000.0

    # Paper order history — เคลียร์ทุกวัน (เวลาไทย)
    order_history_clear_hour: int = 0
    order_history_clear_minute: int = 0
    order_history_timezone: str = "Asia/Bangkok"

    default_tickers: list[str] = [
        "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA",
        "JPM", "V", "UNH", "XOM", "LLY", "AVGO", "MA", "HD",
        "PG", "COST", "JNJ", "ABBV", "CRM", "AMD", "NFLX", "ADBE",
    ]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    resolve_paths_from_settings(
        runtime_dir=settings.runtime_dir,
        cache_dir=settings.cache_dir,
        yfinance_cache_dir=settings.yfinance_cache_dir,
    )
    return settings
