import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SetterDashboard } from "@/lib/setter-dashboard";
import { BarList, TrendChart } from "./charts";
import { ChartCard, Feed, Stat, num, pct } from "./parts";

const fmt = new Intl.NumberFormat("pl-PL");

export default function SettersView({ data }: { data: SetterDashboard }) {
  const t = data.totals;

  if (data.reports === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">Brak raportów setterów w wybranym okresie.</CardContent>
      </Card>
    );
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Połączenia" value={fmt.format(t.dials)} sub={`${fmt.format(t.newLeads)} nowych leadów`} />
        <Stat label="Connect rate" value={pct(t.connectRate)} sub={`${fmt.format(t.connected)} rozmów`} />
        <Stat label="Umówione rozmowy" value={fmt.format(t.booked)} sub={`${fmt.format(t.callbacks)} callbacków`} />
        <Stat label="Booking rate" value={pct(t.bookingRate)} sub={`${fmt.format(t.booked)} z ${fmt.format(t.connected)} rozmów`} />
        <Stat label="Zakwalifikowani" value={pct(t.qualifiedRate)} sub={`${fmt.format(t.qualified)} z ${fmt.format(t.connected)} rozmów`} />
        <Stat label="Śr. jakość leadów" value={num(t.avgQuality)} sub="w skali 1–5" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Connect rate i booking rate"
          description="Dzień po dniu. Booking rate liczony od odbytych rozmów."
        >
          <TrendChart points={data.trend} variant="setter" />
        </ChartCard>
        <ChartCard
          title="Umówione z zakwalifikowanych"
          description={`Ilu zakwalifikowanych rozmówców dostało termin u closera.`}
        >
          <p className="text-4xl font-semibold tracking-tight">{pct(t.bookedOfQualified)}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {fmt.format(t.booked)} umówionych z {fmt.format(t.qualified)} zakwalifikowanych. Niski wynik przy dobrej jakości leadów to sygnał do pracy nad skryptem albo dostępnością terminów.
          </p>
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Dlaczego rozmowy nie kończą się umówieniem"
          description={`Odsetek raportów, w których setter wskazał dany powód (${data.reasons.asked}).`}
        >
          <BarList items={data.reasons.bars} total={data.reasons.asked} unit="raportów" />
        </ChartCard>
        <div className="grid gap-4">
          <ChartCard title="Czy leady pamiętały zapis?" description={`Ocena settera, ${data.remembered.asked} raportów.`}>
            <BarList items={data.remembered.bars} total={data.remembered.asked} unit="raportów" />
          </ChartCard>
          <ChartCard title="Czy obejrzały wideo przed telefonem?" description={`Ocena settera, ${data.watched.asked} raportów.`}>
            <BarList items={data.watched.bars} total={data.watched.asked} unit="raportów" />
          </ChartCard>
        </div>
      </section>

      {data.people.length > 1 && (
        <Card className="min-w-0 gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-5">
            <CardTitle className="text-base tracking-tight">Setterzy</CardTitle>
            <CardDescription>Wyniki w wybranym okresie, posortowane po liczbie umówionych rozmów.</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm tabular-nums">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr className="border-b">
                  {["Setter", "Raporty", "Połączenia", "Rozmowy", "Zakwal.", "Umówione", "Connect rate", "Booking rate", "Jakość"].map((h, i) => (
                    <th key={h} className={`h-10 px-3 font-medium whitespace-nowrap ${i === 0 ? "pl-6 text-left" : "text-right"} ${i === 8 ? "pr-6" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.people.map((p) => (
                  <tr key={p.name} className="hover:bg-muted/50 border-b transition-colors last:border-0">
                    <th scope="row" className="py-2.5 pr-3 pl-6 text-left font-medium">{p.name}</th>
                    <td className="px-3 text-right">{fmt.format(p.reports)}</td>
                    <td className="px-3 text-right">{fmt.format(p.dials)}</td>
                    <td className="px-3 text-right">{fmt.format(p.connected)}</td>
                    <td className="px-3 text-right">{fmt.format(p.qualified)}</td>
                    <td className="px-3 text-right font-medium">{fmt.format(p.booked)}</td>
                    <td className="px-3 text-right">{pct(p.connectRate)}</td>
                    <td className="px-3 text-right">{pct(p.bookingRate)}</td>
                    <td className="pr-6 pl-3 text-right">{num(p.avgQuality)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="min-w-0 gap-0">
        <CardHeader className="border-b pb-5">
          <CardTitle className="text-lg tracking-tight">Słowami leadów i setterów</CardTitle>
          <CardDescription>Najnowsze na górze.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <Tabs key="setters" defaultValue="voice">
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <TabsList>
                <TabsTrigger value="voice">Co mówią leady ({data.texts.voice.length})</TabsTrigger>
                <TabsTrigger value="marketing">Dla marketingu ({data.texts.marketing.length})</TabsTrigger>
                <TabsTrigger value="blockers">Blokery ({data.texts.blockers.length})</TabsTrigger>
                <TabsTrigger value="improvement">Co zrobię inaczej ({data.texts.improvement.length})</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="voice"><Feed items={data.texts.voice} /></TabsContent>
            <TabsContent value="marketing"><Feed items={data.texts.marketing} /></TabsContent>
            <TabsContent value="blockers"><Feed items={data.texts.blockers} /></TabsContent>
            <TabsContent value="improvement"><Feed items={data.texts.improvement} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
