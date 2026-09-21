import { createFileRoute } from "@tanstack/react-router";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

const TARGETS: Record<string, string> = {
  hist: "https://api.nasdaq.com/api/quote/AAPL/historical?assetclass=stocks&limit=400&fromdate=2025-01-01&todate=2026-09-14",
  info: "https://api.nasdaq.com/api/quote/AAPL/info?assetclass=stocks",
  summary: "https://api.nasdaq.com/api/quote/AAPL/summary?assetclass=stocks",
  yahoo2: "https://query2.finance.yahoo.com/v8/finance/chart/AAPL?range=1y&interval=1d",
  stooqCsv: "https://stooq.com/q/d/l/?s=aapl.us&i=d&d1=20240101&d2=20260914",
  stooqQuote: "https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv",
  nasdaq:
    "https://api.nasdaq.com/api/quote/AAPL/chart?assetclass=stocks&fromdate=2025-09-01&todate=2026-09-14",
  cnbc: "https://ts-api.cnbc.com/harmony/app/bootstrap/quote/AAPL.json",
  stockdata: "https://api.wsj.net/api/kaavio/charts/big.chart?nosettings=1&symb=AAPL",
};

export const Route = createFileRoute("/api/public/debug-fetch")({
  server: {
    handlers: {
      GET: async () => {
        const out: Record<string, unknown> = {};
        for (const [name, url] of Object.entries(TARGETS)) {
          try {
            const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
            const text = (await res.text()).slice(0, 700).replace(/\s+/g, " ");
            out[name] = { status: res.status, text };
          } catch (e) {
            out[name] = { error: String(e).slice(0, 700) };
          }
        }
        return new Response(JSON.stringify(out, null, 1), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
