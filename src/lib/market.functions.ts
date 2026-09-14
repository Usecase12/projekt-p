import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { analyse, UNIVERSE, type Analysis, type Candle } from "./stocks";

export type DashboardData = {
  updatedAt: string;
  rows: Analysis[];
};

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    const { fetchCharts } = await import("./market.server");
    const charts = await fetchCharts(UNIVERSE.map((s) => s.symbol));
    const results = charts.map((chart) =>
      analyse(chart.symbol, chart.candles, chart.price, chart.changePct, chart.currency),
    );
    const rows = results;

    // Daglig lagring: en rad per aktie och dag (idempotent).
    if (rows.length) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("analysis_history").upsert(
          rows.map((r) => ({
            symbol: r.symbol,
            signal: r.signal,
            price: r.price,
            entry: r.entry,
            stop_loss: r.stopLoss,
            take_profit: r.takeProfit,
            r_multiple: r.r,
            upside_pct: r.upsidePct,
            horizon: r.horizon,
          })),
          { onConflict: "symbol,trade_date" },
        );
      } catch (error) {
        console.error("Kunde inte spara historik", error);
      }
    }

    return { updatedAt: new Date().toISOString(), rows };
  },
);

export type StockDetail = {
  analysis: Analysis;
  candles: Candle[];
  fundamentals: Awaited<ReturnType<typeof import("./market.server").fetchFundamentals>>;
};

export const getStock = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ symbol: z.string().min(1).max(8) }).parse(data))
  .handler(async ({ data }): Promise<StockDetail> => {
    const symbol = data.symbol.toUpperCase();
    const { fetchChart, fetchFundamentals } = await import("./market.server");
    const [chart, fundamentals] = await Promise.all([
      fetchChart(symbol),
      fetchFundamentals(symbol),
    ]);
    if (!chart) throw new Error(`Ingen kursdata hittades för ${symbol}`);
    const analysis = analyse(symbol, chart.candles, chart.price, chart.changePct, chart.currency);
    return { analysis, candles: chart.candles.slice(-180), fundamentals };
  });

export type HistoryRow = {
  symbol: string;
  trade_date: string;
  signal: string;
  price: number;
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  r_multiple: number | null;
  upside_pct: number | null;
  horizon: string | null;
};

export const getHistory = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ symbol: z.string().max(8).optional() })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<HistoryRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("analysis_history")
      .select(
        "symbol,trade_date,signal,price,entry,stop_loss,take_profit,r_multiple,upside_pct,horizon",
      )
      .order("trade_date", { ascending: false })
      .limit(300);
    if (data.symbol) query = query.eq("symbol", data.symbol.toUpperCase());
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as HistoryRow[];
  });
