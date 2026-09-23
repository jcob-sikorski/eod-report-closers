"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { MAX_CALLS, toPayload, validate, type CallValues, type ReportValues } from "@/lib/questions";

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const str = (v: unknown) => (typeof v === "string" ? v : "");

// Never trust the client shape: rebuild the object from known keys/types only.
function sanitize(input: unknown): ReportValues {
  const o = (input ?? {}) as Record<string, unknown>;
  const calls = Array.isArray(o.calls) ? o.calls.slice(0, MAX_CALLS + 1) : [];
  return {
    closer_name: str(o.closer_name),
    report_date: str(o.report_date),
    marketing_insight: str(o.marketing_insight),
    self_improvement: str(o.self_improvement),
    priority_change: str(o.priority_change),
    calls: calls.map((raw) => {
      const c = (raw ?? {}) as Record<string, unknown>;
      const out: CallValues = { id: str(c.id) };
      for (const [k, v] of Object.entries(c)) {
        if (typeof v === "string") out[k] = v;
        else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
      }
      return out;
    }),
  };
}

export async function submitReport(input: ReportValues): Promise<SubmitResult> {
  const values = sanitize(input);

  const fieldErrors = validate(values);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Uzupełnij zaznaczone pola.", fieldErrors };
  }

  try {
    const { report, calls } = toPayload(values);
    const { data, error } = await getSupabaseAdmin().rpc("submit_eod_report", {
      p_report: report,
      p_calls: calls,
    });

    if (error) {
      console.error("Supabase submit_eod_report error:", error);
      return { ok: false, error: "Nie udało się zapisać raportu. Spróbuj ponownie." };
    }
    return { ok: true, id: data as string };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Błąd serwera. Spróbuj ponownie za chwilę." };
  }
}
