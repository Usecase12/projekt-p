import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Shell, SignalBadge } from "@/components/Shell";
import { historyQuery } from "@/lib/queries";
import { UNIVERSE } from "@/lib/stocks";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Historik – sparade signaler och nivåer" },
      {
        name: "description",
        content:
          "Daglig historik över signal, pris, IN, SL, TP, R, uppsida och horisont för Nasdaq 100-aktierna.",
      },
      { property: "og:title", content: "Historik – sparade signaler och nivåer" },
      { property: "og:description", content: "Se hur signaler och nivåer utvecklats dag för dag." },
    ],
  }),
  component: History,
});

function History() {
  const [symbol, setSymbol] = useState("");
  const { data, isLoading } = useQuery(historyQuery(symbol || undefined));

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Historik</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            En rad sparas per aktie och dag när analysen körs.
          </p>
        </div>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Alla aktier</option>
          {UNIVERSE.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.symbol}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar historik…</p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">Ingen historik sparad ännu.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left">Datum</th>
                <th className="px-3 py-2 text-left">Aktie</th>
                <th className="px-3 py-2 text-left">Signal</th>
                <th className="px-3 py-2 text-right">Pris</th>
                <th className="px-3 py-2 text-right">IN</th>
                <th className="px-3 py-2 text-right">SL</th>
                <th className="px-3 py-2 text-right">TP</th>
                <th className="px-3 py-2 text-right">R</th>
                <th className="px-3 py-2 text-right">Uppsida</th>
                <th className="px-3 py-2 text-left">Horisont</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={`${row.symbol}-${row.trade_date}`}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="num px-3 py-2">{row.trade_date}</td>
                  <td className="px-3 py-2 font-medium">{row.symbol}</td>
                  <td className="px-3 py-2">
                    <SignalBadge signal={row.signal} />
                  </td>
                  <td className="num px-3 py-2 text-right">{row.price}</td>
                  <td className="num px-3 py-2 text-right">{row.entry ?? "-"}</td>
                  <td className="num px-3 py-2 text-right">{row.stop_loss ?? "-"}</td>
                  <td className="num px-3 py-2 text-right">{row.take_profit ?? "-"}</td>
                  <td className="num px-3 py-2 text-right">
                    {row.r_multiple ? `1:${row.r_multiple}` : "-"}
                  </td>
                  <td className="num px-3 py-2 text-right">
                    {row.upside_pct != null ? `${row.upside_pct}%` : "-"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.horizon ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
