"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircleIcon, ChevronDownIcon, CircleCheckIcon, PlusIcon, SendIcon, Trash2Icon } from "lucide-react";
import {
  OUTCOMES,
  callFields,
  dailyFields,
  isCallFieldRequired,
  isCallFieldVisible,
  labelOf,
  MAX_CALLS,
  newCall,
  validate,
  type CallField,
  type CallValues,
  type ReportValues,
} from "@/lib/questions";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { submitReport } from "./actions";

const DRAFT_KEY = "eod-draft-v2";
const NAME_KEY = "eod-closer-name";

function safeGet(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
}

const emptyReport = (today: string, name = ""): ReportValues => ({
  closer_name: name,
  report_date: today,
  marketing_insight: "",
  self_improvement: "",
  priority_change: "",
  // Fixed id: this card is rendered on the server too, so it must match on hydration.
  calls: [newCall("call-initial")],
});

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "");

// Outcome → badge tone
const OUTCOME_TONE: Record<string, string> = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  won_unpaid: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  open: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  lost: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  disqualified: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  no_show: "border-zinc-500/30 bg-zinc-500/10 text-zinc-500",
};

export default function ReportForm({ today }: { today: string }) {
  const [values, setValues] = useState<ReportValues>(() => emptyReport(today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Restore draft + remembered name after mount.
  useEffect(() => {
    const name = safeGet(NAME_KEY) ?? "";
    let restored: Partial<ReportValues> = {};
    try { restored = JSON.parse(safeGet(DRAFT_KEY) ?? "{}"); } catch { /* ignore */ }
    setValues((v) => ({
      ...v,
      ...restored,
      closer_name: restored.closer_name || name || v.closer_name,
      report_date: restored.report_date || v.report_date,
      calls: Array.isArray(restored.calls) && restored.calls.length ? restored.calls : v.calls,
    }));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !done) safeSet(DRAFT_KEY, JSON.stringify(values));
  }, [values, loaded, done]);

  const clearError = (key: string) =>
    setErrors((e) => {
      if (!e[key] && !(key.startsWith("calls.") && e.calls)) return e;
      const { [key]: _, ...rest } = e;
      if (key.startsWith("calls.")) delete rest.calls;
      return rest;
    });

  const setTop = (key: keyof Omit<ReportValues, "calls">, v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
    clearError(key);
  };

  const setCall = (i: number, key: string, v: string | string[]) => {
    setValues((s) => ({ ...s, calls: s.calls.map((c, j) => (j === i ? { ...c, [key]: v } : c)) }));
    clearError(`calls.${i}.${key}`);
  };

  const addCall = () => {
    const c = newCall();
    setValues((s) => ({ ...s, calls: [...s.calls, c] }));
    // Collapse the earlier calls so the new one is in focus.
    setCollapsed(new Set(values.calls.map((x) => x.id)));
    setErrors((e) => { const { calls: _, ...rest } = e; return rest; });
    requestAnimationFrame(() =>
      formRef.current?.querySelector(`[data-call="${c.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const removeCall = (i: number) => {
    setValues((s) => ({ ...s, calls: s.calls.filter((_, j) => j !== i) }));
    // Indices shift — drop per-call errors; they'll be recomputed on submit.
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("calls."))));
  };

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const progress = useMemo(() => {
    let total = 2 + dailyFields.length;
    let answered = [values.closer_name, values.report_date].filter(filled).length
      + dailyFields.filter((f) => filled(values[f.key])).length;
    for (const c of values.calls) {
      for (const f of callFields) {
        if (!isCallFieldRequired(f, c)) continue;
        total++;
        if (filled(c[f.key])) answered++;
      }
    }
    return { answered, total, pct: Math.round((answered / total) * 100) };
  }, [values]);

  const tally = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of values.calls) if (typeof c.outcome === "string" && c.outcome) t[c.outcome] = (t[c.outcome] ?? 0) + 1;
    return t;
  }, [values.calls]);

  const focusFirstError = (errs: Record<string, string>) => {
    // Expand any call that has an error.
    const bad = new Set(
      Object.keys(errs).filter((k) => k.startsWith("calls.")).map((k) => values.calls[Number(k.split(".")[1])]?.id),
    );
    setCollapsed((s) => new Set([...s].filter((id) => !bad.has(id))));
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>("[data-invalid=true]");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input, textarea, button")?.focus({ preventScroll: true });
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validate(values);
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      setFormError(clientErrors.calls ?? `Uzupełnij zaznaczone pola (${Object.keys(clientErrors).length}).`);
      focusFirstError(clientErrors);
      return;
    }
    startTransition(async () => {
      const res = await submitReport(values);
      if (res.ok) {
        safeSet(NAME_KEY, values.closer_name.trim());
        safeSet(DRAFT_KEY, null);
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setFormError(res.error);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          focusFirstError(res.fieldErrors);
        }
      }
    });
  };

  const reset = () => {
    setValues(emptyReport(today, values.closer_name));
    setErrors({});
    setCollapsed(new Set());
    setFormError(null);
    setDone(false);
  };

  if (done) {
    return (
      <Card className="animate-in fade-in-0 zoom-in-95 items-center py-12 text-center duration-300">
        <CardContent className="flex flex-col items-center gap-4">
          <div className="bg-muted flex size-14 items-center justify-center rounded-full">
            <CircleCheckIcon className="size-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">Raport zapisany</h2>
            <p className="text-muted-foreground text-sm">
              Dzięki, {values.closer_name.split(" ")[0]}! {values.calls.length}{" "}
              {values.calls.length === 1 ? "rozmowa" : values.calls.length < 5 ? "rozmowy" : "rozmów"} z{" "}
              {values.report_date} trafiło do bazy.
            </p>
          </div>
          <Button variant="outline" onClick={reset} className="mt-2">Wypełnij kolejny raport</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 -mx-4 border-b px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Progress value={progress.pct} className="h-1.5" aria-label="Postęp wypełniania" />
          <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">{progress.pct}%</span>
        </div>
      </div>

      {/* Closer + date */}
      <Card>
        <CardContent>
          <FieldGroup className="grid gap-5 sm:grid-cols-[1fr_12rem]">
            <Field data-invalid={!!errors.closer_name}>
              <FieldLabel htmlFor="closer_name">Imię i nazwisko closera</FieldLabel>
              <Input
                id="closer_name"
                autoComplete="name"
                placeholder="np. Anna Kowalska"
                value={values.closer_name}
                aria-invalid={!!errors.closer_name}
                onChange={(e) => setTop("closer_name", e.target.value)}
              />
              <FieldError>{errors.closer_name}</FieldError>
            </Field>
            <Field data-invalid={!!errors.report_date}>
              <FieldLabel htmlFor="report_date">Data raportu</FieldLabel>
              <Input
                id="report_date"
                type="date"
                max={today}
                value={values.report_date}
                aria-invalid={!!errors.report_date}
                onChange={(e) => setTop("report_date", e.target.value)}
              />
              <FieldError>{errors.report_date}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Calls */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Rozmowy</h2>
            <p className="text-muted-foreground text-sm">
              Jedna karta na każdą umówioną rozmowę — także na tych, którzy się nie pojawili.
            </p>
          </div>
          {Object.keys(tally).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {OUTCOMES.filter((o) => tally[o.value]).map((o) => (
                <Badge key={o.value} variant="outline" className={cn("font-normal", OUTCOME_TONE[o.value])}>
                  {o.label} · {tally[o.value]}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {values.calls.map((c, i) => (
          <CallCard
            key={c.id}
            index={i}
            call={c}
            errors={errors}
            collapsed={collapsed.has(c.id)}
            canRemove={values.calls.length > 1}
            onToggle={() => toggle(c.id)}
            onRemove={() => removeCall(i)}
            onChange={(k, v) => setCall(i, k, v)}
          />
        ))}

        {errors.calls && <p className="text-destructive px-1 text-sm">{errors.calls}</p>}

        <Button
          type="button"
          variant="outline"
          className="h-12 w-full border-dashed"
          onClick={addCall}
          disabled={values.calls.length >= MAX_CALLS}
        >
          <PlusIcon /> Dodaj rozmowę
        </Button>
      </section>

      {/* Daily wrap-up */}
      <Card className="gap-0">
        <CardHeader className="border-b pb-5">
          <CardDescription className="font-mono text-xs tracking-wider uppercase">Podsumowanie dnia</CardDescription>
          <CardTitle className="text-lg tracking-tight">3 wnioski z dzisiejszych rozmów</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <FieldGroup className="gap-8">
            {dailyFields.map((f, i) => (
              <Field key={f.key} data-invalid={!!errors[f.key]}>
                <FieldLabel htmlFor={f.key} className="items-start gap-2.5 text-[15px] leading-snug">
                  <NumberChip n={i + 1} />
                  <span>{f.label}</span>
                </FieldLabel>
                {f.hint && <FieldDescription className="pl-8.5">{f.hint}</FieldDescription>}
                <Textarea
                  id={f.key}
                  value={values[f.key]}
                  aria-invalid={!!errors[f.key]}
                  placeholder="Twoja odpowiedź…"
                  className="max-h-96 min-h-24 resize-y leading-relaxed"
                  onChange={(e) => setTop(f.key, e.target.value)}
                />
                <FieldError>{errors[f.key]}</FieldError>
              </Field>
            ))}
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="space-y-4 pt-2">
        {formError && (
          <Alert variant="destructive" className="animate-in fade-in-0">
            <AlertCircleIcon />
            <AlertTitle>Nie wysłano raportu</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>
          {pending ? <Spinner /> : <SendIcon />}
          {pending ? "Zapisywanie…" : "Wyślij raport"}
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          Po wysłaniu raport trafia do bazy i nie można go edytować.
        </p>
      </div>
    </form>
  );
}

function NumberChip({ n }: { n: number | string }) {
  return (
    <span className="bg-muted text-muted-foreground mt-px inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded-md px-1 font-mono text-[11px] tabular-nums">
      {n}
    </span>
  );
}

function CallCard({
  index,
  call,
  errors,
  collapsed,
  canRemove,
  onToggle,
  onRemove,
  onChange,
}: {
  index: number;
  call: CallValues;
  errors: Record<string, string>;
  collapsed: boolean;
  canRemove: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (key: string, v: string | string[]) => void;
}) {
  const outcome = typeof call.outcome === "string" ? call.outcome : "";
  const prospect = typeof call.prospect === "string" ? call.prospect.trim() : "";
  const situation = typeof call.lead_situation === "string" ? call.lead_situation.trim() : "";
  const errCount = Object.keys(errors).filter((k) => k.startsWith(`calls.${index}.`)).length;
  const bodyId = `call-body-${call.id}`;

  return (
    <Card data-call={call.id} className={cn("scroll-mt-20 gap-0 py-0 transition-shadow", errCount > 0 && "border-destructive/50")}>
      <div className="flex items-center gap-3 px-6 py-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
        >
          <span className="bg-primary text-primary-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs tabular-nums">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{prospect || "Nowa rozmowa"}</span>
            {situation && <span className="text-muted-foreground block truncate text-xs">{situation}</span>}
          </span>
          {errCount > 0 && collapsed && (
            <Badge variant="destructive" className="shrink-0">{errCount} do uzupełnienia</Badge>
          )}
          {outcome && (
            <Badge variant="outline" className={cn("hidden shrink-0 font-normal sm:inline-flex", OUTCOME_TONE[outcome])}>
              {labelOf(OUTCOMES, outcome)}
            </Badge>
          )}
          <ChevronDownIcon className={cn("text-muted-foreground size-4 shrink-0 transition-transform", !collapsed && "rotate-180")} />
        </button>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive shrink-0"
            onClick={onRemove}
            aria-label={`Usuń rozmowę ${index + 1}`}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>

      {!collapsed && (
        <CardContent id={bodyId} className="animate-in fade-in-0 border-t pt-6 pb-6 duration-200">
          <FieldGroup className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
            {callFields.filter((f) => isCallFieldVisible(f, call)).map((f) => (
              <CallFieldControl
                key={f.key}
                f={f}
                callId={call.id}
                value={call[f.key]}
                required={isCallFieldRequired(f, call)}
                error={errors[`calls.${index}.${f.key}`]}
                onChange={(v) => onChange(f.key, v)}
              />
            ))}
          </FieldGroup>
        </CardContent>
      )}
    </Card>
  );
}

// `!` = important: beats the toggle's own hover/on colours in both themes.
const onItem =
  "data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground! data-[state=on]:hover:bg-primary/90!";

function CallFieldControl({
  f,
  callId,
  value,
  required,
  error,
  onChange,
}: {
  f: CallField;
  callId: string;
  value: string | string[] | undefined;
  required: boolean;
  error?: string;
  onChange: (v: string | string[]) => void;
}) {
  const id = `${callId}-${f.key}`;
  const labelId = `${id}-label`;
  const invalid = !!error;
  const str = typeof value === "string" ? value : "";
  const arr = Array.isArray(value) ? value : [];

  let control: React.ReactNode;
  switch (f.type) {
    case "text":
      control = (
        <Input id={id} value={str} placeholder={f.placeholder} aria-invalid={invalid} onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "textarea":
      control = (
        <Textarea
          id={id}
          value={str}
          aria-invalid={invalid}
          placeholder={f.placeholder ?? "Twoja odpowiedź…"}
          className="max-h-80 min-h-20 resize-y leading-relaxed"
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "select":
      control = (
        <Select value={str || undefined} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
            <SelectValue placeholder="Wybierz…" />
          </SelectTrigger>
          <SelectContent>
            {f.options!.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case "chips":
      control = (
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          value={str}
          onValueChange={(v) => v && onChange(v)}
          aria-labelledby={labelId}
          className="flex-wrap"
        >
          {f.options!.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} aria-invalid={invalid} className={cn("h-9 px-3", onItem)}>
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
      break;
    case "multi":
      control = (
        <ToggleGroup
          type="multiple"
          variant="outline"
          spacing={2}
          value={arr}
          onValueChange={(next) => {
            // An exclusive option (e.g. "Brak obiekcji") can't be combined with others.
            const added = next.find((x) => !arr.includes(x));
            const isExcl = (x: string) => !!f.options!.find((o) => o.value === x)?.exclusive;
            onChange(added && isExcl(added) ? [added] : next.filter((x) => !isExcl(x) || next.length === 1));
          }}
          aria-labelledby={labelId}
          className="flex-wrap"
        >
          {f.options!.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} aria-invalid={invalid} className={cn("h-9 px-3", onItem)}>
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
      break;
    case "rating":
      control = (
        <div className="space-y-1.5">
          <ToggleGroup type="single" variant="outline" value={str} onValueChange={(v) => v && onChange(v)} aria-labelledby={labelId} className="w-full">
            {["1", "2", "3", "4", "5"].map((n) => (
              <ToggleGroupItem key={n} value={n} aria-invalid={invalid} className={cn("h-10 flex-1 font-mono tabular-nums", onItem)}>
                {n}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>Najniżej</span>
            <span>Najwyżej</span>
          </div>
        </div>
      );
      break;
    case "segmented":
      control = (
        <ToggleGroup type="single" variant="outline" value={str} onValueChange={(v) => v && onChange(v)} aria-labelledby={labelId} className="w-full max-w-md">
          {f.options!.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} aria-invalid={invalid} className={cn("h-10 flex-1 px-3", onItem)}>
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
      break;
  }

  const hasInput = f.type === "text" || f.type === "textarea" || f.type === "select";

  return (
    <Field data-invalid={invalid} className={cn("animate-in fade-in-0 duration-200", !f.half && "sm:col-span-2")}>
      <FieldLabel id={labelId} htmlFor={hasInput ? id : undefined} className="leading-snug">
        <span>
          {f.label}
          {!required && <span className="text-muted-foreground font-normal"> (opcjonalnie)</span>}
        </span>
      </FieldLabel>
      {f.hint && <FieldDescription>{f.hint}</FieldDescription>}
      {control}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
