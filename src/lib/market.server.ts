// Hämtar aktuella kursnivåer, historik och fundamenta från Nasdaqs öppna API (ingen nyckel).
import type { Candle } from "./stocks";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";
const HEADERS = { "User-Agent": UA, Accept: "application/json" };
const BASE = "https://api.nasdaq.com/api/quote";

export type ChartData = {
  symbol: string;
  price: number;
  changePct: number;
  currency: string;
  candles: Candle[];
};

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === "N/A" || cleaned === "--") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const chartCache = new Map<string, { at: number; data: ChartData }>();
const TTL = 10 * 60 * 1000;

export async function fetchChart(symbol: string, days = 420): Promise<ChartData | null> {
  const key = `${symbol}:${days}`;
  const cached = chartCache.get(key);
  if (cached && Date.now() - cached.at < TTL) return cached.data;

  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const url = `${BASE}/${encodeURIComponent(symbol)}/historical?assetclass=stocks&limit=${days}&fromdate=${ymd(
    from,
  )}&todate=${ymd(to)}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const rows: any[] = json?.data?.tradesTable?.rows ?? [];
    const candles: Candle[] = [];
    for (const row of rows) {
      const c = num(row?.close);
      if (c == null) continue;
      const [m, d, y] = String(row.date ?? "").split("/");
      const t = Date.parse(`${y}-${m}-${d}T00:00:00Z`);
      if (!Number.isFinite(t)) continue;
      candles.push({
        t,
        o: num(row.open) ?? c,
        h: num(row.high) ?? c,
        l: num(row.low) ?? c,
        c,
        v: num(row.volume) ?? 0,
      });
    }
    candles.sort((a, b) => a.t - b.t);
    if (candles.length < 30) return null;

    let price = candles[candles.length - 1]!.c;
    let changePct =
      ((price - candles[candles.length - 2]!.c) / candles[candles.length - 2]!.c) * 100;
    try {
      const infoRes = await fetch(`${BASE}/${encodeURIComponent(symbol)}/info?assetclass=stocks`, {
        headers: HEADERS,
      });
      if (infoRes.ok) {
        const info = (await infoRes.json()) as any;
        const p = num(info?.data?.primaryData?.lastSalePrice);
        const pct = num(info?.data?.primaryData?.percentageChange);
        if (p != null) price = p;
        if (pct != null) changePct = pct;
      }
    } catch {
      /* live-kurs är valfri, historiken räcker */
    }

    const data: ChartData = { symbol, price, changePct, currency: "USD", candles };
    chartCache.set(key, { at: Date.now(), data });
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

const fundamentalsCache = new Map<string, { at: number; data: Fundamentals }>();

export async function fetchFundamentals(symbol: string): Promise<Fundamentals | null> {
  const cached = fundamentalsCache.get(symbol);
  if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.data;
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(symbol)}/summary?assetclass=stocks`, {
      headers: HEADERS,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const s = json?.data?.summaryData;
    if (!s) return null;
    const data: Fundamentals = {
      marketCap: num(s.MarketCap?.value),
      peForward: num(s.ForwardPE1Yr?.value),
      peTrailing: num(s.PERatio?.value),
      eps: num(s.EarningsPerShare?.value),
      revenueGrowth: null,
      profitMargin: null,
      targetMean: num(s.OneYrTarget?.value),
      beta: num(s.Beta?.value),
    };
    fundamentalsCache.set(symbol, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hämtar flera symboler parallellt med måttlig samtidighet och retry. */
export async function fetchCharts(symbols: string[], concurrency = 5): Promise<ChartData[]> {
  const out: ChartData[] = [];
  const queue = [...symbols];
  const worker = async () => {
    while (queue.length) {
      const symbol = queue.shift();
      if (!symbol) break;
      for (let attempt = 0; attempt < 3; attempt++) {
        const chart = await fetchChart(symbol);
        if (chart) {
          out.push(chart);
          break;
        }
        await sleep(250 * (attempt + 1));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));
  return out;
}
