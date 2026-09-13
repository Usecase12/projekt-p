import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { Card, Shell, SignalBadge } from "@/components/Shell";
import { dashboardQuery } from "@/lib/queries";
import { SIGNAL_ORDER, type Signal } from "@/lib/stocks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nasdaq 100 AI Trading – Dagliga signaler" },
      {
        name: "description",
        content:
          "Daglig AI-analys av 20 Nasdaq 100-aktier: P-strategi, RSI, SMA50/200, IN, SL, TP och R-kvot.",
      },
      { property: "og:title", content: "Nasdaq 100 AI Trading – Dagliga signaler" },
      {
        property: "og:description",
        content: "Signaler, nivåer och R-kvot för utvalda Nasdaq 100-aktier.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const rows = [...data.rows].sort(
    (a, b) => SIGNAL_ORDER[a.signal] - SIGNAL_ORDER[b.signal] || b.r - a.r,
  );
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.signal] = (acc[r.signal] ?? 0) + 1;
    return acc;
  }, {});
  const signals: Signal[] = ["LONG", "WATCH", "NEUTRAL", "AVOID"];

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Nasdaq 100 – dagens läge</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} aktier analyserade · uppdaterad{" "}
          {new Date(data.updatedAt).toLocaleString("sv-SE")}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {signals.map((s) => (
          <Card key={s} className="flex items-center justify-between">
            <SignalBadge signal={s} />
            <span className="num text-2xl font-semibold">{counts[s] ?? 0}</span>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left">Aktie</th>
              <th className="px-3 py-2 text-right">Pris</th>
              <th className="px-3 py-2 text-right">Dag</th>
              <th className="px-3 py-2 text-right">RSI</th>
              <th className="px-3 py-2 text-right">SMA50</th>
              <th className="px-3 py-2 text-right">SMA200</th>
              <th className="px-3 py-2 text-right">Volym</th>
              <th className="px-3 py-2 text-right">IN</th>
              <th className="px-3 py-2 text-right">SL</th>
              <th className="px-3 py-2 text-right">TP</th>
              <th className="px-3 py-2 text-right">R</th>
              <th className="px-3 py-2 text-right">Uppsida</th>
              <th className="px-3 py-2 text-left">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                <td className="px-3 py-2">
                  <Link
                    to="/stock/$symbol"
                    params={{ symbol: r.symbol }}
                    className="font-medium hover:text-primary"
                  >
                    {r.symbol}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.name}</div>
                </td>
                <td className="num px-3 py-2 text-right">{r.price}</td>
                <td
                  className={`num px-3 py-2 text-right ${r.changePct >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {r.changePct > 0 ? "+" : ""}
                  {r.changePct}%
                </td>
                <td className="num px-3 py-2 text-right">{r.rsi14 ?? "-"}</td>
                <td className="num px-3 py-2 text-right">{r.sma50 ?? "-"}</td>
                <td className="num px-3 py-2 text-right">{r.sma200 ?? "-"}</td>
                <td className="num px-3 py-2 text-right">
                  {r.volumeRatio ? `${r.volumeRatio}x` : "-"}
                </td>
                <td className="num px-3 py-2 text-right">{r.signal === "AVOID" ? "-" : r.entry}</td>
                <td className="num px-3 py-2 text-right">
                  {r.signal === "AVOID" ? "-" : r.stopLoss}
                </td>
                <td className="num px-3 py-2 text-right">
                  {r.signal === "AVOID" ? "-" : r.takeProfit}
                </td>
                <td className="num px-3 py-2 text-right">
                  {r.signal === "AVOID" ? "-" : `1:${r.r}`}
                </td>
                <td className="num px-3 py-2 text-right">
                  {r.signal === "AVOID" ? "-" : `${r.upsidePct}%`}
                </td>
                <td className="px-3 py-2">
                  <SignalBadge signal={r.signal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        LONG kräver intakt trend, minst 4 av 6 kriterier i P-strategin och R minst 1:3.
      </p>
    </Shell>
  );
}
