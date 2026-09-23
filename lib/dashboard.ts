import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DISQUALIFICATION_REASONS, MATERIALS, OBJECTIONS, OUTCOMES, labelOf } from "@/lib/questions";

export const RANGES = [
  { value: "7", label: "7 dni" },
  { value: "30", label: "30 dni" },
  { value: "90", label: "90 dni" },
  { value: "all", label: "Wszystko" },
] as const;
export type RangeValue = (typeof RANGES)[number]["value"];

type CallRow = {
  id: string;
  position: number;
  prospect: string;
  outcome: string;
  no_show_note: string | null;
  fit_score: number | null;
  intent_score: number | null;
  disqualification_reasons: string[] | null;
  lead_situation: string | null;
  main_pains: string | null;
  objections: string[] | null;
  objection_quote: string | null;
  why_now: string | null;
  missing_before_call: string | null;
  materials_watched: string | null;
  expectation_mismatch: boolean | null;
  expectation_mismatch_details: string | null;
  next_step: string | null;
};

type ReportRow = {
  id: string;
  created_at: string;
  report_date: string;
  closer_name: string;
  marketing_insight: string;
  self_improvement: string;
  priority_change: string;
  eod_calls: CallRow[];
};

export type Bar = { key: string; label: string; value: number };
export type TrendPoint = { date: string; booked: number; held: number; won: number };
export type TextItem = {
  id: string;
  date: string;
  closer: string;
  prospect?: string;
  outcome?: string;
  outcomeLabel?: string;
  text: string;
  extra?: string;
};

export type Dashboard = {
  from: string | null;
  to: string;
  closers: string[];
  reports: number;
  totals: {
    booked: number;
    held: number;
    noShow: number;
    won: number;
    paid: number;
    disqualified: number;
    showRate: number | null;
    closeRate: number | null;
    dqRate: number | null;
    avgFit: number | null;
    avgIntent: number | null;
    mismatchRate: number | null;
    mismatchCount: number;
    mismatchAsked: number;
  };
  outcomes: Bar[];
  objections: { bars: Bar[]; asked: number };
  dqReasons: { bars: Bar[]; asked: number };
  materials: { bars: Bar[]; asked: number };
  trend: TrendPoint[];
  texts: {
    pains: TextItem[];
    missing: TextItem[];
    quotes: TextItem[];
    expectations: TextItem[];
    openDeals: TextItem[];
    notes: TextItem[];
  };
};

const warsawToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());

function daysAgo(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function countBars(values: string[], options: { value: string; label: string }[]): Bar[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()]
    .map(([key, value]) => ({ key, label: labelOf(options, key) ?? key, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pl"));
}

async function fetchReports(from: string | null): Promise<ReportRow[]> {
  const db = getSupabaseAdmin();
  const PAGE = 1000; // Supabase caps a response at 1000 rows by default
  const out: ReportRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = db
      .from("eod_reports")
      .select(
        "id, created_at, report_date, closer_name, marketing_insight, self_improvement, priority_change, eod_calls(*)",
      )
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (from) q = q.gte("report_date", from);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as unknown as ReportRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function loadDashboard(range: RangeValue, closer: string | null): Promise<Dashboard> {
  const to = warsawToday();
  const from = range === "all" ? null : daysAgo(to, Number(range) - 1);

  const all = await fetchReports(from);
  const closers = [...new Set(all.map((r) => r.closer_name))].sort((a, b) => a.localeCompare(b, "pl"));
  const reports = closer ? all.filter((r) => r.closer_name === closer) : all;

  const calls = reports.flatMap((r) =>
    [...(r.eod_calls ?? [])].sort((a, b) => a.position - b.position).map((c) => ({ ...c, r })),
  );
  const held = calls.filter((c) => c.outcome !== "no_show");
  const won = calls.filter((c) => c.outcome === "paid");
  const dq = calls.filter((c) => c.outcome === "disqualified");
  const mismatchAsked = held.filter((c) => c.expectation_mismatch !== null);
  const mismatchYes = mismatchAsked.filter((c) => c.expectation_mismatch);

  const withObjections = calls.filter((c) => Array.isArray(c.objections) && c.objections.length > 0);
  const withMaterials = held.filter((c) => c.materials_watched);

  // Daily trend (oldest → newest)
  const byDay = new Map<string, TrendPoint>();
  for (const c of calls) {
    const d = c.r.report_date;
    const p = byDay.get(d) ?? { date: d, booked: 0, held: 0, won: 0 };
    p.booked++;
    if (c.outcome !== "no_show") p.held++;
    if (c.outcome === "paid") p.won++;
    byDay.set(d, p);
  }
  const trend = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

  const item = (c: (typeof calls)[number], text: string, extra?: string): TextItem => ({
    id: c.id,
    date: c.r.report_date,
    closer: c.r.closer_name,
    prospect: c.prospect,
    outcome: c.outcome,
    outcomeLabel: labelOf(OUTCOMES, c.outcome),
    text,
    extra,
  });

  const objectionsLabel = (xs: string[] | null) =>
    (xs ?? []).map((x) => labelOf(OBJECTIONS, x) ?? x).join(", ") || undefined;

  return {
    from,
    to,
    closers,
    reports: reports.length,
    totals: {
      booked: calls.length,
      held: held.length,
      noShow: calls.length - held.length,
      won: won.length,
      paid: calls.filter((c) => c.outcome === "paid").length,
      disqualified: dq.length,
      showRate: pct(held.length, calls.length),
      closeRate: pct(won.length, held.length),
      dqRate: pct(dq.length, held.length),
      avgFit: avg(held.flatMap((c) => (c.fit_score ? [c.fit_score] : []))),
      avgIntent: avg(held.flatMap((c) => (c.intent_score ? [c.intent_score] : []))),
      mismatchRate: pct(mismatchYes.length, mismatchAsked.length),
      mismatchCount: mismatchYes.length,
      mismatchAsked: mismatchAsked.length,
    },
    outcomes: OUTCOMES.map((o) => ({ key: o.value, label: o.label, value: calls.filter((c) => c.outcome === o.value).length })),
    objections: { bars: countBars(withObjections.flatMap((c) => c.objections!), OBJECTIONS), asked: withObjections.length },
    dqReasons: { bars: countBars(dq.flatMap((c) => c.disqualification_reasons ?? []), DISQUALIFICATION_REASONS), asked: dq.length },
    materials: {
      bars: MATERIALS.map((m) => ({ key: m.value, label: m.label, value: withMaterials.filter((c) => c.materials_watched === m.value).length })),
      asked: withMaterials.length,
    },
    trend,
    texts: {
      pains: held.filter((c) => c.main_pains).map((c) => item(c, c.main_pains!, c.lead_situation ?? undefined)),
      missing: held.filter((c) => c.missing_before_call).map((c) => item(c, c.missing_before_call!, objectionsLabel(c.objections))),
      quotes: held.filter((c) => c.objection_quote).map((c) => item(c, c.objection_quote!, objectionsLabel(c.objections))),
      expectations: held.filter((c) => c.expectation_mismatch && c.expectation_mismatch_details).map((c) => item(c, c.expectation_mismatch_details!)),
      openDeals: calls
        .filter((c) => c.outcome === "open")
        .map((c) => item(c, c.next_step ?? "— brak następnego kroku —", objectionsLabel(c.objections))),
      notes: reports.map((r) => ({
        id: r.id,
        date: r.report_date,
        closer: r.closer_name,
        text: r.marketing_insight,
        extra: `Zmiana: ${r.priority_change}\nCo zrobię inaczej: ${r.self_improvement}`,
      })),
    },
  };
}
