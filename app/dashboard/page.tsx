import type { Metadata } from "next";
import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAuthed } from "@/lib/dashboard-auth";
import { RANGES, loadDashboard, type RangeValue } from "@/lib/dashboard";
import { loadSetterDashboard } from "@/lib/setter-dashboard";
import { logout } from "./actions";
import { BarList, TrendChart } from "./charts";
import Filters from "./Filters";
import LoginForm from "./LoginForm";
import { ChartCard, Feed, Stat, num, pct, plDate } from "./parts";
import SettersView from "./SettersView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard EOD" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; view?: string; person?: string; closer?: string }>;
}) {
  if (!(await isAuthed())) {
    const q = new URLSearchParams(
      Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"),
    ).toString();
    return (
      <main className="flex min-h-dvh items-center px-4 py-16">
        <LoginForm configured={!!process.env.DASHBOARD_PASSWORD} next={q ? `?${q}` : ""} />
      </main>
    );
  }

  const sp = await searchParams;
  const range: RangeValue = (RANGES.find((r) => r.value === sp.range)?.value ?? "30") as RangeValue;
  const view: "closers" | "setters" = sp.view === "setters" ? "setters" : "closers";
  // `closer` is the pre-setters URL param — still honoured for old links.
  const person = (sp.person ?? (view === "closers" ? sp.closer : undefined))?.trim() || null;
  const closer = person;

  let data;
  let setterData;
  try {
    if (view === "setters") setterData = await loadSetterDashboard(range, person);
    else data = await loadDashboard(range, closer);
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

  const meta = (setterData ?? data)!;
  const rangeText = meta.from ? `${plDate(meta.from)} – ${plDate(meta.to)}` : `do ${plDate(meta.to)}`;
  const people = setterData ? setterData.setters : data!.closers;
  const reportCount = meta.reports;

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
              Dashboard EOD · Closerzy / Setterzy
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {view === "setters" ? "Co mówią setterzy" : "Co mówią closerzy"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {rangeText} · {reportCount} {reportCount === 1 ? "raport" : "raportów"}
              {person ? ` · ${person}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Formularze</Link>
            </Button>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                <LogOutIcon /> Wyloguj
              </Button>
            </form>
          </div>
        </header>

        <Filters ranges={RANGES} range={range} view={view} people={people} person={person} />

        {setterData ? (
          <SettersView data={setterData} />
        ) : (
          <ClosersView data={data!} />
        )}
      </div>
    </main>
  );
}

function ClosersView({ data }: { data: Awaited<ReturnType<typeof loadDashboard>> }) {
  const t = data.totals;
  return (
    <>
        {t.booked === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Brak raportów w wybranym okresie.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <Stat label="Umówione rozmowy" value={String(t.booked)} sub={`${t.noShow} no-show · ${t.paid} zapłacone`} />
              <Stat label="Show rate" value={pct(t.showRate)} sub={`${t.held} z ${t.booked} odbytych`} />
              <Stat label="Niezakwalifikowani" value={pct(t.dqRate)} sub={`${t.disqualified} z ${t.held} odbytych`} />
              <Stat label="Śr. dopasowanie" value={num(t.avgFit)} sub="w skali 1–5" />
              <Stat label="Śr. intencja zakupu" value={num(t.avgIntent)} sub="w skali 1–5" />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <ChartCard className="lg:col-span-2" title="Show rate" description="Dzień po dniu.">
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
                <Tabs key="closers" defaultValue="pains">
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
    </>
  );
}
