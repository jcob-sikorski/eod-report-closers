// Setter EOD report: one row per setter per day. Setters call inbound leads,
// qualify them and book calls with closers — so the report is mostly numbers
// plus a few pick-lists and three short notes.
//
// Option codes are stored as-is in setter_reports (no CHECK constraint), so
// labels and new options can be edited here without a migration.

import type { Option } from "@/lib/questions";

export type SetterValues = Record<string, string | string[]>;
export type SetterFieldType = "number" | "rating" | "chips" | "multi" | "textarea";

export type SetterField = {
  key: string;
  label: string;
  type: SetterFieldType;
  hint?: string;
  options?: Option[];
  half?: boolean;
  optional?: boolean;
  showIf?: (v: SetterValues) => boolean;
};

export type SetterSection = { title: string; description?: string; fields: SetterField[] };

// ─── Option lists ────────────────────────────────────────────────────────────

export const SHARE_SCALE: Option[] = [
  { value: "most", label: "Większość tak" },
  { value: "half", label: "Mniej więcej połowa" },
  { value: "few", label: "Większość nie" },
];

export const SHARE_SCALE_UNKNOWN: Option[] = [...SHARE_SCALE, { value: "unknown", label: "Nie wiem" }];

export const NO_BOOK_REASONS: Option[] = [
  { value: "no_memory", label: "Nie pamięta zapisu" },
  { value: "budget", label: "Brak budżetu" },
  { value: "too_early", label: "Tylko się rozgląda" },
  { value: "wrong_profile", label: "Nie ta grupa docelowa" },
  { value: "no_time", label: "Brak czasu / zły moment" },
  { value: "info_first", label: "Chce najpierw info mailem" },
  { value: "price", label: "Pyta o cenę" },
  { value: "partner", label: "Musi skonsultować z kimś" },
  { value: "other", label: "Inne" },
];

// ─── Fields ──────────────────────────────────────────────────────────────────

const n = (v: SetterValues, k: string) => {
  const x = Number(typeof v[k] === "string" ? v[k] : "");
  return Number.isFinite(x) ? x : 0;
};

export const setterSections: SetterSection[] = [
  {
    title: "Liczby z dnia",
    description: "Wpisz 0, jeśli czegoś nie było.",
    fields: [
      { key: "new_leads", type: "number", half: true, label: "Ile nowych leadów dostałeś/aś do obdzwonienia?" },
      { key: "dials", type: "number", half: true, label: "Ile połączeń wykonałeś/aś?", hint: "Wszystkie próby, także nieodebrane." },
      { key: "connected", type: "number", half: true, label: "Z iloma leadami udało się porozmawiać?" },
      { key: "qualified", type: "number", half: true, label: "Ilu rozmówców spełniało kryteria kwalifikacji?" },
      { key: "booked", type: "number", half: true, label: "Ile rozmów z closerem umówiłeś/aś?" },
      { key: "callbacks", type: "number", half: true, label: "Ilu leadów prosiło o kontakt w innym terminie?" },
    ],
  },
  {
    title: "Jakość leadów",
    fields: [
      { key: "lead_quality", type: "rating", label: "Jak oceniasz jakość dzisiejszych leadów?", hint: "1 — bardzo słabe, 5 — bardzo dobre." },
      { key: "remembered_optin", type: "chips", options: SHARE_SCALE, label: "Czy leady pamiętały, na co się zapisały?" },
      { key: "watched_vsl", type: "chips", options: SHARE_SCALE_UNKNOWN, label: "Czy leady obejrzały wideo / materiały przed telefonem?" },
      {
        key: "no_book_reasons",
        type: "multi",
        options: NO_BOOK_REASONS,
        label: "Najczęstsze powody, dla których rozmowa nie skończyła się umówieniem",
        hint: "Zaznacz te, które dziś się powtarzały.",
        showIf: (v) => n(v, "connected") > n(v, "booked"),
      },
    ],
  },
  {
    title: "Wnioski",
    fields: [
      {
        key: "lead_voice",
        type: "textarea",
        label: "Co najczęściej słyszałeś/aś od leadów?",
        hint: "Ich słowami: problemy, oczekiwania, pytania. To trafia prosto do marketingu.",
      },
      { key: "marketing_insight", type: "textarea", label: "Jedna rzecz, którą powinien wiedzieć marketing" },
      { key: "self_improvement", type: "textarea", label: "Co zrobisz inaczej jutro?" },
      {
        key: "blockers",
        type: "textarea",
        optional: true,
        label: "Czy coś blokowało Twoją pracę?",
        hint: "Np. CRM, jakość listy, brak wolnych terminów u closerów.",
      },
    ],
  },
];

export const setterFields = setterSections.flatMap((s) => s.fields);
export const isSetterFieldVisible = (f: SetterField, v: SetterValues) => !f.showIf || f.showIf(v);

const isEmpty = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v.length === 0 : !(v ?? "").toString().trim();

/** Returns { field: message }. Empty object = valid. */
export function validateSetter(v: SetterValues): Record<string, string> {
  const e: Record<string, string> = {};
  const name = typeof v.setter_name === "string" ? v.setter_name.trim() : "";
  const date = typeof v.report_date === "string" ? v.report_date : "";
  if (!name) e.setter_name = "Podaj imię i nazwisko.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.report_date = "Podaj datę.";

  for (const f of setterFields) {
    if (!isSetterFieldVisible(f, v)) continue;
    const val = v[f.key];
    if (isEmpty(val)) {
      if (!f.optional) e[f.key] = f.type === "multi" ? "Zaznacz co najmniej jedną opcję." : "Wymagane.";
      continue;
    }
    if (f.type === "number") {
      const x = Number(val);
      if (!Number.isInteger(x) || x < 0 || x > 10000) e[f.key] = "Podaj liczbę całkowitą ≥ 0.";
    } else if (f.type === "rating") {
      const x = Number(val);
      if (!Number.isInteger(x) || x < 1 || x > 5) e[f.key] = "Wybierz 1–5.";
    } else if (f.type === "multi") {
      if (!Array.isArray(val) || !val.every((x) => f.options!.some((o) => o.value === x))) e[f.key] = "Nieprawidłowa opcja.";
    } else if (f.options) {
      if (!f.options.some((o) => o.value === val)) e[f.key] = "Nieprawidłowa opcja.";
    } else if (String(val).length > 10000) {
      e[f.key] = "Maksymalnie 10 000 znaków.";
    }
  }

  // The numbers have to add up.
  if (!e.connected && !e.dials && n(v, "connected") > n(v, "dials")) e.connected = "Nie może być więcej niż połączeń.";
  for (const k of ["qualified", "booked", "callbacks"]) {
    if (!e[k] && !e.connected && n(v, k) > n(v, "connected")) e[k] = "Nie może być więcej niż rozmów.";
  }
  return e;
}

/** Validated values → a setter_reports row (hidden/empty fields become null). */
export function toSetterRow(v: SetterValues) {
  const row: Record<string, string | number | string[] | null> = {
    setter_name: String(v.setter_name).trim(),
    report_date: String(v.report_date),
  };
  for (const f of setterFields) {
    const val = v[f.key];
    if (!isSetterFieldVisible(f, v) || isEmpty(val)) row[f.key] = null;
    else if (f.type === "number" || f.type === "rating") row[f.key] = Number(val);
    else if (Array.isArray(val)) row[f.key] = val;
    else row[f.key] = String(val).trim();
  }
  return row;
}
