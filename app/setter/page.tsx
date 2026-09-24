import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SetterForm from "./SetterForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Raport EOD — Setterzy" };

export default function SetterPage() {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
  return (
    <main className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,var(--color-muted),transparent_70%)]"
      />
      <div className="mx-auto w-full max-w-2xl px-4 pt-12 pb-24 sm:pt-16">
        <Link href="/" className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm">
          <ArrowLeftIcon className="size-4" /> Zmień rolę
        </Link>
        <header className="mb-8 space-y-3">
          <Badge variant="outline" className="rounded-full px-3 py-1 font-mono text-[11px] tracking-wider uppercase">
            Raport EOD · Setterzy
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Jak minął Twój dzień na telefonie?</h1>
          <p className="text-muted-foreground text-pretty">
            Liczby z dnia, jakość leadów i to, co od nich słyszysz. Dzięki temu możemy dowozić lepsze leady — zajmie Ci to ok. 3 minuty.
          </p>
        </header>
        <SetterForm today={today} />
      </div>
    </main>
  );
}
