// Single source of truth for the EOD form: option lists, per-call fields,
// daily wrap-up questions, conditional visibility and validation.
//
// Option lists (objections, disqualification reasons, …) are stored as codes in the DB
// with no CHECK constraint, so you can add or rename options here freely.
// Only `outcome` codes are fixed in SQL, because stats views depend on them.

export type Option = { value: string; label: string; exclusive?: boolean }; // exclusive: can't be combined with other picks

// ─── Option lists ────────────────────────────────────────────────────────────

export const OUTCOMES: Option[] = [
  { value: "paid", label: "Kupił i zapłacił" },
  { value: "open", label: "Decyzja otwarta" },
  { value: "lost", label: "Nie kupił" },
  { value: "disqualified", label: "Niezakwalifikowany" },
  { value: "no_show", label: "Nie pojawił się" },
];

export const DISQUALIFICATION_REASONS: Option[] = [
  { value: "budget", label: "Brak możliwości finansowych" },
  { value: "too_early", label: "Za wczesny etap zakupowy" },
  { value: "wrong_profile", label: "Nie ta grupa docelowa" },
  { value: "no_authority", label: "Nie decyduje sam(a)" },
  { value: "no_problem", label: "Brak realnego problemu" },
  { value: "other", label: "Inne" },
];

export const OBJECTIONS: Option[] = [
  { value: "price", label: "Cena / za drogo" },
  { value: "timing", label: "Zły moment / brak czasu" },
  { value: "trust", label: "Wątpliwości co do efektów" },
  { value: "partner", label: "Musi skonsultować z kimś" },
  { value: "think", label: "„Muszę to przemyśleć”" },
  { value: "alternative", label: "Rozważa inną opcję" },
  { value: "diy", label: "Chce spróbować sam(a)" },
  { value: "none", label: "Brak obiekcji", exclusive: true },
  { value: "other", label: "Inna" },
];

export const MATERIALS: Option[] = [
  { value: "yes", label: "Tak" },
  { value: "partly", label: "Częściowo" },
  { value: "no", label: "Nie" },
  { value: "not_sent", label: "Nie wysłano" },
];

export const YES_NO: Option[] = [
  { value: "true", label: "Tak" },
  { value: "false", label: "Nie" },
];

export const labelOf = (opts: Option[], v: string | undefined) => opts.find((o) => o.value === v)?.label;

// ─── Types ───────────────────────────────────────────────────────────────────

export type CallValues = Record<string, string | string[]> & { id: string };

export type ReportValues = {
  closer_name: string;
  report_date: string;
  marketing_insight: string;
  self_improvement: string;
  priority_change: string;
  calls: CallValues[];
};

export type FieldType = "text" | "textarea" | "select" | "chips" | "multi" | "rating" | "segmented";

export type CallField = {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  placeholder?: string;
  options?: Option[];
  half?: boolean; // half width on desktop
  showIf?: (c: CallValues) => boolean;
  required?: (c: CallValues) => boolean; // default: required when visible
};

const s = (c: CallValues, k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
const held = (c: CallValues) => !!s(c, "outcome") && s(c, "outcome") !== "no_show";
const objectionApplies = (c: CallValues) => held(c) && s(c, "outcome") !== "disqualified";

// ─── Per-call fields ─────────────────────────────────────────────────────────

const outcomeIn = (c: CallValues, ...o: string[]) => o.includes(s(c, "outcome"));
const hasRealObjection = (c: CallValues) => {
  const v = c.objections;
  return Array.isArray(v) && v.some((x) => x !== "none");
};

export const callFields: CallField[] = [
  { key: "prospect", type: "text", label: "Klient", placeholder: "Imię i nazwisko lub ID w CRM" },
  { key: "outcome", type: "chips", options: OUTCOMES, label: "Wynik rozmowy" },

  {
    key: "no_show_note",
    type: "textarea",
    label: "Czy klient wyjaśnił nieobecność? Co napisał?",
    showIf: (c) => s(c, "outcome") === "no_show",
    required: () => false,
  },

  { key: "fit_score", type: "rating", half: true, label: "Dopasowanie do kryteriów (1–5)", showIf: held },
  { key: "intent_score", type: "rating", half: true, label: "Intencja zakupu (1–5)", showIf: held },

  {
    key: "disqualification_reasons",
    type: "multi",
    options: DISQUALIFICATION_REASONS,
    label: "Dlaczego niezakwalifikowany?",
    hint: "Możesz zaznaczyć kilka.",
    showIf: (c) => s(c, "outcome") === "disqualified",
  },

  {
    key: "lead_situation",
    type: "textarea",
    label: "Krótko opisz sytuację leada",
    hint: "Kim jest, czym się zajmuje, na jakim jest etapie, co już próbował.",
    showIf: held,
  },
  {
    key: "main_pains",
    type: "textarea",
    label: "Główne bóle leada",
    hint: "Co go boli i jaki rezultat chce osiągnąć — najlepiej jego słowami. To trafia prosto do copy reklam.",
    showIf: held,
  },

  {
    key: "objections",
    type: "multi",
    options: OBJECTIONS,
    label: "Obiekcje",
    hint: "Możesz zaznaczyć kilka.",
    showIf: objectionApplies,
    required: (c) => outcomeIn(c, "open", "lost"),
  },
  {
    key: "objection_quote",
    type: "textarea",
    label: "Co dokładnie powiedział klient przy obiekcji?",
    hint: "Cytat, nie Twoja interpretacja.",
    showIf: (c) => objectionApplies(c) && hasRealObjection(c),
  },

  {
    key: "why_now",
    type: "textarea",
    label: "Dlaczego umówił rozmowę właśnie teraz?",
    hint: "Konkretne wydarzenie, termin lub koszt dalszego odkładania.",
    showIf: held,
  },
  {
    key: "missing_before_call",
    type: "textarea",
    label: "Czego brakowało leadowi przed spotkaniem, żeby kupił od razu?",
    hint: "Informacja, dowód, zaufanie, budżet, zgoda partnera…",
    showIf: (c) => held(c) && s(c, "outcome") !== "paid",
    required: (c) => outcomeIn(c, "open", "lost"),
  },

  {
    key: "materials_watched",
    type: "chips",
    options: MATERIALS,
    label: "Czy zapoznał się z materiałami przed rozmową?",
    showIf: held,
  },
  {
    key: "expectation_mismatch",
    type: "segmented",
    options: YES_NO,
    label: "Czy jego oczekiwania wobec oferty różniły się od rzeczywistości?",
    showIf: held,
  },
  {
    key: "expectation_mismatch_details",
    type: "textarea",
    label: "Czego się spodziewał i czym to się różniło od oferty?",
    showIf: (c) => held(c) && s(c, "expectation_mismatch") === "true",
  },

  {
    key: "next_step",
    type: "textarea",
    label: "Jaki jest następny krok?",
    hint: "Co konkretnie, kto to robi i do kiedy.",
    showIf: held,
    required: (c) => outcomeIn(c, "open"),
  },
];

export const isCallFieldVisible = (f: CallField, c: CallValues) => !f.showIf || f.showIf(c);
export const isCallFieldRequired = (f: CallField, c: CallValues) =>
  isCallFieldVisible(f, c) && (f.required ? f.required(c) : true);

// ─── Daily wrap-up ───────────────────────────────────────────────────────────

export const dailyFields: { key: "marketing_insight" | "self_improvement" | "priority_change"; label: string; hint?: string }[] = [
  {
    key: "marketing_insight",
    label: "Jedna rzecz z dzisiejszych rozmów, którą powinien wiedzieć marketing",
    hint: "Np. powtarzające się oczekiwanie, fraza klientów, problem z konkretną reklamą.",
  },
  {
    key: "self_improvement",
    label: "Co zrobisz inaczej na kolejnych rozmowach?",
    hint: "Konkretne działanie, które dziś pominąłeś i które poprawiłoby wynik.",
  },
  {
    key: "priority_change",
    label: "Jaką jedną zmianę należy wdrożyć priorytetowo?",
    hint: "Co, kto ma to wdrożyć, które rozmowy to uzasadniają i jaki wynik ma to poprawić.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pass a fixed `id` for anything rendered on the server (random IDs would cause a hydration mismatch). */
export const newCall = (id?: string): CallValues => ({
  id: id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2)),
  prospect: "",
  outcome: "",
  disqualification_reasons: [],
  objections: [],
});

const isEmpty = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v.length === 0 : !(v ?? "").toString().trim();

export const MAX_CALLS = 30;

/** Returns { "field" | "calls.<i>.<field>": message }. Empty object = valid. */
export function validate(r: ReportValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!r.closer_name?.trim()) e.closer_name = "Podaj imię i nazwisko.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.report_date ?? "")) e.report_date = "Podaj datę.";

  if (!Array.isArray(r.calls) || r.calls.length === 0) e.calls = "Dodaj co najmniej jedną rozmowę.";
  else if (r.calls.length > MAX_CALLS) e.calls = `Maksymalnie ${MAX_CALLS} rozmów.`;

  (r.calls ?? []).forEach((c, i) => {
    for (const f of callFields) {
      const k = `calls.${i}.${f.key}`;
      if (!isCallFieldVisible(f, c)) continue;
      const v = c[f.key];
      if (isEmpty(v)) {
        if (isCallFieldRequired(f, c)) e[k] = f.type === "multi" ? "Zaznacz co najmniej jedną opcję." : "Wymagane.";
        continue;
      }
      if (f.type === "rating") {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 5) e[k] = "Wybierz 1–5.";
      } else if (f.options && f.type === "multi") {
        if (!Array.isArray(v) || !v.every((x) => f.options!.some((o) => o.value === x))) e[k] = "Nieprawidłowa opcja.";
        else if (v.length > 1 && v.some((x) => f.options!.find((o) => o.value === x)?.exclusive))
          e[k] = "Tej opcji nie można łączyć z innymi.";
      } else if (f.options) {
        if (!f.options.some((o) => o.value === v)) e[k] = "Nieprawidłowa opcja.";
      } else if (String(v).length > 10000) {
        e[k] = "Maksymalnie 10 000 znaków.";
      }
    }
  });

  for (const f of dailyFields) {
    const v = r[f.key];
    if (!v?.trim()) e[f.key] = "To pole jest wymagane.";
    else if (v.length > 10000) e[f.key] = "Maksymalnie 10 000 znaków.";
  }
  return e;
}

/** Shapes a validated report into the payload for the submit_eod_report() SQL function. */
export function toPayload(r: ReportValues) {
  const report = {
    closer_name: r.closer_name.trim(),
    report_date: r.report_date,
    marketing_insight: r.marketing_insight.trim(),
    self_improvement: r.self_improvement.trim(),
    priority_change: r.priority_change.trim(),
  };
  const calls = r.calls.map((c) => {
    const row: Record<string, string | number | boolean | string[] | null> = {};
    for (const f of callFields) {
      const v = c[f.key];
      if (!isCallFieldVisible(f, c) || isEmpty(v)) row[f.key] = null;
      else if (f.type === "rating") row[f.key] = Number(v);
      else if (f.key === "expectation_mismatch") row[f.key] = v === "true";
      else if (Array.isArray(v)) row[f.key] = v;
      else row[f.key] = String(v).trim();
    }
    return row;
  });
  return { report, calls };
}
