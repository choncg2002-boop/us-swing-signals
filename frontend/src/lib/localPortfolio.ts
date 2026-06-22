import type {
  BuyOrderRequest,
  OrderRecord,
  OrderSide,
  PortfolioSummary,
  PositionView,
  SellOrderRequest,
} from "../types/portfolio";

const STORAGE_KEY = "us-swing-paper-portfolio";
const INITIAL_CASH = 100_000;

interface Position {
  ticker: string;
  shares: number;
  avg_cost: number;
  stop_loss: number | null;
  target: number | null;
}

interface PortfolioState {
  cash: number;
  positions: Record<string, Position>;
  orders: OrderRecord[];
  orders_day: string | null;
}

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function newOrderId(): string {
  return Math.random().toString(16).slice(2, 14);
}

function loadState(): PortfolioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cash: INITIAL_CASH, positions: {}, orders: [], orders_day: todayKey() };
    const state = JSON.parse(raw) as PortfolioState;
    if (state.orders_day !== todayKey()) {
      state.orders = [];
      state.orders_day = todayKey();
      saveState(state);
    }
    return state;
  } catch {
    return { cash: INITIAL_CASH, positions: {}, orders: [], orders_day: todayKey() };
  }
}

function saveState(state: PortfolioState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function fetchPrices(tickers: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const res = await fetch(`/api/v1/quote/${ticker}`);
        if (!res.ok) return;
        const data = (await res.json()) as { price: number };
        if (data.price > 0) prices[ticker] = data.price;
      } catch {
        /* skip */
      }
    }),
  );
  return prices;
}

function buildSummary(state: PortfolioState, prices: Record<string, number>): PortfolioSummary {
  const positions: PositionView[] = [];
  let invested = 0;
  let marketTotal = 0;
  let costTotal = 0;

  for (const [ticker, pos] of Object.entries(state.positions)) {
    if (pos.shares <= 0) continue;
    const current = prices[ticker];
    const costBasis = Math.round(pos.shares * pos.avg_cost * 100) / 100;
    const marketValue = current
      ? Math.round(pos.shares * current * 100) / 100
      : costBasis;
    const pnl = Math.round((marketValue - costBasis) * 100) / 100;
    const pnlPct = costBasis > 0 ? Math.round((pnl / costBasis) * 10000) / 100 : 0;

    invested += costBasis;
    marketTotal += marketValue;
    costTotal += costBasis;

    positions.push({
      ticker,
      shares: Math.round(pos.shares * 10000) / 10000,
      avg_cost: Math.round(pos.avg_cost * 100) / 100,
      current_price: current ?? null,
      market_value: marketValue,
      cost_basis: costBasis,
      unrealized_pnl: pnl,
      unrealized_pnl_pct: pnlPct,
      stop_loss: pos.stop_loss,
      target: pos.target,
    });
  }

  positions.sort((a, b) => b.market_value - a.market_value);
  const unrealized = Math.round((marketTotal - costTotal) * 100) / 100;
  const unrealizedPct = costTotal > 0 ? Math.round((unrealized / costTotal) * 10000) / 100 : 0;

  return {
    cash: Math.round(state.cash * 100) / 100,
    invested: Math.round(invested * 100) / 100,
    total_value: Math.round((state.cash + marketTotal) * 100) / 100,
    unrealized_pnl: unrealized,
    unrealized_pnl_pct: unrealizedPct,
    paper_trading: true,
    positions,
    orders: [...state.orders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ).slice(0, 50),
  };
}

export async function getPortfolio(): Promise<PortfolioSummary> {
  const state = loadState();
  const tickers = Object.keys(state.positions);
  const prices = tickers.length ? await fetchPrices(tickers) : {};
  return buildSummary(state, prices);
}

export async function placeBuy(req: BuyOrderRequest): Promise<PortfolioSummary> {
  const state = loadState();
  const total = Math.round(req.shares * req.price * 100) / 100;
  if (total > state.cash + 0.01) {
    throw new Error(`เงินสดไม่พอ — มี $${state.cash.toFixed(2)} ต้องการ $${total.toFixed(2)}`);
  }

  const existing = state.positions[req.ticker];
  if (existing) {
    const newShares = existing.shares + req.shares;
    const newAvg = (existing.shares * existing.avg_cost + req.shares * req.price) / newShares;
    state.positions[req.ticker] = {
      ...existing,
      shares: newShares,
      avg_cost: Math.round(newAvg * 10000) / 10000,
      stop_loss: req.stop_loss ?? existing.stop_loss,
      target: req.target ?? existing.target,
    };
  } else {
    state.positions[req.ticker] = {
      ticker: req.ticker,
      shares: req.shares,
      avg_cost: req.price,
      stop_loss: req.stop_loss ?? null,
      target: req.target ?? null,
    };
  }

  state.cash = Math.round((state.cash - total) * 100) / 100;
  state.orders.push({
    id: newOrderId(),
    side: "BUY" as OrderSide,
    ticker: req.ticker,
    shares: req.shares,
    price: req.price,
    total,
    note: req.note || "Paper Buy",
    status: "FILLED",
    paper: true,
    realized_pnl: null,
    stop_loss: req.stop_loss ?? null,
    target: req.target ?? null,
    created_at: new Date().toISOString(),
  });
  saveState(state);
  return getPortfolio();
}

export async function placeSell(req: SellOrderRequest): Promise<PortfolioSummary> {
  const state = loadState();
  const pos = state.positions[req.ticker];
  if (!pos || pos.shares < req.shares - 1e-4) {
    const held = pos?.shares ?? 0;
    throw new Error(`หุ้น ${req.ticker} ไม่พอ — ถืออยู่ ${held.toFixed(4)} หุ้น`);
  }

  const sellShares = Math.min(req.shares, pos.shares);
  const total = Math.round(sellShares * req.price * 100) / 100;
  const realized = Math.round((req.price - pos.avg_cost) * sellShares * 100) / 100;
  const remaining = Math.round((pos.shares - sellShares) * 10000) / 10000;

  if (remaining <= 1e-9) {
    delete state.positions[req.ticker];
  } else {
    state.positions[req.ticker] = { ...pos, shares: remaining };
  }

  state.cash = Math.round((state.cash + total) * 100) / 100;
  state.orders.push({
    id: newOrderId(),
    side: "SELL" as OrderSide,
    ticker: req.ticker,
    shares: sellShares,
    price: req.price,
    total,
    note: req.note || "Paper Sell",
    status: "FILLED",
    paper: true,
    realized_pnl: realized,
    stop_loss: null,
    target: null,
    created_at: new Date().toISOString(),
  });
  saveState(state);
  return getPortfolio();
}

export async function depositCash(amount: number): Promise<PortfolioSummary> {
  if (amount <= 0) throw new Error("จำนวนเงินไม่ถูกต้อง");
  const state = loadState();
  state.cash = Math.round((state.cash + amount) * 100) / 100;
  saveState(state);
  return getPortfolio();
}

export async function withdrawCash(amount: number): Promise<PortfolioSummary> {
  if (amount <= 0) throw new Error("จำนวนเงินไม่ถูกต้อง");
  const state = loadState();
  if (amount > state.cash + 0.01) {
    throw new Error(`เงินสดไม่พอ — มี $${state.cash.toFixed(2)}`);
  }
  state.cash = Math.round((state.cash - amount) * 100) / 100;
  saveState(state);
  return getPortfolio();
}

export async function deletePosition(ticker: string): Promise<PortfolioSummary> {
  const state = loadState();
  const sym = ticker.toUpperCase();
  const pos = state.positions[sym];
  if (!pos) throw new Error(`ไม่มีหุ้น ${sym} ในพอร์ตจำลอง`);

  const prices = await fetchPrices([sym]);
  const exitPrice = prices[sym] ?? pos.avg_cost;
  return placeSell({
    ticker: sym,
    shares: pos.shares,
    price: exitPrice,
    note: "Paper Sell (ลบรายการ)",
  });
}

export async function updatePosition(
  ticker: string,
  shares: number,
  avgCost: number,
): Promise<PortfolioSummary> {
  const state = loadState();
  const sym = ticker.toUpperCase();
  if (!state.positions[sym]) throw new Error(`ไม่มีหุ้น ${sym} ในพอร์ตจำลอง`);
  const pos = state.positions[sym];
  state.positions[sym] = {
    ...pos,
    shares: Math.round(shares * 10000) / 10000,
    avg_cost: Math.round(avgCost * 10000) / 10000,
  };
  saveState(state);
  return getPortfolio();
}

export async function resetPortfolio(initialCash = INITIAL_CASH): Promise<PortfolioSummary> {
  const state: PortfolioState = {
    cash: initialCash,
    positions: {},
    orders: [],
    orders_day: todayKey(),
  };
  saveState(state);
  return buildSummary(state, {});
}
