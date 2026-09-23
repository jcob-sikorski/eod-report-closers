"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ALL = "__all__";

export default function Filters({
  ranges,
  range,
  closers,
  closer,
}: {
  ranges: readonly { value: string; label: string }[];
  range: string;
  closers: string[];
  closer: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (next: { range?: string; closer?: string | null }) => {
    const p = new URLSearchParams();
    const r = next.range ?? range;
    const c = next.closer === undefined ? closer : next.closer;
    if (r !== "30") p.set("range", r);
    if (c) p.set("closer", c);
    start(() => router.push(`/dashboard${p.size ? `?${p}` : ""}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        value={range}
        onValueChange={(v) => v && go({ range: v })}
        aria-label="Zakres dat"
      >
        {ranges.map((r) => (
          <ToggleGroupItem
            key={r.value}
            value={r.value}
            className="h-9 px-3 data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
          >
            {r.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Select value={closer ?? ALL} onValueChange={(v) => go({ closer: v === ALL ? null : v })}>
        <SelectTrigger className="h-9 w-48" aria-label="Closer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Wszyscy closerzy</SelectItem>
          {closers.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pending && <Spinner className="text-muted-foreground" />}
    </div>
  );
}
