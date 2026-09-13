import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Card, Shell } from "@/components/Shell";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "Trading Calculator – positionsstorlek och R" },
      {
        name: "description",
        content:
          "Räkna ut max risk, antal aktier, positionsstorlek, potentiell vinst och R-kvot utifrån kapital, risk %, IN, SL och TP.",
      },
      { property: "og:title", content: "Trading Calculator – positionsstorlek och R" },
      {
        property: "og:description",
        content: "Positionsstorlek, risk och R-kvot för dina trades.",
      },
    ],
  }),
  component: Calculator,
});

const fmt = (n: number, d = 2) =>
  n.toLocaleString("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d });

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center rounded-md border border-input bg-background">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="num w-full bg-transparent px-3 py-2 text-sm outline-none"
        />
        {suffix ? <span className="pr-3 text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </label>
  );
}

function Calculator() {
  const [capital, setCapital] = useState("100000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("100");
  const [stop, setStop] = useState("95");
  const [target, setTarget] = useState("115");

  const result = useMemo(() => {
    const num = (v: string) => Number(v.replace(",", ".")) || 0;
    const cap = num(capital);
    const risk = num(riskPct);
    const inPrice = num(entry);
    const sl = num(stop);
    const tp = num(target);
    const maxRisk = (cap * risk) / 100;
    const riskPerShare = inPrice - sl;
    if (riskPerShare <= 0 || inPrice <= 0 || maxRisk <= 0) return null;
    const shares = Math.floor(maxRisk / riskPerShare);
    const position = shares * inPrice;
    const profit = shares * (tp - inPrice);
    const loss = shares * riskPerShare;
    const r = (tp - inPrice) / riskPerShare;
    return { maxRisk, riskPerShare, shares, position, profit, loss, r };
  }, [capital, riskPct, entry, stop, target]);

  return (
    <Shell>
      <h1 className="mb-5 text-xl font-semibold tracking-tight">Trading Calculator</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Indata">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kapital" value={capital} onChange={setCapital} suffix="USD" />
            <Field label="Risk" value={riskPct} onChange={setRiskPct} suffix="%" />
            <Field label="IN" value={entry} onChange={setEntry} />
            <Field label="SL" value={stop} onChange={setStop} />
            <Field label="TP" value={target} onChange={setTarget} />
          </div>
        </Card>

        <Card title="Resultat">
          {!result ? (
            <p className="text-sm text-muted-foreground">
              Fyll i kapital, risk och nivåer. SL måste ligga under IN.
            </p>
          ) : (
            <>
              <dl className="divide-y divide-border text-sm">
                {[
                  ["Max risk", `${fmt(result.maxRisk)} USD`],
                  ["Risk per aktie", `${fmt(result.riskPerShare)} USD`],
                  ["Max antal aktier", `${result.shares}`],
                  ["Positionsstorlek", `${fmt(result.position)} USD`],
                  ["Potentiell vinst", `${fmt(result.profit)} USD`],
                  ["Potentiell förlust", `-${fmt(result.loss)} USD`],
                  ["R", `1:${fmt(result.r, 2)}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="num font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div
                className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
                  result.r >= 3
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning"
                }`}
              >
                {result.r >= 3
                  ? "R är minst 1:3 – uppfyller kravet."
                  : "R är under 1:3 – uppfyller inte kravet."}
              </div>
            </>
          )}
        </Card>
      </div>
    </Shell>
  );
}
