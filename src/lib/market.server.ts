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

// Yahoo kräver cookie + crumb för fundamentaldata. Sessionen cachas.
let session: { cookie: string; crumb: string; at: number } | null = null;

async function getSession(): Promise<{ cookie: string; crumb: string } | null> {
  if (session && Date.now() - session.at < 30 * 60 * 1000) return session;
  try {
    const res = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA } });
    const setCookie = res.headers.get("set-cookie") ?? "";
    const cookie = setCookie.split(";")[0] ?? "";
    if (!cookie) return null;
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie },
    });
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 40) return null;
    session = { cookie, crumb, at: Date.now() };
    return session;
  } catch {
    return null;
  }
}

const fundamentalsCache = new Map<string, { at: number; data: Fundamentals }>();

export async function fetchFundamentals(symbol: string): Promise<Fundamentals | null> {
  const cached = fundamentalsCache.get(symbol);
  if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.data;
  const s = await getSession();
  if (!s) return null;
  const modules = "summaryDetail,defaultKeyStatistics,financialData";
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol,
  )}?modules=${modules}&crumb=${encodeURIComponent(s.crumb)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json", Cookie: s.cookie },
    });
    if (!res.ok) {
      if (res.status === 401) session = null;
      return null;
    }
    const json = (await res.json()) as any;
    const r = json?.quoteSummary?.result?.[0];
    if (!r) return null;
    const raw = (v: any) => (typeof v?.raw === "number" ? v.raw : null);
    const data: Fundamentals = {
      marketCap: raw(r.summaryDetail?.marketCap),
      peForward: raw(r.summaryDetail?.forwardPE),
      peTrailing: raw(r.summaryDetail?.trailingPE),
      eps: raw(r.defaultKeyStatistics?.trailingEps),
      revenueGrowth: raw(r.financialData?.revenueGrowth),
      profitMargin: raw(r.financialData?.profitMargins),
      targetMean: raw(r.financialData?.targetMeanPrice),
      beta: raw(r.summaryDetail?.beta),
    };
    fundamentalsCache.set(symbol, { at: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hämtar flera symboler med låg parallellitet och backoff, eftersom källan rate-limitar burst. */
export async function fetchCharts(symbols: string[], concurrency = 3): Promise<ChartData[]> {
  const out: ChartData[] = [];
  const queue = [...symbols];
  const worker = async () => {
    while (queue.length) {
      const symbol = queue.shift();
      if (!symbol) break;
      for (let attempt = 0; attempt < 4; attempt++) {
        const chart = await fetchChart(symbol);
        if (chart) {
          out.push(chart);
          break;
        }
        await sleep(300 * (attempt + 1));
      }
      await sleep(60);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));
  return out;
}
