const UA = "Mozilla/5.0 (compatible; USSwingSignals/1.0)";

export interface OhlcvBar {
  date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

const TF_MAP: Record<string, { interval: string; range: string }> = {
  "1D": { interval: "1d", range: "1y" },
  "1W": { interval: "1wk", range: "5y" },
  "1M": { interval: "1mo", range: "10y" },
  "1Y": { interval: "1mo", range: "max" },
};

export async function fetchChart(
  ticker: string,
  tf = "1D",
): Promise<OhlcvBar[]> {
  const cfg = TF_MAP[tf] ?? TF_MAP["1D"];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${cfg.interval}&range=${cfg.range}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Yahoo Finance error ${res.status}`);

  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[] }> };
      }>;
    };
  };

  const result = json.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error(`No data for ${ticker}`);

  const q = result.indicators?.quote?.[0];
  if (!q) throw new Error(`No quote data for ${ticker}`);

  const bars: OhlcvBar[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = q.close?.[i];
    if (close == null || Number.isNaN(close)) continue;
    bars.push({
      date: new Date(result.timestamp[i]! * 1000).toISOString(),
      Open: q.open?.[i] ?? close,
      High: q.high?.[i] ?? close,
      Low: q.low?.[i] ?? close,
      Close: close,
      Volume: q.volume?.[i] ?? 0,
    });
  }
  return bars;
}

export async function fetchQuote(ticker: string): Promise<number> {
  const bars = await fetchChart(ticker, "1D");
  return Math.round(bars[bars.length - 1]!.Close * 100) / 100;
}
