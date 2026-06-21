from fastapi import APIRouter, HTTPException, Query

from app.portfolio.models import (
    BuyOrderRequest,
    CashAdjustRequest,
    PortfolioSummary,
    SellOrderRequest,
    UpdatePositionRequest,
)
from app.portfolio import service as portfolio_service

router = APIRouter(prefix="/api/v1/portfolio", tags=["portfolio"])


@router.get("", response_model=PortfolioSummary)
def get_portfolio() -> PortfolioSummary:
    return portfolio_service.get_portfolio()


@router.post("/orders/buy", response_model=PortfolioSummary)
def buy_order(req: BuyOrderRequest) -> PortfolioSummary:
    try:
        return portfolio_service.place_buy(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/orders/sell", response_model=PortfolioSummary)
def sell_order(req: SellOrderRequest) -> PortfolioSummary:
    try:
        return portfolio_service.place_sell(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reset", response_model=PortfolioSummary)
def reset_portfolio(
    initial_cash: float | None = Query(None, gt=0, description="Reset cash balance"),
) -> PortfolioSummary:
    return portfolio_service.reset_portfolio(initial_cash)


@router.delete("/positions/{ticker}", response_model=PortfolioSummary)
def delete_position(ticker: str) -> PortfolioSummary:
    try:
        return portfolio_service.delete_position(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/positions/{ticker}", response_model=PortfolioSummary)
def update_position(ticker: str, req: UpdatePositionRequest) -> PortfolioSummary:
    try:
        return portfolio_service.update_position(ticker, req.shares, req.avg_cost)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/cash/deposit", response_model=PortfolioSummary)
def deposit_cash(req: CashAdjustRequest) -> PortfolioSummary:
    return portfolio_service.deposit_cash(req.amount)


@router.post("/cash/withdraw", response_model=PortfolioSummary)
def withdraw_cash(req: CashAdjustRequest) -> PortfolioSummary:
    try:
        return portfolio_service.withdraw_cash(req.amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
