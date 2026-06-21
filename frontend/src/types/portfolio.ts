export type OrderSide = "BUY" | "SELL";



export interface OrderRecord {

  id: string;

  side: OrderSide;

  ticker: string;

  shares: number;

  price: number;

  total: number;

  note: string;

  status: string;

  paper: boolean;

  realized_pnl: number | null;

  stop_loss: number | null;

  target: number | null;

  created_at: string;

}



export interface PositionView {

  ticker: string;

  shares: number;

  avg_cost: number;

  current_price: number | null;

  market_value: number;

  cost_basis: number;

  unrealized_pnl: number;

  unrealized_pnl_pct: number;

  stop_loss: number | null;

  target: number | null;

}



export interface PortfolioSummary {

  cash: number;

  invested: number;

  total_value: number;

  unrealized_pnl: number;

  unrealized_pnl_pct: number;

  paper_trading: boolean;

  positions: PositionView[];

  orders: OrderRecord[];

}



export interface BuyOrderRequest {

  ticker: string;

  shares: number;

  price: number;

  note?: string;

  stop_loss?: number;

  target?: number;

}



export interface SellOrderRequest {

  ticker: string;

  shares: number;

  price: number;

  note?: string;

}



export interface UpdatePositionRequest {

  shares: number;

  avg_cost: number;

}



export interface CashAdjustRequest {

  amount: number;

}


