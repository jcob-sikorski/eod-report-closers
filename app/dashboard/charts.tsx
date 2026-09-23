"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const fmtPct = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);
const fmtDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
};

// ─── Horizontal bar list ────────────────────────────────────────────────────
// One series → one colour, no legend (the card title names it). Values sit at
// the bar tip; hover/focus adds the exact share of the denominator.

export function BarList({
  items,
  total,
  unit = "rozmów",
  emptyText = "Brak danych w tym okresie.",
}: {
  items: { key: string; label: string; value: number }[];
  total: number;
  unit?: string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));

  if (!items.length || total === 0) return <p className="text-muted-foreground py-6 text-sm">{emptyText}</p>;

  return (
    <ul className="@container space-y-1">
      {items.map((it) => {
        const share = total ? (100 * it.value) / total : 0;
        const on = hover === it.key;
        return (
          <li
            key={it.key}
            tabIndex={0}
            onPointerEnter={() => setHover(it.key)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(it.key)}
            onBlur={() => setHover(null)}
            aria-label={`${it.label}: ${it.value} z ${total} ${unit}, ${Math.round(share)}%`}
            className={cn(
              "relative grid grid-cols-1 gap-1 rounded-md px-2 py-1.5 outline-none @md:grid-cols-[minmax(0,11rem)_1fr] @md:items-center @md:gap-3",
              on && "bg-muted/60",
              "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            )}
          >
            <span className="text-foreground truncate text-sm" title={it.label}>{it.label}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn("h-4 shrink-0 rounded-r-[4px] transition-[width,filter] duration-300", on && "brightness-110")}
                style={{
                  width: it.value ? `calc((100% - 5.5rem) * ${it.value / max})` : "0px",
                  minWidth: it.value ? 2 : 0,
                  background: "var(--series-1)",
                }}
              />
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                <span className="text-foreground font-medium">{it.value}</span> · {Math.round(share)}%
              </span>
            </span>
            {on && (
              <span className="bg-popover text-popover-foreground pointer-events-none absolute top-full right-2 z-10 mt-1 rounded-md border px-2.5 py-1.5 text-xs shadow-md">
                <strong className="font-semibold">{it.value}</strong> z {total} {unit} · {share.toFixed(1)}%
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Trend: show rate & close rate per day ─────────────────────────────────
// Two series on one 0–100% axis. Legend always shown; end labels when they
// don't collide; crosshair snaps to the nearest day; table view below.

type Point = { date: string; booked: number; held: number; won: number };

const SERIES = [
  { key: "show", label: "Show rate", color: "var(--series-1)", value: (p: Point) => (p.booked ? (100 * p.held) / p.booked : null) },
  { key: "close", label: "Close rate", color: "var(--series-2)", value: (p: Point) => (p.held ? (100 * p.won) / p.held : null) },
] as const;

export function TrendChart({ points }: { points: Point[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 220;
  const m = { top: 12, right: 44, bottom: 26, left: 36 };
  const iw = w - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const t0 = points.length ? Date.parse(points[0].date) : 0;
  const t1 = points.length ? Date.parse(points[points.length - 1].date) : 0;
  const x = (iso: string) => (t1 === t0 ? m.left + iw / 2 : m.left + ((Date.parse(iso) - t0) / (t1 - t0)) * iw);
  const y = (v: number) => m.top + ih - (v / 100) * ih;

  const paths = useMemo(
    () =>
      SERIES.map((s) => {
        let d = "";
        let pen = false;
        for (const p of points) {
          const v = s.value(p);
          if (v === null) { pen = false; continue; }
          d += `${pen ? "L" : "M"}${x(p.date).toFixed(1)},${y(v).toFixed(1)}`;
          pen = true;
        }
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, w],
  );

  if (!points.length) return <p className="text-muted-foreground py-6 text-sm">Brak danych w tym okresie.</p>;

  const xTicks = points.length <= 2 ? points : [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  const hovered = idx !== null ? points[idx] : null;

  const nearest = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    return best;
  };

  const tipLeft = hovered ? Math.min(Math.max(x(hovered.date) + 12, 0), w - 228) : 0;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap gap-4 text-xs">
        {SERIES.map((s) => (
          <span key={s.key} className="text-muted-foreground inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={wrap} className="relative w-full min-w-0 overflow-hidden">
        <svg
          width={w}
          height={H}
          role="img"
          aria-label="Show rate i close rate w kolejnych dniach"
          tabIndex={0}
          className="block touch-none outline-none"
          onPointerMove={(e) => setIdx(nearest(e.clientX))}
          onPointerLeave={() => setIdx(null)}
          onFocus={() => setIdx(points.length - 1)}
          onBlur={() => setIdx(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, (i ?? points.length - 1) - 1));
            if (e.key === "ArrowRight") setIdx((i) => Math.min(points.length - 1, (i ?? 0) + 1));
          }}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={m.left} x2={w - m.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} strokeWidth={1} />
              <text x={m.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {v}%
              </text>
            </g>
          ))}
          {xTicks.map((p, i) => (
            <text
              key={p.date}
              x={x(p.date)}
              y={H - 6}
              textAnchor={xTicks.length > 1 && i === 0 ? "start" : xTicks.length > 1 && i === xTicks.length - 1 ? "end" : "middle"}
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {fmtDate(p.date)}
            </text>
          ))}

          {hovered && <line x1={x(hovered.date)} x2={x(hovered.date)} y1={m.top} y2={m.top + ih} stroke="var(--chart-axis)" strokeWidth={1} />}

          {SERIES.map((s, si) => (
            <path key={s.key} d={paths[si]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* Points: every day when there are few, otherwise only the hovered one + the last */}
          {SERIES.map((s) =>
            points.map((p, i) => {
              const v = s.value(p);
              const show = points.length <= 14 || i === idx || i === points.length - 1;
              if (v === null || !show) return null;
              return (
                <circle key={`${s.key}-${p.date}`} cx={x(p.date)} cy={y(v)} r={i === idx ? 5 : 4} fill={s.color} stroke="var(--card)" strokeWidth={2} />
              );
            }),
          )}
          {/* Direct end labels — only when they don't collide (legend carries identity otherwise) */}
          {(() => {
            const last = points[points.length - 1];
            const ends = SERIES.map((s) => ({ s, v: s.value(last) })).filter((e): e is { s: (typeof SERIES)[number]; v: number } => e.v !== null);
            if (ends.length === 2 && Math.abs(y(ends[0].v) - y(ends[1].v)) < 14) return null;
            return ends.map(({ s, v }) => (
              <text key={s.key} x={x(last.date) + 9} y={y(v)} dy="0.32em" className="fill-foreground text-[11px] font-medium tabular-nums">
                {Math.round(v)}%
              </text>
            ));
          })()}
        </svg>

        {hovered && (
          <div className="bg-popover text-popover-foreground pointer-events-none absolute top-2 z-10 w-56 rounded-md border px-3 py-2 text-xs shadow-md" style={{ left: tipLeft }}>
            <div className="text-muted-foreground mb-1.5">{fmtDate(hovered.date)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <strong className="font-semibold tabular-nums">{fmtPct(s.value(hovered))}</strong>
              </div>
            ))}
            <div className="text-muted-foreground mt-1.5 border-t pt-1.5 tabular-nums">
              {hovered.booked} umówione · {hovered.held} odbyte · {hovered.won} sprzedaż
            </div>
          </div>
        )}
      </div>

      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">Pokaż tabelę</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-muted/50 text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Dzień</th>
                <th className="px-3 py-2 text-right font-medium">Umówione</th>
                <th className="px-3 py-2 text-right font-medium">Odbyte</th>
                <th className="px-3 py-2 text-right font-medium">Sprzedaż</th>
                <th className="px-3 py-2 text-right font-medium">Show rate</th>
                <th className="px-3 py-2 text-right font-medium">Close rate</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t">
                  <td className="px-3 py-1.5">{p.date}</td>
                  <td className="px-3 py-1.5 text-right">{p.booked}</td>
                  <td className="px-3 py-1.5 text-right">{p.held}</td>
                  <td className="px-3 py-1.5 text-right">{p.won}</td>
                  <td className="px-3 py-1.5 text-right">{fmtPct(SERIES[0].value(p))}</td>
                  <td className="px-3 py-1.5 text-right">{fmtPct(SERIES[1].value(p))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
