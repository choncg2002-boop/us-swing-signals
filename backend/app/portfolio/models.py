from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderRecord(BaseModel):
    id: str
    side: OrderSide
    ticker: str
    shares: float
    price: float
    total: float
    note: str = ""
    status: str = "FILLED"
    paper: bool = True
    realized_pnl: Optional[float] = None
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Position(BaseModel):
    ticker: str
    shares: float
    avg_cost: float
    stop_loss: Optional[float] = None
    target: Optional[float] = None


class PortfolioState(BaseModel):
    cash: float = 100_000.0
    positions: dict[str, Position] = Field(default_factory=dict)
    orders: list[OrderRecord] = Field(default_factory=list)
    # YYYY-MM-DD (Asia/Bangkok) — เปลี่ยนวันแล้วเคลียร์ orders อัตโนมัติ
    orders_day: Optional[str] = None


class BuyOrderRequest(BaseModel):
    ticker: str
    shares: float = Field(gt=0)
    price: float = Field(gt=0)
    note: str = ""
    stop_loss: Optional[float] = Field(default=None, gt=0)
    target: Optional[float] = Field(default=None, gt=0)

    @field_validator("ticker")
    @classmethod
    def upper_ticker(cls, v: str) -> str:
        return v.strip().upper()


class SellOrderRequest(BaseModel):
    ticker: str
    shares: float = Field(gt=0)
    price: float = Field(gt=0)
    note: str = ""

    @field_validator("ticker")
    @classmethod
    def upper_ticker(cls, v: str) -> str:
        return v.strip().upper()


class UpdatePositionRequest(BaseModel):
    shares: float = Field(gt=0)
    avg_cost: float = Field(gt=0)


class CashAdjustRequest(BaseModel):
    amount: float = Field(gt=0, description="Amount in USD")


class PositionView(BaseModel):
    ticker: str
    shares: float
    avg_cost: float
    current_price: Optional[float] = None
    market_value: float
    cost_basis: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    stop_loss: Optional[float] = None
    target: Optional[float] = None


class PortfolioSummary(BaseModel):
    cash: float
    invested: float
    total_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    paper_trading: bool = True
    positions: list[PositionView]
    orders: list[OrderRecord]


def new_order_id() -> str:
    return uuid4().hex[:12]
