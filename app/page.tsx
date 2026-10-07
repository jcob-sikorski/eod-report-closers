import Link from "next/link";
import { ArrowRightIcon, HandshakeIcon, PhoneCallIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLES = [
  {
    href: "/closer",
    icon: HandshakeIcon,
    title: "Closer",
    description: "Karta dla każdej rozmowy sprzedażowej i 3 wnioski z dnia.",
  },
  {
    href: "/setter",
    icon: PhoneCallIcon,
    title: "Setter",
    description: "Liczby z dnia, jakość leadów i to, co od nich słyszysz.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,var(--color-muted),transparent_70%)]"
      />
      <div className="mx-auto w-full max-w-2xl px-4 pt-12 pb-24 sm:pt-16">
        <header className="mb-8 space-y-3">
          <Badge variant="outline" className="rounded-full px-3 py-1 font-mono text-[11px] tracking-wider uppercase">
            Raport EOD · Closerzy / Setterzy
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kim dziś jesteś?</h1>
          <p className="text-muted-foreground text-pretty">Wybierz swoją rolę, żeby wypełnić raport na koniec dnia.</p>
        </header>

        <nav className="grid gap-3 sm:grid-cols-2" aria-label="Wybierz rolę">
          {ROLES.map((r) => (
            <Link key={r.href} href={r.href} className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Card className="h-full gap-4 transition-colors group-hover:border-foreground/20 group-hover:bg-accent/40">
                <CardHeader className="gap-3">
                  <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
                    <r.icon className="size-5" />
                  </div>
                  <CardTitle className="flex items-center justify-between text-lg tracking-tight">
                    {r.title}
                    <ArrowRightIcon className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                  <CardDescription>{r.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </nav>

        <p className="text-muted-foreground mt-10 text-center text-xs">
          <Link href="/dashboard" className="hover:text-foreground underline-offset-4 hover:underline">Dashboard</Link>
        </p>
      </div>
    </main>
  );
}
