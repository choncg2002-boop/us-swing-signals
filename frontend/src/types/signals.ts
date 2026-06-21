export type Verdict = "ENTRY_READY" | "WAIT" | "AVOID";

export type TrendBias = "bullish" | "neutral" | "bearish";
export type VolumeBias = "accumulation" | "normal" | "distribution";
export type RelativeStrengthBias = "outperform" | "neutral" | "underperform";

export type Timeframe = "1D" | "1W" | "1M" | "1Y";

export interface ConditionCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface IndicatorOverview {
  trend: TrendBias;
  momentum: TrendBias;
  volume: VolumeBias;
  relative_strength: RelativeStrengthBias;
  atr14: number;
  atr_pct: number;
}

export interface ScoreBreakdown {
  trend: number;
  momentum: number;
  volume: number;
  relative_strength: number;
  risk_reward: number;
  total: number;
}

export interface TradePlan {
  entry: number;
  entry_conditions: string[];
  stop_loss: number;
  target_1: number;
  target_2: number;
  reward_risk: number;
  risk_per_share: number;
  risk_pct: number;
  reward_pct_t1: number;
  reward_pct_t2: number;
  suggested_shares: number;
  hold_period: string;
}

export interface FibonacciPlan {
  trend: string;
  swing_high: number;
  swing_low: number;
  fib_382: number;
  fib_500: number;
  fib_618: number;
  action: string;
  action_reason: string;
  entry_low: number;
  entry_high: number;
  take_profit: number;
  stop_loss: number;
  reward_pct: number;
  risk_pct: number;
  reward_risk: number;
  indicator_note: string;
}

export interface TimeframeAnalysis {
  timeframe: string;
  trend: TrendBias;
  momentum: TrendBias;
}

export interface SignalResult {
  ticker: string;
  verdict: Verdict;
  score: number;
  overview: IndicatorOverview;
  score_breakdown: ScoreBreakdown;
  trade_plan: TradePlan | null;
  fibonacci_plan: FibonacciPlan | null;
  daily: TimeframeAnalysis;
  weekly: TimeframeAnalysis;
  verdict_reason: string;
  checklist: ConditionCheck[];
  missing_conditions: string[];
  blockers: string[];
  price: number;
  ema20: number;
  sma50: number;
  sma200: number;
  rsi14: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  volume_ratio: number;
  relative_strength: number | null;
  scanned_at: string;
}

export interface ScanSummary {
  total_scanned: number;
  signals_found: number;
  entry_ready_count: number;
  wait_count: number;
  avoid_count: number;
  results: SignalResult[];
  scan_duration_sec: number;
}

export interface OhlcvBar {
  date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

export interface OhlcvResponse {
  ticker: string;
  timeframe: string;
  data: OhlcvBar[];
}

export interface IndicatorsResponse {
  ticker: string;
  ema20: number;
  sma50: number;
  sma200: number;
  rsi14: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  atr14: number;
  volume_ratio: number | null;
  relative_strength: number | null;
}
