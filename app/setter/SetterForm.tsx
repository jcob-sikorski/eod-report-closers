"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircleIcon, CircleCheckIcon, SendIcon } from "lucide-react";
import {
  isSetterFieldVisible,
  setterFields,
  setterSections,
  validateSetter,
  type SetterField,
  type SetterValues,
} from "@/lib/setter-questions";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { submitSetterReport } from "./actions";

const DRAFT_KEY = "setter-draft-v1";
const NAME_KEY = "setter-name";

function safeGet(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
}

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "");
const str = (v: SetterValues, k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
const num = (v: SetterValues, k: string) => {
  const x = Number(str(v, k));
  return str(v, k) !== "" && Number.isFinite(x) ? x : null;
};

// `!` = important: beats the toggle's own hover/on colours in both themes.
const onItem =
  "data-[state=on]:border-primary! data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground! data-[state=on]:hover:bg-primary/90!";

export default function SetterForm({ today }: { today: string }) {
  const [values, setValues] = useState<SetterValues>({ setter_name: "", report_date: today, no_book_reasons: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const name = safeGet(NAME_KEY) ?? "";
    let restored: SetterValues = {};
    try { restored = JSON.parse(safeGet(DRAFT_KEY) ?? "{}"); } catch { /* ignore */ }
    setValues((v) => ({
      ...v,
      ...restored,
      setter_name: str(restored, "setter_name") || name || str(v, "setter_name"),
      report_date: str(restored, "report_date") || str(v, "report_date"),
    }));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !done) safeSet(DRAFT_KEY, JSON.stringify(values));
  }, [values, loaded, done]);

  const set = (key: string, v: string | string[]) => {
    setValues((s) => ({ ...s, [key]: v }));
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };

  const progress = useMemo(() => {
    const req = setterFields.filter((f) => !f.optional && isSetterFieldVisible(f, values));
    const answered = req.filter((f) => filled(values[f.key])).length + [values.setter_name, values.report_date].filter(filled).length;
    const total = req.length + 2;
    return Math.round((answered / total) * 100);
  }, [values]);

  // Live rates under the numbers — the setter sees the day at a glance.
  const dials = num(values, "dials");
  const connected = num(values, "connected");
  const booked = num(values, "booked");
  const connectRate = dials && connected !== null ? Math.round((100 * connected) / dials) : null;
  const bookingRate = connected && booked !== null ? Math.round((100 * booked) / connected) : null;

  const focusFirstError = () =>
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>("[data-invalid=true]");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input, textarea, button")?.focus({ preventScroll: true });
    });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs = validateSetter(values);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setFormError(`Uzupełnij zaznaczone pola (${Object.keys(errs).length}).`);
      focusFirstError();
      return;
    }
    startTransition(async () => {
      const res = await submitSetterReport(values);
      if (res.ok) {
        safeSet(NAME_KEY, str(values, "setter_name").trim());
        safeSet(DRAFT_KEY, null);
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setFormError(res.error);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          focusFirstError();
        }
      }
    });
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
              Dzięki, {str(values, "setter_name").split(" ")[0]}! Raport za {str(values, "report_date")} trafił do bazy.
            </p>
          </div>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => {
              setValues({ setter_name: values.setter_name, report_date: today, no_book_reasons: [] });
              setErrors({});
              setFormError(null);
              setDone(false);
            }}
          >
            Wypełnij kolejny raport
          </Button>
        </CardContent>
      </Card>
    );
  }

  let qn = 0;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 -mx-4 border-b px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Progress value={progress} className="h-1.5" aria-label="Postęp wypełniania" />
          <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">{progress}%</span>
        </div>
      </div>

      <Card>
        <CardContent>
          <FieldGroup className="grid gap-5 sm:grid-cols-[1fr_12rem]">
            <Field data-invalid={!!errors.setter_name}>
              <FieldLabel htmlFor="setter_name">Imię i nazwisko settera</FieldLabel>
              <Input
                id="setter_name"
                autoComplete="name"
                placeholder="np. Anna Kowalska"
                value={str(values, "setter_name")}
                aria-invalid={!!errors.setter_name}
                onChange={(e) => set("setter_name", e.target.value)}
              />
              <FieldError>{errors.setter_name}</FieldError>
            </Field>
            <Field data-invalid={!!errors.report_date}>
              <FieldLabel htmlFor="report_date">Data raportu</FieldLabel>
              <Input
                id="report_date"
                type="date"
                max={today}
                value={str(values, "report_date")}
                aria-invalid={!!errors.report_date}
                onChange={(e) => set("report_date", e.target.value)}
              />
              <FieldError>{errors.report_date}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {setterSections.map((s, si) => {
        const visible = s.fields.filter((f) => isSetterFieldVisible(f, values));
        return (
          <Card key={s.title} className="gap-0">
            <CardHeader className="border-b pb-5">
              <CardDescription className="font-mono text-xs tracking-wider uppercase">
                {String(si + 1).padStart(2, "0")} · Raport settera
              </CardDescription>
              <CardTitle className="text-lg tracking-tight">{s.title}</CardTitle>
              {s.description && <CardDescription>{s.description}</CardDescription>}
            </CardHeader>
            <CardContent className="pt-6">
              <FieldGroup className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
                {visible.map((f) => {
                  qn += 1;
                  return (
                    <SetterFieldControl
                      key={f.key}
                      n={qn}
                      f={f}
                      value={values[f.key]}
                      error={errors[f.key]}
                      onChange={(v) => set(f.key, v)}
                    />
                  );
                })}
              </FieldGroup>
              {si === 0 && (connectRate !== null || bookingRate !== null) && (
                <p className="text-muted-foreground mt-6 rounded-md bg-muted/60 px-3 py-2 text-sm tabular-nums">
                  Connect rate: <strong className="text-foreground">{connectRate ?? "—"}%</strong>
                  <span aria-hidden> · </span>
                  Booking rate: <strong className="text-foreground">{bookingRate ?? "—"}%</strong>
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

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
        <p className="text-muted-foreground text-center text-xs">Po wysłaniu raport trafia do bazy i nie można go edytować.</p>
      </div>
    </form>
  );
}

function SetterFieldControl({
  n,
  f,
  value,
  error,
  onChange,
}: {
  n: number;
  f: SetterField;
  value: string | string[] | undefined;
  error?: string;
  onChange: (v: string | string[]) => void;
}) {
  const id = `s-${f.key}`;
  const labelId = `${id}-label`;
  const invalid = !!error;
  const v = typeof value === "string" ? value : "";
  const arr = Array.isArray(value) ? value : [];

  let control: React.ReactNode;
  switch (f.type) {
    case "number":
      control = (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="0"
          className="h-10 w-32! font-mono tabular-nums"
          value={v}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "rating":
      control = (
        <div className="w-full max-w-md space-y-1.5">
          <ToggleGroup type="single" variant="outline" value={v} onValueChange={(x) => x && onChange(x)} aria-labelledby={labelId} className="w-full">
            {["1", "2", "3", "4", "5"].map((x) => (
              <ToggleGroupItem key={x} value={x} aria-invalid={invalid} className={cn("h-10 flex-1 font-mono tabular-nums", onItem)}>
                {x}
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
    case "chips":
    case "multi": {
      const items = f.options!.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} aria-invalid={invalid} className={cn("h-9 px-3", onItem)}>
          {o.label}
        </ToggleGroupItem>
      ));
      control =
        f.type === "chips" ? (
          <ToggleGroup type="single" variant="outline" spacing={2} value={v} onValueChange={(x) => x && onChange(x)} aria-labelledby={labelId} className="flex-wrap">
            {items}
          </ToggleGroup>
        ) : (
          <ToggleGroup type="multiple" variant="outline" spacing={2} value={arr} onValueChange={(x) => onChange(x)} aria-labelledby={labelId} className="flex-wrap">
            {items}
          </ToggleGroup>
        );
      break;
    }
    default:
      control = (
        <Textarea
          id={id}
          value={v}
          aria-invalid={invalid}
          placeholder="Twoja odpowiedź…"
          className="max-h-96 min-h-24 resize-y leading-relaxed"
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  const hasInput = f.type === "number" || f.type === "textarea";

  return (
    <Field data-invalid={invalid} className={cn("animate-in fade-in-0 duration-200", !f.half && "sm:col-span-2")}>
      <FieldLabel id={labelId} htmlFor={hasInput ? id : undefined} className="items-start gap-2.5 text-[15px] leading-snug">
        <span className="bg-muted text-muted-foreground mt-px inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded-md px-1 font-mono text-[11px] tabular-nums">
          {n}
        </span>
        <span>
          {f.label}
          {f.optional && <span className="text-muted-foreground font-normal"> (opcjonalnie)</span>}
        </span>
      </FieldLabel>
      {f.hint && <FieldDescription className="pl-8.5">{f.hint}</FieldDescription>}
      {control}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
