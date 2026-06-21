from datetime import datetime
import logging
from zoneinfo import ZoneInfo

from app.config import get_settings
from app.data.yfinance_client import yfinance_client
from app.portfolio.models import (
    BuyOrderRequest,
    OrderRecord,
    OrderSide,
    PortfolioState,
    PortfolioSummary,
    Position,
    PositionView,
    SellOrderRequest,
    new_order_id,
)
from app.portfolio.store import load_state, save_state

logger = logging.getLogger(__name__)


def _order_history_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().order_history_timezone)


def _today_orders_day() -> str:
    return datetime.now(_order_history_tz()).strftime("%Y-%m-%d")


def sync_order_history_day() -> int:
    """Clear paper order history when the calendar day changes. Returns removed count."""
    state = load_state()
    today = _today_orders_day()
    if state.orders_day == today:
        return 0

    removed = len(state.orders) if state.orders_day is not None else 0
    if state.orders_day is not None:
        state.orders = []
    state.orders_day = today
    save_state(state)
    if removed:
        logger.info("Cleared %d paper order(s) — new day %s", removed, today)
    return removed


def _load_state() -> PortfolioState:
    sync_order_history_day()
    return load_state()


def _fetch_prices(tickers: list[str]) -> dict[str, float]:
    prices: dict[str, float] = {}
    for ticker in tickers:
        try:
            df = yfinance_client.fetch_analysis_ohlcv(ticker)
            if df is not None and not df.empty:
                prices[ticker] = round(float(df["Close"].iloc[-1]), 2)
        except Exception:
            continue
    return prices


def _build_summary(state: PortfolioState) -> PortfolioSummary:
    tickers = list(state.positions.keys())
    prices = _fetch_prices(tickers)

    positions: list[PositionView] = []
    invested = 0.0
    market_total = 0.0
    cost_total = 0.0

    for ticker, pos in state.positions.items():
        if pos.shares <= 0:
            continue
        current = prices.get(ticker)
        cost_basis = round(pos.shares * pos.avg_cost, 2)
        market_value = round(pos.shares * current, 2) if current else cost_basis
        pnl = round(market_value - cost_basis, 2)
        pnl_pct = round((pnl / cost_basis) * 100, 2) if cost_basis > 0 else 0.0

        invested += cost_basis
        market_total += market_value
        cost_total += cost_basis

        positions.append(
            PositionView(
                ticker=ticker,
                shares=round(pos.shares, 4),
                avg_cost=round(pos.avg_cost, 2),
                current_price=current,
                market_value=market_value,
                cost_basis=cost_basis,
                unrealized_pnl=pnl,
                unrealized_pnl_pct=pnl_pct,
                stop_loss=pos.stop_loss,
                target=pos.target,
            )
        )

    positions.sort(key=lambda p: p.market_value, reverse=True)
    unrealized = round(market_total - cost_total, 2)
    unrealized_pct = round((unrealized / cost_total) * 100, 2) if cost_total > 0 else 0.0
    total_value = round(state.cash + market_total, 2)

    orders = sorted(state.orders, key=lambda o: o.created_at, reverse=True)[:50]

    return PortfolioSummary(
        cash=round(state.cash, 2),
        invested=round(invested, 2),
        total_value=total_value,
        unrealized_pnl=unrealized,
        unrealized_pnl_pct=unrealized_pct,
        paper_trading=True,
        positions=positions,
        orders=orders,
    )


def get_portfolio() -> PortfolioSummary:
    return _build_summary(_load_state())


def place_buy(req: BuyOrderRequest) -> PortfolioSummary:
    state = _load_state()
    total = round(req.shares * req.price, 2)

    if total > state.cash + 0.01:
        raise ValueError(f"เงินสดไม่พอ — มี ${state.cash:.2f} ต้องการ ${total:.2f}")

    existing = state.positions.get(req.ticker)
    if existing:
        new_shares = existing.shares + req.shares
        new_avg = (existing.shares * existing.avg_cost + req.shares * req.price) / new_shares
        state.positions[req.ticker] = Position(
            ticker=req.ticker,
            shares=new_shares,
            avg_cost=round(new_avg, 4),
            stop_loss=req.stop_loss or existing.stop_loss,
            target=req.target or existing.target,
        )
    else:
        state.positions[req.ticker] = Position(
            ticker=req.ticker,
            shares=req.shares,
            avg_cost=req.price,
            stop_loss=req.stop_loss,
            target=req.target,
        )

    state.cash = round(state.cash - total, 2)
    state.orders.append(
        OrderRecord(
            id=new_order_id(),
            side=OrderSide.BUY,
            ticker=req.ticker,
            shares=req.shares,
            price=req.price,
            total=total,
            note=req.note or "Paper Buy",
            status="FILLED",
            paper=True,
            stop_loss=req.stop_loss,
            target=req.target,
        )
    )
    save_state(state)
    return _build_summary(state)


def place_sell(req: SellOrderRequest) -> PortfolioSummary:
    state = _load_state()
    pos = state.positions.get(req.ticker)

    if not pos or pos.shares < req.shares - 1e-4:
        held = pos.shares if pos else 0
        raise ValueError(f"หุ้น {req.ticker} ไม่พอ — ถืออยู่ {held:.4f} หุ้น")

    sell_shares = min(req.shares, pos.shares)
    total = round(sell_shares * req.price, 2)
    realized = round((req.price - pos.avg_cost) * sell_shares, 2)
    remaining = round(pos.shares - sell_shares, 4)

    if remaining <= 1e-9:
        del state.positions[req.ticker]
    else:
        state.positions[req.ticker] = Position(
            ticker=req.ticker,
            shares=remaining,
            avg_cost=pos.avg_cost,
            stop_loss=pos.stop_loss,
            target=pos.target,
        )

    state.cash = round(state.cash + total, 2)
    state.orders.append(
        OrderRecord(
            id=new_order_id(),
            side=OrderSide.SELL,
            ticker=req.ticker,
            shares=sell_shares,
            price=req.price,
            total=total,
            note=req.note or "Paper Sell",
            status="FILLED",
            paper=True,
            realized_pnl=realized,
        )
    )
    save_state(state)
    return _build_summary(state)


def reset_portfolio(initial_cash: float | None = None) -> PortfolioSummary:
    cash = initial_cash if initial_cash is not None else get_settings().portfolio_initial_cash
    state = PortfolioState(cash=cash, orders_day=_today_orders_day())
    save_state(state)
    return _build_summary(state)


def deposit_cash(amount: float) -> PortfolioSummary:
    state = _load_state()
    state.cash = round(state.cash + amount, 2)
    save_state(state)
    return _build_summary(state)


def withdraw_cash(amount: float) -> PortfolioSummary:
    state = _load_state()
    if amount > state.cash + 0.01:
        raise ValueError(f"เงินสดจำลองไม่พอ — มี ${state.cash:.2f}")
    state.cash = round(state.cash - amount, 2)
    save_state(state)
    return _build_summary(state)


def delete_position(ticker: str) -> PortfolioSummary:
    state = _load_state()
    ticker = ticker.upper()
    pos = state.positions.get(ticker)
    if not pos:
        raise ValueError(f"ไม่มีหุ้น {ticker} ในพอร์ตจำลอง")

    prices = _fetch_prices([ticker])
    exit_price = prices.get(ticker, pos.avg_cost)
    proceeds = round(pos.shares * exit_price, 2)
    realized = round((exit_price - pos.avg_cost) * pos.shares, 2)

    state.cash = round(state.cash + proceeds, 2)
    del state.positions[ticker]
    state.orders.append(
        OrderRecord(
            id=new_order_id(),
            side=OrderSide.SELL,
            ticker=ticker,
            shares=pos.shares,
            price=exit_price,
            total=proceeds,
            note="Paper Sell (ลบรายการ)",
            status="FILLED",
            paper=True,
            realized_pnl=realized,
        )
    )
    save_state(state)
    return _build_summary(state)


def update_position(ticker: str, shares: float, avg_cost: float) -> PortfolioSummary:
    state = _load_state()
    ticker = ticker.upper()
    if ticker not in state.positions:
        raise ValueError(f"ไม่มีหุ้น {ticker} ในพอร์ตจำลอง")

    pos = state.positions[ticker]
    state.positions[ticker] = Position(
        ticker=ticker,
        shares=round(shares, 4),
        avg_cost=round(avg_cost, 4),
        stop_loss=pos.stop_loss,
        target=pos.target,
    )
    save_state(state)
    return _build_summary(state)
