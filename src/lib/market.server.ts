// Hämtar aktuella kursnivåer och historik från Yahoo Finance (öppen källa, ingen nyckel).
import type { Candle } from "./stocks";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

export type ChartData = {
  symbol: string;
  price: number;
  changePct: number;
  currency: string;
  candles: Candle[];
};

const chartCache = new Map<string, { at: number; data: ChartData }>();
const TTL = 10 * 60 * 1000;

export async function fetchChart(symbol: string, range = "1y"): Promise<ChartData | null> {
  const cached = chartCache.get(`${symbol}:${range}`);
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${range}&interval=1d`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const ts: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    const candles: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = q.close?.[i];
      if (c == null) continue;
      candles.push({
        t: (ts[i] ?? 0) * 1000,
        o: q.open?.[i] ?? c,
        h: q.high?.[i] ?? c,
        l: q.low?.[i] ?? c,
        c,
        v: q.volume?.[i] ?? 0,
      });
    }
    if (candles.length < 30) return null;
    const meta = result.meta ?? {};
    const price = meta.regularMarketPrice ?? candles[candles.length - 1]!.c;
    const changePct =
      meta.regularMarketChangePercent ??
      ((price - candles[candles.length - 2]!.c) / candles[candles.length - 2]!.c) * 100;
    const data = { symbol, price, changePct, currency: meta.currency ?? "USD", candles };
    chartCache.set(`${symbol}:${range}`, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

export type Fundamentals = {
  marketCap: number | null;
  peForward: number | null;
  peTrailing: number | null;
  eps: number | null;
  revenueGrowth: number | null;
  profitMargin: number | null;
  targetMean: number | null;
  beta: number | null;
};

export async function fetchFundamentals(symbol: string): Promise<Fundamentals | null> {
  const modules = "summaryDetail,defaultKeyStatistics,financialData";
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol,
  )}?modules=${modules}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const r = json?.quoteSummary?.result?.[0];
    if (!r) return null;
    const raw = (v: any) => (typeof v?.raw === "number" ? v.raw : null);
    return {
      marketCap: raw(r.summaryDetail?.marketCap),
      peForward: raw(r.summaryDetail?.forwardPE),
      peTrailing: raw(r.summaryDetail?.trailingPE),
      eps: raw(r.defaultKeyStatistics?.trailingEps),
      revenueGrowth: raw(r.financialData?.revenueGrowth),
      profitMargin: raw(r.financialData?.profitMargins),
      targetMean: raw(r.financialData?.targetMeanPrice),
      beta: raw(r.summaryDetail?.beta),
    };
  } catch {
    return null;
  }
}

/** Hämtar flera symboler med begränsad parallellitet och en retry vid rate limit (429). */
export async function fetchCharts(symbols: string[], concurrency = 4): Promise<ChartData[]> {
  const out: ChartData[] = [];
  const queue = [...symbols];
  const worker = async () => {
    while (queue.length) {
      const symbol = queue.shift();
      if (!symbol) break;
      let chart = await fetchChart(symbol);
      if (!chart) {
        await new Promise((r) => setTimeout(r, 400));
        chart = await fetchChart(symbol);
      }
      if (chart) out.push(chart);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));
  return out;
}
