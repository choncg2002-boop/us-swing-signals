import { useEffect, useMemo, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { OhlcvBar, Timeframe } from "../../types/signals";
import { computeFibChartAnalysis } from "../../utils/fibonacciChart";
import FibChartSummary from "./FibChartSummary";

interface Props {
  data: OhlcvBar[];
  timeframe: Timeframe;
  loading?: boolean;
  livePrice?: number | null;
  showFib?: boolean;
}

function toUtcTimestamp(dateStr: string): UTCTimestamp {
  return (new Date(dateStr).getTime() / 1000) as UTCTimestamp;
}

const LINE_STYLE: Record<string, { color: string; width: 1 | 2 | 3 | 4; style: LineStyle }> = {
  swing: { color: "#FFB800", width: 2, style: LineStyle.Solid },
  retrace: { color: "#00D4FF", width: 1, style: LineStyle.Dashed },
  extension: { color: "#00FF88", width: 1, style: LineStyle.Dotted },
};

export default function CandlestickChart({
  data,
  timeframe,
  loading,
  livePrice,
  showFib = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const emaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const fibLinesRef = useRef<IPriceLine[]>([]);

  const fibAnalysis = useMemo(() => {
    if (!showFib || data.length === 0) return null;
    return computeFibChartAnalysis(data, timeframe, livePrice);
  }, [data, timeframe, livePrice, showFib]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#12121A" },
        textColor: "#A0A0B0",
      },
      grid: {
        vertLines: { color: "#2A2A35" },
        horzLines: { color: "#2A2A35" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#2A2A35" },
      timeScale: { borderColor: "#2A2A35", timeVisible: true },
      width: containerRef.current.clientWidth,
      height: 420,
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#00FF88",
      downColor: "#FF3366",
      borderUpColor: "#00FF88",
      borderDownColor: "#FF3366",
      wickUpColor: "#00FF88",
      wickDownColor: "#FF3366",
    });

    const volume = chart.addHistogramSeries({
      color: "#00D4FF",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const ema = chart.addLineSeries({
      color: "#FFB800",
      lineWidth: 2,
      title: "EMA50",
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;
    emaRef.current = ema;

    const observer = new ResizeObserver((entries) => {
      if (entries[0] && chartRef.current) {
        chartRef.current.applyOptions({ width: entries[0].contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      fibLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !emaRef.current || data.length === 0) {
      return;
    }

    const candles: CandlestickData[] = data.map((bar) => ({
      time: toUtcTimestamp(bar.date),
      open: bar.Open,
      high: bar.High,
      low: bar.Low,
      close: bar.Close,
    }));

    const volumes: HistogramData[] = data.map((bar) => ({
      time: toUtcTimestamp(bar.date),
      value: bar.Volume,
      color: bar.Close >= bar.Open ? "rgba(0,255,136,0.4)" : "rgba(255,51,102,0.4)",
    }));

    const ema50 = computeEma(data.map((b) => b.Close), 50);
    const emaLine: LineData<Time>[] = [];

    data.forEach((bar, i) => {
      const value = ema50[i];
      if (value != null) {
        emaLine.push({ time: toUtcTimestamp(bar.date), value });
      }
    });

    candleRef.current.setData(candles);
    volumeRef.current.setData(volumes);
    emaRef.current.setData(emaLine);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;

    fibLinesRef.current.forEach((line) => series.removePriceLine(line));
    fibLinesRef.current = [];

    if (!fibAnalysis) return;

    for (const lvl of fibAnalysis.lines) {
      const style = LINE_STYLE[lvl.kind];
      const priceLine = series.createPriceLine({
        price: lvl.price,
        color: style.color,
        lineWidth: style.width,
        lineStyle: style.style,
        axisLabelVisible: true,
        title: lvl.label,
      });
      fibLinesRef.current.push(priceLine);
    }
  }, [fibAnalysis]);

  useEffect(() => {
    if (!candleRef.current || data.length === 0 || livePrice == null) return;
    const last = data[data.length - 1];
    candleRef.current.update({
      time: toUtcTimestamp(last.date),
      open: last.Open,
      high: Math.max(last.High, livePrice),
      low: Math.min(last.Low, livePrice),
      close: livePrice,
    });
  }, [livePrice, data]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-graphite bg-charcoal overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-charcoal/80">
            <span className="text-sm text-muted animate-pulse">Loading chart...</span>
          </div>
        )}
        {fibAnalysis && !loading && (
          <div className="absolute top-2 left-2 z-10 rounded-md bg-obsidian/90 border border-graphite px-2 py-1 text-[10px] text-muted">
            Fib · {fibAnalysis.trend} · H ${fibAnalysis.swingHigh.toFixed(0)} L ${fibAnalysis.swingLow.toFixed(0)}
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>

      {fibAnalysis && !loading && <FibChartSummary analysis={fibAnalysis} />}
    </div>
  );
}

function computeEma(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  let ema: number | null = null;
  const k = 2 / (period + 1);

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (ema === null) {
      const slice = values.slice(0, period);
      ema = slice.reduce((a, b) => a + b, 0) / period;
    } else {
      ema = values[i] * k + ema * (1 - k);
    }
    result.push(ema);
  }
  return result;
}
