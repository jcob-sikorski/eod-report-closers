import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TextItem } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

// Shared by the closer and setter dashboard views.

export const OUTCOME_TONE: Record<string, string> = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  open: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  lost: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  disqualified: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  no_show: "border-zinc-500/30 bg-zinc-500/10 text-zinc-500",
};

export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);
export const num = (v: number | null, d = 1) => (v === null ? "—" : v.toFixed(d).replace(".", ","));
export const plDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {sub && <p className="text-muted-foreground truncate text-xs">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function ChartCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 gap-4", className)}>
      <CardHeader>
        <CardTitle className="text-base tracking-tight">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const FEED_LIMIT = 60;

export function Feed({ items, extraLabel, quote }: { items: TextItem[]; extraLabel?: string; quote?: boolean }) {
  if (!items.length) return <p className="text-muted-foreground py-8 text-center text-sm">Brak wpisów w tym okresie.</p>;
  return (
    <div>
      <ul className="max-h-[36rem] divide-y overflow-y-auto pr-2">
        {items.slice(0, FEED_LIMIT).map((it) => (
          <li key={it.id} className="space-y-1.5 py-4 first:pt-3">
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="tabular-nums">{plDate(it.date)}</span>
              <span aria-hidden>·</span>
              <span>{it.closer}</span>
              {it.prospect && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-foreground font-medium">{it.prospect}</span>
                </>
              )}
              {it.outcome && (
                <Badge variant="outline" className={cn("font-normal", OUTCOME_TONE[it.outcome])}>{it.outcomeLabel}</Badge>
              )}
            </div>
            <p className={cn("text-[15px] leading-relaxed whitespace-pre-line", quote && "border-l-2 pl-3 italic")}>
              {quote ? `„${it.text}”` : it.text}
            </p>
            {it.extra && (
              <p className="text-muted-foreground text-sm whitespace-pre-line">
                {extraLabel && <span className="font-medium">{extraLabel}: </span>}
                {it.extra}
              </p>
            )}
          </li>
        ))}
      </ul>
      {items.length > FEED_LIMIT && (
        <p className="text-muted-foreground pt-3 text-xs">
          Pokazano {FEED_LIMIT} z {items.length}. Zawęź zakres dat lub użyj zapytań z <code>supabase/queries/</code>.
        </p>
      )}
    </div>
  );
}
