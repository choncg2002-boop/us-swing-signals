from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TrendBias(str, Enum):
    BULLISH = "bullish"
    NEUTRAL = "neutral"
    BEARISH = "bearish"


class VolumeBias(str, Enum):
    ACCUMULATION = "accumulation"
    NORMAL = "normal"
    DISTRIBUTION = "distribution"


class RelativeStrengthBias(str, Enum):
    OUTPERFORM = "outperform"
    NEUTRAL = "neutral"
    UNDERPERFORM = "underperform"


class Verdict(str, Enum):
    ENTRY_READY = "ENTRY_READY"
    WAIT = "WAIT"
    AVOID = "AVOID"


class ConditionCheck(BaseModel):
    id: str
    label: str
    passed: bool
    detail: str


class IndicatorOverview(BaseModel):
    trend: TrendBias
    momentum: TrendBias
    volume: VolumeBias
    relative_strength: RelativeStrengthBias
    atr14: float
    atr_pct: float


class ScoreBreakdown(BaseModel):
    trend: float = Field(ge=0, le=30)
    momentum: float = Field(ge=0, le=25)
    volume: float = Field(ge=0, le=15)
    relative_strength: float = Field(ge=0, le=15)
    risk_reward: float = Field(ge=0, le=15)
    total: float = Field(ge=0, le=100)


class TradePlan(BaseModel):
    entry: float
    entry_conditions: list[str] = Field(default_factory=list)
    stop_loss: float
    target_1: float
    target_2: float
    reward_risk: float
    risk_per_share: float
    risk_pct: float
    reward_pct_t1: float
    reward_pct_t2: float
    suggested_shares: float
    hold_period: str


class FibonacciPlan(BaseModel):
    trend: str
    swing_high: float
    swing_low: float
    fib_382: float
    fib_500: float
    fib_618: float
    action: str
    action_reason: str
    entry_low: float
    entry_high: float
    take_profit: float
    stop_loss: float
    reward_pct: float
    risk_pct: float
    reward_risk: float
    indicator_note: str


class TimeframeAnalysis(BaseModel):
    timeframe: str
    trend: TrendBias
    momentum: TrendBias


class SignalResult(BaseModel):
    ticker: str
    verdict: Verdict
    score: float = Field(ge=0, le=100)
    overview: IndicatorOverview
    score_breakdown: ScoreBreakdown
    trade_plan: Optional[TradePlan] = None
    fibonacci_plan: Optional[FibonacciPlan] = None
    daily: TimeframeAnalysis
    weekly: TimeframeAnalysis
    verdict_reason: str
    checklist: list[ConditionCheck] = Field(default_factory=list)
    missing_conditions: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    price: float
    ema20: float
    sma50: float
    sma200: float
    rsi14: float
    macd: float
    macd_signal: float
    macd_histogram: float
    volume_ratio: float
    relative_strength: Optional[float] = None
    scanned_at: datetime = Field(default_factory=datetime.utcnow)


class ScanSummary(BaseModel):
    total_scanned: int
    signals_found: int
    entry_ready_count: int
    wait_count: int
    avoid_count: int
    results: list[SignalResult]
    scan_duration_sec: float
