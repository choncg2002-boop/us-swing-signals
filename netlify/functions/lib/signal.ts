import type { OhlcvBar } from "./yahoo.js";
import { ema, lastValid, macd, rsi, sma } from "./indicators.js";

type Bias = "bullish" | "neutral" | "bearish";

function trendBias(price: number, ema20: number, sma50: number, sma200: number): Bias {
  if (price > ema20 && price > sma50 && ema20 > sma50) return "bullish";
  if (price < ema20 && price < sma50) return "bearish";
  return "neutral";
}

function momentumBias(rsi14: number, macdVal: number, macdSig: number, hist: number): Bias {
  if (rsi14 >= 50 && macdVal > macdSig && hist > 0) return "bullish";
  if (rsi14 < 45 || macdVal < macdSig) return "bearish";
  return "neutral";
}

export function analyzeSignal(ticker: string, bars: OhlcvBar[]) {
  const closes = bars.map((b) => b.Close);
  const highs = bars.map((b) => b.High);
  const volumes = bars.map((b) => b.Volume);

  const ema20s = ema(closes, 20);
  const sma50s = sma(closes, 50);
  const sma200s = sma(closes, 200);
  const rsi14s = rsi(closes, 14);
  const { macd: macdLine, signal: macdSig, hist: macdHist } = macd(closes);

  const price = closes[closes.length - 1]!;
  const ema20 = lastValid(ema20s);
  const sma50 = lastValid(sma50s);
  const sma200 = lastValid(sma200s);
  const rsi14 = lastValid(rsi14s);
  const macdVal = lastValid(macdLine);
  const macdSignal = lastValid(macdSig);
  const macdHistogram = lastValid(macdHist);

  const volMa = sma(volumes, 20);
  const volRatio = volumes[volumes.length - 1]! / (lastValid(volMa) || 1);

  const trend = trendBias(price, ema20, sma50, sma200);
  const momentum = momentumBias(rsi14, macdVal, macdSignal, macdHistogram);

  const atr14 = Math.max(...highs.slice(-14).map((h, i) => h - (bars[bars.length - 14 + i]?.Low ?? h))) || price * 0.02;
  const atrPct = (atr14 / price) * 100;

  const priceAboveEma = price > ema20 && price > sma50;
  const emaCross = ema20 > sma50;
  const sma200Ok = price > sma200;
  const rsiOk = rsi14 >= 50 && rsi14 <= 70;
  const macdOk = macdVal > macdSignal && macdHistogram > 0;
  const volOk = volRatio >= 1.5;

  const blockers: string[] = [];
  if (!priceAboveEma) blockers.push("ราคาหลุด EMA20 พร้อม volume สูง");
  if (!macdOk) blockers.push("MACD ยังต่ำกว่า Signal line");

  let verdict: "ENTRY_READY" | "WAIT" | "AVOID" = "WAIT";
  let verdictReason = "รอเงื่อนไขเพิ่ม";
  if (trend === "bearish" && momentum === "bearish") {
    verdict = "AVOID";
    verdictReason = "MACD ยังต่ำกว่า Signal line";
  } else if (priceAboveEma && emaCross && rsiOk && macdOk && volOk) {
    verdict = "ENTRY_READY";
    verdictReason = "เงื่อนไขเข้าได้ครบ";
  } else if (trend === "bullish") {
    verdict = "WAIT";
    verdictReason = "เทรนด์ดี แต่ยังรอ momentum";
  }

  const entry = Math.round(price * 100) / 100;
  const stopLoss = Math.round(Math.max(entry * 0.95, entry - atr14 * 1.5) * 100) / 100;
  const risk = entry - stopLoss;
  const target1 = Math.round((entry + risk * 2) * 100) / 100;
  const target2 = Math.round((entry + risk * 3) * 100) / 100;

  const trendScore = (price > ema20 ? 5 : 0) + (price > sma50 ? 5 : 0) + (sma200Ok ? 5 : 0) + (emaCross ? 5 : 0);
  const momScore = (rsiOk ? 8 : 4) + (macdOk ? 10 : 2);
  const volScore = volOk ? 12 : 6;
  const total = Math.min(100, trendScore + momScore + volScore + 20);

  return {
    ticker,
    verdict,
    score: total,
    overview: {
      trend,
      momentum,
      volume: volRatio >= 1.5 ? "accumulation" : volRatio < 0.8 ? "distribution" : "normal",
      relative_strength: "neutral" as const,
      atr14: Math.round(atr14 * 100) / 100,
      atr_pct: Math.round(atrPct * 10) / 10,
    },
    score_breakdown: {
      trend: Math.min(30, trendScore * 1.5),
      momentum: Math.min(25, momScore),
      volume: Math.min(15, volScore),
      relative_strength: 8,
      risk_reward: 12,
      total,
    },
    trade_plan: {
      entry,
      entry_conditions: verdict === "ENTRY_READY" ? ["เงื่อนไขครบ"] : ["รอ: ราคา > EMA20 และ SMA50", "รอ: MACD > Signal"],
      stop_loss: stopLoss,
      target_1: target1,
      target_2: target2,
      reward_risk: risk > 0 ? Math.round((target1 - entry) / risk * 10) / 10 : 2,
      risk_per_share: Math.round(risk * 100) / 100,
      risk_pct: Math.round((risk / entry) * 1000) / 10,
      reward_pct_t1: Math.round(((target1 - entry) / entry) * 1000) / 10,
      reward_pct_t2: Math.round(((target2 - entry) / entry) * 1000) / 10,
      suggested_shares: Math.round((500 / risk) * 10) / 10,
      hold_period: "2–12 สัปดาห์",
    },
    fibonacci_plan: null,
    daily: { timeframe: "daily", trend, momentum },
    weekly: { timeframe: "weekly", trend: "neutral" as Bias, momentum: "neutral" as Bias },
    verdict_reason: verdictReason,
    checklist: [
      { id: "price", label: "ราคา > EMA20 และ SMA50", passed: priceAboveEma, detail: `$${price.toFixed(2)} | EMA20 $${ema20.toFixed(2)}` },
      { id: "ema", label: "EMA20 > SMA50", passed: emaCross, detail: "EMA20 นำเทรน" },
      { id: "sma200", label: "ยืนเหนือ SMA200", passed: sma200Ok, detail: `SMA200 $${sma200.toFixed(2)}` },
      { id: "rsi", label: "RSI(14) 50–70", passed: rsiOk, detail: `RSI = ${rsi14.toFixed(1)}` },
      { id: "macd", label: "MACD > Signal", passed: macdOk, detail: `MACD ${macdVal.toFixed(3)} / Signal ${macdSignal.toFixed(3)}` },
      { id: "vol", label: "Volume ≥ 1.5x MA20", passed: volOk, detail: `${volRatio.toFixed(2)}x` },
    ],
    missing_conditions: [],
    blockers,
    price: entry,
    ema20: Math.round(ema20 * 100) / 100,
    sma50: Math.round(sma50 * 100) / 100,
    sma200: Math.round(sma200 * 100) / 100,
    rsi14: Math.round(rsi14 * 10) / 10,
    macd: Math.round(macdVal * 1000) / 1000,
    macd_signal: Math.round(macdSignal * 1000) / 1000,
    macd_histogram: Math.round(macdHistogram * 1000) / 1000,
    volume_ratio: Math.round(volRatio * 100) / 100,
    relative_strength: null,
    scanned_at: new Date().toISOString(),
  };
}
