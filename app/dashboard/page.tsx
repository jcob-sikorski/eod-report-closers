import type { Metadata } from "next";
import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAuthed } from "@/lib/dashboard-auth";
import { RANGES, loadDashboard, type RangeValue, type TextItem } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { logout } from "./actions";
import { BarList, TrendChart } from "./charts";
import Filters from "./Filters";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard EOD — Closerzy" };

const OUTCOME_TONE: Record<string, string> = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  won_unpaid: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  open: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  lost: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  disqualified: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  no_show: "border-zinc-500/30 bg-zinc-500/10 text-zinc-500",
};

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);
const num = (v: number | null, d = 1) => (v === null ? "—" : v.toFixed(d).replace(".", ","));
const plDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; closer?: string }>;
}) {
  if (!(await isAuthed())) {
    return (
      <main className="flex min-h-dvh items-center px-4 py-16">
        <LoginForm configured={!!process.env.DASHBOARD_PASSWORD} />
      </main>
    );
  }

  const sp = await searchParams;
  const range: RangeValue = (RANGES.find((r) => r.value === sp.range)?.value ?? "30") as RangeValue;
  const closer = sp.closer?.trim() || null;

  let data;
  try {
    data = await loadDashboard(range, closer);
  } catch (e) {
    console.error("Dashboard load error:", e);
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Nie udało się wczytać danych</CardTitle>
            <CardDescription>
              Sprawdź, czy w Supabase uruchomiono aktualny <code>supabase/schema.sql</code> i czy zmienne środowiskowe są ustawione.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const t = data.totals;
  const rangeText = data.from ? `${plDate(data.from)} – ${plDate(data.to)}` : `do ${plDate(data.to)}`;

  return (
    <main className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,var(--color-muted),transparent_70%)]"
      />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-10 pb-24 sm:pt-14">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge variant="outline" className="rounded-full px-3 py-1 font-mono text-[11px] tracking-wider uppercase">
              Dashboard EOD · Closerzy
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Co mówią closerzy</h1>
            <p className="text-muted-foreground text-sm">
              {rangeText} · {data.reports} {data.reports === 1 ? "raport" : "raportów"}
              {closer ? ` · ${closer}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Formularz</Link>
            </Button>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                <LogOutIcon /> Wyloguj
              </Button>
            </form>
          </div>
        </header>

        <Filters ranges={RANGES} range={range} closers={data.closers} closer={closer} />

        {t.booked === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Brak raportów w wybranym okresie.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Stat label="Umówione rozmowy" value={String(t.booked)} sub={`${t.noShow} no-show · ${t.paid} zapłacone`} />
              <Stat label="Show rate" value={pct(t.showRate)} sub={`${t.held} z ${t.booked} odbytych`} />
              <Stat label="Close rate" value={pct(t.closeRate)} sub={`${t.won} z ${t.held} odbytych`} />
              <Stat label="Niezakwalifikowani" value={pct(t.dqRate)} sub={`${t.disqualified} z ${t.held} odbytych`} />
              <Stat label="Śr. dopasowanie" value={num(t.avgFit)} sub="w skali 1–5" />
              <Stat label="Śr. intencja zakupu" value={num(t.avgIntent)} sub="w skali 1–5" />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <ChartCard className="lg:col-span-2" title="Show rate i close rate" description="Dzień po dniu. Close rate liczony od odbytych rozmów.">
                <TrendChart points={data.trend} />
              </ChartCard>
              <ChartCard title="Wyniki rozmów" description={`Wszystkie umówione rozmowy (${t.booked}).`}>
                <BarList items={data.outcomes} total={t.booked} />
              </ChartCard>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Obiekcje" description={`Odsetek rozmów, w których padła obiekcja (${data.objections.asked} rozmów z odpowiedzią).`}>
                <BarList items={data.objections.bars} total={data.objections.asked} />
              </ChartCard>
              <ChartCard title="Powody dyskwalifikacji" description={`Odsetek niezakwalifikowanych leadów (${data.dqReasons.asked}).`}>
                <BarList items={data.dqReasons.bars} total={data.dqReasons.asked} unit="leadów" emptyText="Brak niezakwalifikowanych leadów w tym okresie." />
              </ChartCard>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <ChartCard className="lg:col-span-2" title="Materiały przed rozmową" description={`Czy lead zapoznał się z materiałami (${data.materials.asked} odbytych rozmów).`}>
                <BarList items={data.materials.bars} total={data.materials.asked} />
              </ChartCard>
              <Card className="justify-between">
                <CardHeader>
                  <CardDescription>Rozjazd oczekiwań z ofertą</CardDescription>
                  <CardTitle className="text-4xl font-semibold tracking-tight">{pct(t.mismatchRate)}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  {t.mismatchCount} z {t.mismatchAsked} leadów spodziewało się czegoś innego niż oferta. Szczegóły w zakładce „Rozjazd oczekiwań” poniżej.
                </CardContent>
              </Card>
            </section>

            {/* Qualitative */}
            <Card className="min-w-0 gap-0">
              <CardHeader className="border-b pb-5">
                <CardTitle className="text-lg tracking-tight">Słowami klientów i closerów</CardTitle>
                <CardDescription>Najnowsze na górze.</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <Tabs defaultValue="pains">
                  <div className="-mx-1 overflow-x-auto px-1 pb-1">
                    <TabsList>
                      <TabsTrigger value="pains">Bóle ({data.texts.pains.length})</TabsTrigger>
                      <TabsTrigger value="missing">Czego brakowało ({data.texts.missing.length})</TabsTrigger>
                      <TabsTrigger value="quotes">Cytaty obiekcji ({data.texts.quotes.length})</TabsTrigger>
                      <TabsTrigger value="expectations">Rozjazd oczekiwań ({data.texts.expectations.length})</TabsTrigger>
                      <TabsTrigger value="open">Otwarte deale ({data.texts.openDeals.length})</TabsTrigger>
                      <TabsTrigger value="notes">Wnioski closerów ({data.texts.notes.length})</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="pains"><Feed items={data.texts.pains} extraLabel="Sytuacja" /></TabsContent>
                  <TabsContent value="missing"><Feed items={data.texts.missing} extraLabel="Obiekcje" /></TabsContent>
                  <TabsContent value="quotes"><Feed items={data.texts.quotes} extraLabel="Obiekcje" quote /></TabsContent>
                  <TabsContent value="expectations"><Feed items={data.texts.expectations} /></TabsContent>
                  <TabsContent value="open"><Feed items={data.texts.openDeals} extraLabel="Obiekcje" /></TabsContent>
                  <TabsContent value="notes"><Feed items={data.texts.notes} /></TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
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

function ChartCard({
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

function Feed({ items, extraLabel, quote }: { items: TextItem[]; extraLabel?: string; quote?: boolean }) {
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
