// Aktieuniversum och all teknisk analyslogik (ren, delad mellan server och klient).

export type Signal = "LONG" | "WATCH" | "NEUTRAL" | "AVOID";

export type StockMeta = { symbol: string; name: string; sector: string };

/** Start: 20 utvalda Nasdaq 100-aktier. Lägg bara till rader här för att skala till 100. */
export const UNIVERSE: StockMeta[] = [
  { symbol: "AAPL", name: "Apple", sector: "Teknik" },
  { symbol: "MSFT", name: "Microsoft", sector: "Teknik" },
  { symbol: "NVDA", name: "NVIDIA", sector: "Halvledare" },
  { symbol: "AMZN", name: "Amazon", sector: "Konsument" },
  { symbol: "META", name: "Meta Platforms", sector: "Kommunikation" },
  { symbol: "GOOGL", name: "Alphabet", sector: "Kommunikation" },
  { symbol: "AVGO", name: "Broadcom", sector: "Halvledare" },
  { symbol: "TSLA", name: "Tesla", sector: "Konsument" },
  { symbol: "COST", name: "Costco", sector: "Konsument" },
  { symbol: "NFLX", name: "Netflix", sector: "Kommunikation" },
  { symbol: "AMD", name: "AMD", sector: "Halvledare" },
  { symbol: "ADBE", name: "Adobe", sector: "Mjukvara" },
  { symbol: "PEP", name: "PepsiCo", sector: "Dagligvaror" },
  { symbol: "CSCO", name: "Cisco", sector: "Nätverk" },
  { symbol: "LIN", name: "Linde", sector: "Material" },
  { symbol: "QCOM", name: "Qualcomm", sector: "Halvledare" },
  { symbol: "AMAT", name: "Applied Materials", sector: "Halvledare" },
  { symbol: "INTU", name: "Intuit", sector: "Mjukvara" },
  { symbol: "TXN", name: "Texas Instruments", sector: "Halvledare" },
  { symbol: "BKNG", name: "Booking Holdings", sector: "Resor" },
];

export const UNIVERSE_MAP = new Map(UNIVERSE.map((s) => [s.symbol, s]));

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export type Analysis = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  currency: string;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  volume: number;
  volumeAvg20: number | null;
  volumeRatio: number | null;
  high20: number;
  low10: number;
  distSma50Pct: number | null;
  criteria: { label: string; ok: boolean; detail: string }[];
  criteriaMet: number;
  signal: Signal;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  r: number;
  upsidePct: number;
  horizon: string;
  updatedAt: string;
};

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * P-strategin: trend, pullback, RSI 30-40, stöd vid SMA50, volym och bullish reversal.
 * Signal LONG ges bara när trenden är intakt, minst 4 kriterier uppfylls och R >= 1:3.
 */
export function analyse(
  symbol: string,
  candles: Candle[],
  price: number,
  changePct: number,
  currency = "USD",
): Analysis {
  const meta = UNIVERSE_MAP.get(symbol) ?? { symbol, name: symbol, sector: "-" };
  const closes = candles.map((c) => c.c);
  const volumes = candles.map((c) => c.v);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;

  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const r14 = rsi(closes, 14);
  const vAvg20 = sma(volumes, 20);
  const window20 = candles.slice(-20);
  const high20 = Math.max(...window20.map((c) => c.h));
  const low10 = Math.min(...candles.slice(-10).map((c) => c.l));
  const volumeRatio = vAvg20 && vAvg20 > 0 ? last.v / vAvg20 : null;
  const distSma50Pct = s50 ? ((price - s50) / s50) * 100 : null;
  const pullbackPct = ((high20 - price) / high20) * 100;

  const trendOk = !!s200 && !!s50 && price > s200 && s50 > s200;
  const pullbackOk = pullbackPct >= 3 && pullbackPct <= 15;
  const rsiOk = !!r14 && r14 >= 30 && r14 <= 42;
  const supportOk = !!s50 && price >= s50 * 0.96 && price <= s50 * 1.06;
  const volumeOk = !!volumeRatio && volumeRatio >= 0.8;
  const reversalOk = last.c > prev.c && last.c > (last.o + last.h) / 2 && last.l >= prev.l * 0.99;

  const criteria = [
    {
      label: "Trend",
      ok: trendOk,
      detail: s200 ? `Pris ${round(price)} vs SMA200 ${round(s200)}` : "För kort historik",
    },
    { label: "Pullback", ok: pullbackOk, detail: `${round(pullbackPct, 1)}% från 20d-högsta` },
    { label: "RSI 30-40", ok: rsiOk, detail: r14 ? `RSI ${round(r14, 1)}` : "-" },
    {
      label: "Stöd / SMA50",
      ok: supportOk,
      detail: distSma50Pct !== null ? `${round(distSma50Pct, 1)}% från SMA50` : "-",
    },
    {
      label: "Volym",
      ok: volumeOk,
      detail: volumeRatio ? `${round(volumeRatio, 2)}x snitt 20d` : "-",
    },
    { label: "Bullish reversal", ok: reversalOk, detail: reversalOk ? "Ja" : "Nej" },
  ];
  const criteriaMet = criteria.filter((c) => c.ok).length;

  const entry = round(price);
  const rawStop = Math.min(low10, s50 ? s50 * 0.97 : low10) * 0.995;
  const stopLoss = round(Math.min(rawStop, price * 0.985));
  const risk = Math.max(entry - stopLoss, 0.01);
  const takeProfit = round(Math.max(high20 * 1.03, entry + risk * 3));
  const r = round((takeProfit - entry) / risk, 2);
  const upsidePct = round(((takeProfit - entry) / entry) * 100, 1);

  let signal: Signal;
  if (!trendOk && s200 && s50 && price < s200 && s50 < s200) signal = "AVOID";
  else if (trendOk && criteriaMet >= 4 && r >= 3) signal = "LONG";
  else if (trendOk && criteriaMet >= 3) signal = "WATCH";
  else signal = "NEUTRAL";

  return {
    symbol,
    name: meta.name,
    sector: meta.sector,
    price: round(price),
    changePct: round(changePct, 2),
    currency,
    sma50: s50 ? round(s50) : null,
    sma200: s200 ? round(s200) : null,
    rsi14: r14 ? round(r14, 1) : null,
    volume: last.v,
    volumeAvg20: vAvg20 ? Math.round(vAvg20) : null,
    volumeRatio: volumeRatio ? round(volumeRatio, 2) : null,
    high20: round(high20),
    low10: round(low10),
    distSma50Pct: distSma50Pct !== null ? round(distSma50Pct, 1) : null,
    criteria,
    criteriaMet,
    signal,
    entry,
    stopLoss,
    takeProfit,
    r,
    upsidePct,
    horizon: signal === "LONG" ? "2-8 veckor" : "4-12 veckor",
    updatedAt: new Date().toISOString(),
  };
}

export const SIGNAL_ORDER: Record<Signal, number> = { LONG: 0, WATCH: 1, NEUTRAL: 2, AVOID: 3 };

export function signalClasses(signal: Signal) {
  switch (signal) {
    case "LONG":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "WATCH":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "AVOID":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
}
