import type { OhlcvBar, Timeframe } from "../types/signals";

export type FibTrend = "ขาขึ้น" | "ขาลง" | "Sideway";

export interface FibChartLine {
  price: number;
  label: string;
  kind: "swing" | "retrace" | "extension";
}

export interface FibChartAnalysis {
  trend: FibTrend;
  swingHigh: number;
  swingLow: number;
  currentPrice: number;
  lines: FibChartLine[];
  summary: string[];
}

const LOOKBACK: Record<Timeframe, number> = {
  "1D": 63,
  "1W": 26,
  "1M": 12,
  "1Y": 24,
};

function lookbackFor(tf: Timeframe, dataLen: number): number {
  return Math.min(LOOKBACK[tf], dataLen);
}

function findSwingIndices(bars: OhlcvBar[]): { highIdx: number; lowIdx: number } {
  let highIdx = 0;
  let lowIdx = 0;
  bars.forEach((b, i) => {
    if (b.High > bars[highIdx].High) highIdx = i;
    if (b.Low < bars[lowIdx].Low) lowIdx = i;
  });
  return { highIdx, lowIdx };
}

function detectTrend(
  bars: OhlcvBar[],
  swingHigh: number,
  swingLow: number,
  highIdx: number,
  lowIdx: number,
): FibTrend {
  if (bars.length < 10) return "Sideway";

  const first = bars[0].Close;
  const last = bars[bars.length - 1].Close;
  const changePct = ((last - first) / first) * 100;
  const rangePct = ((swingHigh - swingLow) / last) * 100;
  const mid = swingLow + (swingHigh - swingLow) * 0.5;
  const nearMid = Math.abs(last - mid) / (swingHigh - swingLow) < 0.15;

  if (rangePct < 8 && Math.abs(changePct) < 6) return "Sideway";
  if (nearMid && Math.abs(changePct) < 5 && rangePct < 15) return "Sideway";

  if (lowIdx < highIdx) return "ขาขึ้น";
  if (highIdx < lowIdx) return "ขาลง";

  return changePct >= 0 ? "ขาขึ้น" : "ขาลง";
}

function fmt(price: number): string {
  return `$${price.toFixed(2)}`;
}

function retraceLevel(high: number, low: number, ratio: number, uptrend: boolean): number {
  const span = high - low;
  return uptrend ? high - ratio * span : low + ratio * span;
}

function extensionLevel(high: number, low: number, ratio: number, uptrend: boolean): number {
  const span = high - low;
  return uptrend ? high + ratio * span : low - ratio * span;
}

export function computeFibChartAnalysis(
  data: OhlcvBar[],
  timeframe: Timeframe,
  livePrice?: number | null,
): FibChartAnalysis | null {
  if (data.length < 15) return null;

  const lb = lookbackFor(timeframe, data.length);
  const bars = data.slice(-lb);
  const { highIdx, lowIdx } = findSwingIndices(bars);

  const swingHigh = bars[highIdx].High;
  const swingLow = bars[lowIdx].Low;
  const span = swingHigh - swingLow;
  if (span <= 0) return null;

  const lastBar = data[data.length - 1];
  const currentPrice = livePrice ?? lastBar.Close;
  const trend = detectTrend(bars, swingHigh, swingLow, highIdx, lowIdx);
  const uptrend = trend === "ขาขึ้น" || (trend === "Sideway" && lowIdx <= highIdx);

  const fib382 = retraceLevel(swingHigh, swingLow, 0.382, uptrend);
  const fib618 = retraceLevel(swingHigh, swingLow, 0.618, uptrend);
  const ext1272 = extensionLevel(swingHigh, swingLow, 0.272, uptrend);
  const ext1618 = extensionLevel(swingHigh, swingLow, 0.618, uptrend);

  const lines: FibChartLine[] = [];

  if (uptrend) {
    lines.push(
      { price: fib382, label: "แนวรับ 38.2%", kind: "retrace" },
      { price: fib618, label: "แนวรับ 61.8%", kind: "retrace" },
      { price: swingLow, label: "Swing Low", kind: "swing" },
      { price: swingHigh, label: "แนวต้านหลัก 100%", kind: "swing" },
    );

    if (currentPrice > swingHigh) {
      lines.push(
        { price: ext1272, label: "เป้าหลังทะลุ 127.2%", kind: "extension" },
        { price: ext1618, label: "เป้าหลังทะลุ 161.8%", kind: "extension" },
      );
    }
  } else {
    lines.push(
      { price: retraceLevel(swingHigh, swingLow, 0.382, false), label: "แนวต้าน 38.2%", kind: "retrace" },
      { price: retraceLevel(swingHigh, swingLow, 0.618, false), label: "แนวต้าน 61.8%", kind: "retrace" },
      { price: swingLow, label: "Swing Low", kind: "swing" },
      { price: swingHigh, label: "แนวต้านหลัก 100%", kind: "swing" },
    );

    if (currentPrice < swingLow) {
      lines.push(
        { price: extensionLevel(swingHigh, swingLow, 0.272, false), label: "เป้าหลังทะลุ 127.2%", kind: "extension" },
        { price: extensionLevel(swingHigh, swingLow, 0.618, false), label: "เป้าหลังทะลุ 161.8%", kind: "extension" },
      );
    }
  }

  const summary: string[] = [];

  if (uptrend) {
    summary.push(
      `แนวรับหลัก: 61.8% ${fmt(fib618)} · 38.2% ${fmt(fib382)} · Swing Low ${fmt(swingLow)}`,
      `แนวต้านหลัก: High เดิม ${fmt(swingHigh)} (100%)`,
    );
    if (currentPrice > swingHigh) {
      summary.push(`ทะลุ High แล้ว → เป้าถัดไป: 127.2% ${fmt(ext1272)} · 161.8% ${fmt(ext1618)}`);
    } else {
      summary.push(`หากทะลุ ${fmt(swingHigh)} → เป้า 127.2% ${fmt(ext1272)} · 161.8% ${fmt(ext1618)}`);
    }
  } else {
    summary.push(
      `แนวรับหลัก: Swing Low ${fmt(swingLow)}`,
      `แนวต้านหลัก: 61.8% ${fmt(retraceLevel(swingHigh, swingLow, 0.618, false))} · High เดิม ${fmt(swingHigh)} (100%)`,
    );
    if (currentPrice < swingLow) {
      summary.push(
        `ทะลุ Swing Low แล้ว → เป้าถัดไป: 127.2% ${fmt(extensionLevel(swingHigh, swingLow, 0.272, false))} · 161.8% ${fmt(extensionLevel(swingHigh, swingLow, 0.618, false))}`,
      );
    } else {
      summary.push(
        `หากหลุด ${fmt(swingLow)} → เป้า 127.2% ${fmt(extensionLevel(swingHigh, swingLow, 0.272, false))} · 161.8% ${fmt(extensionLevel(swingHigh, swingLow, 0.618, false))}`,
      );
    }
  }

  return {
    trend,
    swingHigh,
    swingLow,
    currentPrice,
    lines,
    summary,
  };
}
