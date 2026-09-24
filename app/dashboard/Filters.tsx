"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ALL = "__all__";
const ON = "data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!";

type View = "closers" | "setters";

export default function Filters({
  ranges,
  range,
  view,
  people,
  person,
}: {
  ranges: readonly { value: string; label: string }[];
  range: string;
  view: View;
  people: string[];
  person: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (next: { range?: string; view?: View; person?: string | null }) => {
    const p = new URLSearchParams();
    const v = next.view ?? view;
    const r = next.range ?? range;
    // Switching view clears the person filter — closer and setter names differ.
    const who = next.view && next.view !== view ? null : next.person === undefined ? person : next.person;
    if (v === "setters") p.set("view", "setters");
    if (r !== "30") p.set("range", r);
    if (who) p.set("person", who);
    start(() => router.push(`/dashboard${p.size ? `?${p}` : ""}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && go({ view: v as View })} aria-label="Rola">
        <ToggleGroupItem value="closers" className={`h-9 px-3 ${ON}`}>Closerzy</ToggleGroupItem>
        <ToggleGroupItem value="setters" className={`h-9 px-3 ${ON}`}>Setterzy</ToggleGroupItem>
      </ToggleGroup>

      <ToggleGroup type="single" variant="outline" value={range} onValueChange={(v) => v && go({ range: v })} aria-label="Zakres dat">
        {ranges.map((r) => (
          <ToggleGroupItem key={r.value} value={r.value} className={`h-9 px-3 ${ON}`}>
            {r.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Select value={person ?? ALL} onValueChange={(v) => go({ person: v === ALL ? null : v })}>
        <SelectTrigger className="h-9 w-48" aria-label={view === "setters" ? "Setter" : "Closer"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{view === "setters" ? "Wszyscy setterzy" : "Wszyscy closerzy"}</SelectItem>
          {people.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pending && <Spinner className="text-muted-foreground" />}
    </div>
  );
}
