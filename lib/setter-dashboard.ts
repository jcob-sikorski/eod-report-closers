import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { labelOf } from "@/lib/questions";
import { NO_BOOK_REASONS, SHARE_SCALE_UNKNOWN } from "@/lib/setter-questions";
import { daysAgo, warsawToday, type Bar, type RangeValue, type TextItem } from "@/lib/dashboard";

type SetterRow = {
  id: string;
  created_at: string;
  setter_name: string;
  report_date: string;
  new_leads: number;
  dials: number;
  connected: number;
  qualified: number;
  booked: number;
  callbacks: number;
  lead_quality: number;
  remembered_optin: string;
  watched_vsl: string;
  no_book_reasons: string[] | null;
  lead_voice: string;
  marketing_insight: string;
  self_improvement: string;
  blockers: string | null;
};

export type SetterTrendPoint = { date: string; dials: number; connected: number; booked: number };

export type SetterPersonRow = {
  name: string;
  reports: number;
  dials: number;
  connected: number;
  qualified: number;
  booked: number;
  connectRate: number | null;
  bookingRate: number | null;
  avgQuality: number | null;
};

export type SetterDashboard = {
  from: string | null;
  to: string;
  setters: string[];
  reports: number;
  totals: {
    newLeads: number;
    dials: number;
    connected: number;
    qualified: number;
    booked: number;
    callbacks: number;
    connectRate: number | null;
    bookingRate: number | null;
    qualifiedRate: number | null;
    bookedOfQualified: number | null;
    avgQuality: number | null;
  };
  trend: SetterTrendPoint[];
  people: SetterPersonRow[];
  reasons: { bars: Bar[]; asked: number };
  remembered: { bars: Bar[]; asked: number };
  watched: { bars: Bar[]; asked: number };
  texts: { voice: TextItem[]; marketing: TextItem[]; improvement: TextItem[]; blockers: TextItem[] };
};

const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const sum = (rows: SetterRow[], k: keyof SetterRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

async function fetchSetterReports(from: string | null): Promise<SetterRow[]> {
  const db = getSupabaseAdmin();
  const PAGE = 1000; // Supabase caps a response at 1000 rows by default
  const out: SetterRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = db
      .from("setter_reports")
      .select("*")
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (from) q = q.gte("report_date", from);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as SetterRow[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function loadSetterDashboard(range: RangeValue, person: string | null): Promise<SetterDashboard> {
  const to = warsawToday();
  const from = range === "all" ? null : daysAgo(to, Number(range) - 1);

  const all = await fetchSetterReports(from);
  const setters = [...new Set(all.map((r) => r.setter_name))].sort((a, b) => a.localeCompare(b, "pl"));
  const rows = person ? all.filter((r) => r.setter_name === person) : all;

  const dials = sum(rows, "dials");
  const connected = sum(rows, "connected");
  const qualified = sum(rows, "qualified");
  const booked = sum(rows, "booked");

  const byDay = new Map<string, SetterTrendPoint>();
  for (const r of rows) {
    const p = byDay.get(r.report_date) ?? { date: r.report_date, dials: 0, connected: 0, booked: 0 };
    p.dials += r.dials;
    p.connected += r.connected;
    p.booked += r.booked;
    byDay.set(r.report_date, p);
  }

  const byPerson = new Map<string, SetterRow[]>();
  for (const r of rows) byPerson.set(r.setter_name, [...(byPerson.get(r.setter_name) ?? []), r]);
  const people: SetterPersonRow[] = [...byPerson.entries()]
    .map(([name, rs]) => ({
      name,
      reports: rs.length,
      dials: sum(rs, "dials"),
      connected: sum(rs, "connected"),
      qualified: sum(rs, "qualified"),
      booked: sum(rs, "booked"),
      connectRate: pct(sum(rs, "connected"), sum(rs, "dials")),
      bookingRate: pct(sum(rs, "booked"), sum(rs, "connected")),
      avgQuality: avg(rs.map((r) => r.lead_quality)),
    }))
    .sort((a, b) => b.booked - a.booked || a.name.localeCompare(b.name, "pl"));

  const withReasons = rows.filter((r) => r.no_book_reasons?.length);
  const reasonCounts = new Map<string, number>();
  for (const r of withReasons) for (const x of r.no_book_reasons!) reasonCounts.set(x, (reasonCounts.get(x) ?? 0) + 1);

  const shareBars = (k: "remembered_optin" | "watched_vsl") =>
    SHARE_SCALE_UNKNOWN.map((o) => ({ key: o.value, label: o.label, value: rows.filter((r) => r[k] === o.value).length })).filter(
      (b) => k === "watched_vsl" || b.key !== "unknown",
    );

  const item = (r: SetterRow, text: string): TextItem => ({ id: r.id, date: r.report_date, closer: r.setter_name, text });

  return {
    from,
    to,
    setters,
    reports: rows.length,
    totals: {
      newLeads: sum(rows, "new_leads"),
      dials,
      connected,
      qualified,
      booked,
      callbacks: sum(rows, "callbacks"),
      connectRate: pct(connected, dials),
      bookingRate: pct(booked, connected),
      qualifiedRate: pct(qualified, connected),
      bookedOfQualified: pct(booked, qualified),
      avgQuality: avg(rows.map((r) => r.lead_quality)),
    },
    trend: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    people,
    reasons: {
      bars: [...reasonCounts.entries()]
        .map(([key, value]) => ({ key, label: labelOf(NO_BOOK_REASONS, key) ?? key, value }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pl")),
      asked: withReasons.length,
    },
    remembered: { bars: shareBars("remembered_optin"), asked: rows.length },
    watched: { bars: shareBars("watched_vsl"), asked: rows.length },
    texts: {
      voice: rows.map((r) => item(r, r.lead_voice)),
      marketing: rows.map((r) => item(r, r.marketing_insight)),
      improvement: rows.map((r) => item(r, r.self_improvement)),
      blockers: rows.filter((r) => r.blockers).map((r) => item(r, r.blockers!)),
    },
  };
}
