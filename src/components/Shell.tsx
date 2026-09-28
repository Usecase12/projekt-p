import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "📊 Dashboard" },
  { to: "/calculator", label: "🧮 Kalkylator" },
  { to: "/history", label: "🕘 Historik" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            📈 NDX<span className="text-primary">100</span> AI Trading
          </Link>
          <nav className="flex gap-1 text-sm">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-primary/10 [&.active]:font-medium [&.active]:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs text-muted-foreground">
        Kursdata från öppen marknadskälla (fördröjning kan förekomma). Analyserna är
        informationsunderlag, inte investeringsrådgivning. 💡
      </footer>
    </div>
  );
}

const SIGNAL_EMOJI: Record<string, string> = {
  LONG: "🚀",
  WATCH: "👀",
  AVOID: "🚫",
  NEUTRAL: "🙂",
};

export function signalEmoji(signal: string) {
  return SIGNAL_EMOJI[signal] ?? SIGNAL_EMOJI["NEUTRAL"];
}

export function SignalBadge({ signal, className = "" }: { signal: string; className?: string }) {
  const map: Record<string, string> = {
    LONG: "bg-success/10 text-success border-success/25",
    WATCH: "bg-warning/10 text-warning border-warning/25",
    AVOID: "bg-destructive/10 text-destructive border-destructive/25",
    NEUTRAL: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[signal] ?? map["NEUTRAL"]} ${className}`}
    >
      <span aria-hidden="true">{signalEmoji(signal)}</span>
      {signal}
    </span>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className}`}
    >
      {title ? (
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
