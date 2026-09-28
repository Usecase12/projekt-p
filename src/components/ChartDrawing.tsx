import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";

type Line = { id: string; kind: "line"; x1: number; y1: number; x2: number; y2: number };
type Note = { id: string; kind: "note"; x: number; y: number; text: string };
type Item = Line | Note;
type Mode = "off" | "line" | "note" | "edit";

const uid = () => Math.random().toString(36).slice(2, 9);

export function ChartDrawing({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("off");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Line | null>(null);
  const drag = useRef<{ id: string; px: number; py: number; part: "all" | "p1" | "p2" } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`draw:${storageKey}`);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (loaded) localStorage.setItem(`draw:${storageKey}`, JSON.stringify(items));
  }, [items, loaded, storageKey]);

  const pos = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    };
  };

  const onDown = (e: PointerEvent) => {
    const p = pos(e);
    if (mode === "line") {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDraft({ id: uid(), kind: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    } else if (mode === "note") {
      const text = window.prompt("Anteckning:")?.trim();
      if (text) setItems((s) => [...s, { id: uid(), kind: "note", x: p.x, y: p.y, text: text.slice(0, 80) }]);
    } else if (mode === "edit") {
      setSelected(null);
    }
  };

  const onMove = (e: PointerEvent) => {
    const p = pos(e);
    if (draft) setDraft({ ...draft, x2: p.x, y2: p.y });
    const d = drag.current;
    if (d) {
      const dx = p.x - d.px;
      const dy = p.y - d.py;
      d.px = p.x;
      d.py = p.y;
      setItems((s) =>
        s.map((it) => {
          if (it.id !== d.id) return it;
          if (it.kind === "note") return { ...it, x: it.x + dx, y: it.y + dy };
          if (d.part === "p1") return { ...it, x1: p.x, y1: p.y };
          if (d.part === "p2") return { ...it, x2: p.x, y2: p.y };
          return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy };
        }),
      );
    }
  };

  const onUp = () => {
    if (draft && Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 1) setItems((s) => [...s, draft]);
    setDraft(null);
    drag.current = null;
  };

  const startDrag = (e: PointerEvent, id: string, part: "all" | "p1" | "p2" = "all") => {
    if (mode !== "edit") return;
    e.stopPropagation();
    setSelected(id);
    const p = pos(e);
    drag.current = { id, px: p.x, py: p.y, part };
    ref.current?.setPointerCapture?.(e.pointerId);
  };

  const remove = (id: string) => {
    setItems((s) => s.filter((i) => i.id !== id));
    setSelected(null);
  };

  const editNote = (n: Note) => {
    const text = window.prompt("Ändra anteckning:", n.text)?.trim();
    if (text) setItems((s) => s.map((i) => (i.id === n.id ? { ...n, text: text.slice(0, 80) } : i)));
  };

  const active = mode !== "off";
  const tools: [Mode, string][] = [
    ["off", "👆 Graf"],
    ["line", "✏️ Linje"],
    ["note", "📝 Anteckning"],
    ["edit", "✋ Flytta/ta bort"],
  ];
  const lines = draft ? [...items, draft] : items;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {tools.map(([m, label]) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setSelected(null);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              mode === m
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        {selected ? (
          <button
            onClick={() => remove(selected)}
            className="rounded-full border border-destructive px-3 py-1 text-xs text-destructive"
          >
            🗑️ Ta bort vald
          </button>
        ) : null}
        {items.length ? (
          <button
            onClick={() => window.confirm("Rensa alla ritningar?") && setItems([])}
            className="ml-auto text-xs text-muted-foreground hover:text-destructive"
          >
            Rensa allt
          </button>
        ) : null}
      </div>
      <div ref={ref} className="relative h-64 select-none" onPointerMove={onMove} onPointerUp={onUp}>
        {children}
        <svg
          className="absolute inset-0 h-full w-full"
          style={{
            pointerEvents: active ? "auto" : "none",
            cursor: mode === "line" || mode === "note" ? "crosshair" : "default",
            touchAction: active ? "none" : "auto",
          }}
          onPointerDown={onDown}
        >
          {lines.map((it) =>
            it.kind === "line" ? (
              <g key={it.id}>
                <line
                  x1={`${it.x1}%`} y1={`${it.y1}%`} x2={`${it.x2}%`} y2={`${it.y2}%`}
                  stroke="transparent" strokeWidth={14}
                  style={{ cursor: mode === "edit" ? "move" : undefined }}
                  onPointerDown={(e) => startDrag(e, it.id)}
                />
                <line
                  x1={`${it.x1}%`} y1={`${it.y1}%`} x2={`${it.x2}%`} y2={`${it.y2}%`}
                  stroke={selected === it.id ? "var(--color-destructive)" : "var(--color-warning)"}
                  strokeWidth={2} strokeLinecap="round" pointerEvents="none"
                />
                {mode === "edit" && selected === it.id
                  ? (["p1", "p2"] as const).map((pt) => (
                      <circle
                        key={pt}
                        cx={`${pt === "p1" ? it.x1 : it.x2}%`}
                        cy={`${pt === "p1" ? it.y1 : it.y2}%`}
                        r={6}
                        fill="var(--color-card)"
                        stroke="var(--color-destructive)"
                        strokeWidth={2}
                        style={{ cursor: "grab" }}
                        onPointerDown={(e) => startDrag(e, it.id, pt)}
                      />
                    ))
                  : null}
              </g>
            ) : null,
          )}
        </svg>
        {items.map((it) =>
          it.kind === "note" ? (
            <div
              key={it.id}
              onPointerDown={(e) => startDrag(e, it.id)}
              onDoubleClick={() => editNote(it)}
              title={mode === "edit" ? "Dra för att flytta, dubbelklicka för att ändra" : undefined}
              className={`absolute max-w-[180px] -translate-y-1/2 rounded-md border px-2 py-0.5 text-xs shadow-sm ${
                selected === it.id ? "border-destructive" : "border-warning/60"
              } bg-card text-foreground`}
              style={{
                left: `${it.x}%`,
                top: `${it.y}%`,
                pointerEvents: mode === "edit" ? "auto" : "none",
                cursor: mode === "edit" ? "move" : undefined,
                touchAction: "none",
              }}
            >
              📝 {it.text}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
