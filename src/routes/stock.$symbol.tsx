import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Area, AreaChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, Shell, SignalBadge } from "@/components/Shell";
import { getAiConsensus } from "@/lib/ai.functions";
import { stockQuery } from "@/lib/queries";
import { sma } from "@/lib/stocks";

export const Route = createFileRoute("/stock/$symbol")({
  head: ({ params }) => {
    const symbol = params.symbol.toUpperCase();
    return {
      meta: [
        { title: `${symbol} – teknisk analys, nivåer och AI-consensus` },
        {
          name: "description",
          content: `${symbol}: aktuell kurs, SMA50, SMA200, RSI14, volym, fundamenta och AI-teamets samlade bedömning med IN, SL, TP och R.`,
        },
        { property: "og:title", content: `${symbol} – teknisk analys och AI-consensus` },
        {
          property: "og:description",
          content: `Kurs, indikatorer, fundamenta och nivåer för ${symbol}.`,
        },
      ],
    };
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(stockQuery(params.symbol.toUpperCase())),
  component: StockPage,
});

function fmtBig(n: number | null) {
  if (n == null) return "-";
  const units = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
  ] as const;
  for (const [size, suffix] of units) {
    if (Math.abs(n) >= size) return `${(n / size).toFixed(2)}${suffix}`;
  }
  return n.toFixed(2);
}

const pct = (n: number | null) => (n == null ? "-" : `${(n * 100).toFixed(1)}%`);

function StockPage() {
  const { symbol } = Route.useParams();
  const { data } = useSuspenseQuery(stockQuery(symbol.toUpperCase()));
  const a = data.analysis;
  const f = data.fundamentals;

  const aiFn = useServerFn(getAiConsensus);
  const ai = useMutation({ mutationFn: () => aiFn({ data: { symbol: a.symbol } }) });

  const chartData = data.candles.map((c, i, arr) => {
    const closes = arr.slice(0, i + 1).map((x) => x.c);
    return {
      date: new Date(c.t).toLocaleDateString("sv-SE"),
      close: c.c,
      sma50: sma(closes, 50),
    };
  });

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {a.symbol} <span className="text-muted-foreground">· {a.name}</span>
          </h1>
          <p className="text-sm text-muted-foreground">{a.sector}</p>
        </div>
        <div className="text-right">
          <div className="num text-2xl font-semibold">
            {a.price} {a.currency}
          </div>
          <div
            className={`num text-sm ${a.changePct >= 0 ? "text-success" : "text-destructive"}`}
          >
            {a.changePct > 0 ? "+" : ""}
            {a.changePct}% idag
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Kursutveckling 180 dagar (pris vs SMA50)" className="lg:col-span-2">
          <div className="h-64">
            <ClientOnly fallback={<div className="h-full rounded bg-muted/40" />}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={40} />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11 }}
                    width={55}
                    tickFormatter={(v: number) => v.toFixed(0)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    name="Pris"
                    stroke="var(--color-primary)"
                    fill="url(#fill)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sma50"
                    name="SMA50"
                    stroke="var(--color-warning)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        </Card>

        <Card title="Signal och nivåer">
          <div className="mb-3 flex items-center gap-2">
            <SignalBadge signal={a.signal} />
            <span className="text-sm text-muted-foreground">
              {a.criteriaMet}/6 kriterier · {a.horizon}
            </span>
          </div>
          <dl className="divide-y divide-border text-sm">
            {[
              ["IN", a.entry],
              ["SL", a.stopLoss],
              ["TP", a.takeProfit],
              ["R", `1:${a.r}`],
              ["Uppsida", `${a.upsidePct}%`],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="num font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {a.r >= 3
              ? "R uppfyller kravet 1:3."
              : "R är under 1:3 – ingen LONG-signal ges i detta läge."}
          </p>
        </Card>

        <Card title="Indikatorer">
          <dl className="divide-y divide-border text-sm">
            {[
              ["SMA50", a.sma50 ?? "-"],
              ["SMA200", a.sma200 ?? "-"],
              ["RSI14", a.rsi14 ?? "-"],
              ["Volym", a.volume.toLocaleString("sv-SE")],
              ["Volym vs snitt 20d", a.volumeRatio ? `${a.volumeRatio}x` : "-"],
              ["20d högsta", a.high20],
              ["10d lägsta", a.low10],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="num font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="P-strategi">
          <ul className="space-y-2 text-sm">
            {a.criteria.map((c) => (
              <li key={c.label} className="flex items-start justify-between gap-3">
                <span className={c.ok ? "text-success" : "text-muted-foreground"}>
                  {c.ok ? "✓" : "○"} {c.label}
                </span>
                <span className="num text-right text-xs text-muted-foreground">{c.detail}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Fundamenta">
          <dl className="divide-y divide-border text-sm">
            {[
              ["Börsvärde", fmtBig(f?.marketCap ?? null)],
              ["P/E (fwd)", f?.peForward?.toFixed(1) ?? "-"],
              ["P/E (ttm)", f?.peTrailing?.toFixed(1) ?? "-"],
              ["EPS", f?.eps?.toFixed(2) ?? "-"],
              ["Omsättningstillväxt", pct(f?.revenueGrowth ?? null)],
              ["Vinstmarginal", pct(f?.profitMargin ?? null)],
              ["Analytikermål", f?.targetMean?.toFixed(2) ?? "-"],
              ["Beta", f?.beta?.toFixed(2) ?? "-"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="num font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="AI Consensus" className="lg:col-span-3">
          {!ai.data ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => ai.mutate()}
                disabled={ai.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {ai.isPending ? "AI-teamet analyserar…" : "Kör AI-teamets analys"}
              </button>
              <span className="text-xs text-muted-foreground">
                Ett samlat anrop per aktie och dag – resultatet sparas för att hålla nere
                tokenanvändningen.
              </span>
              {ai.isError ? (
                <span className="text-sm text-destructive">{(ai.error as Error).message}</span>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <SignalBadge signal={ai.data.verdict} />
                <span className="text-sm text-muted-foreground">
                  Conviction {ai.data.conviction}/10 · {ai.data.date}
                  {ai.data.cached ? " (sparad analys)" : ""}
                </span>
              </div>
              <p className="text-sm">{ai.data.summary}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["Technical Analyst", ai.data.technical],
                  ["Equity Research", ai.data.research],
                  ["Macro Strategist", ai.data.macro],
                  ["Risk Manager", ai.data.risk],
                  ["Portfolio Manager", ai.data.verdict + " – " + ai.data.summary],
                ].map(([role, text]) => (
                  <div key={role} className="rounded-md border border-border bg-background p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {role}
                    </div>
                    <p className="mt-1 text-sm">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
