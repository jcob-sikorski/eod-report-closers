"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { setterFields, toSetterRow, validateSetter, type SetterValues } from "@/lib/setter-questions";

export type SetterSubmitResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const ALLOWED = new Set(["setter_name", "report_date", ...setterFields.map((f) => f.key)]);

// Never trust the client shape: keep only known keys with string / string[] values.
function sanitize(input: unknown): SetterValues {
  const out: SetterValues = {};
  for (const [k, v] of Object.entries((input ?? {}) as Record<string, unknown>)) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

export async function submitSetterReport(input: SetterValues): Promise<SetterSubmitResult> {
  const values = sanitize(input);
  const fieldErrors = validateSetter(values);
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Uzupełnij zaznaczone pola.", fieldErrors };

  try {
    const { error } = await getSupabaseAdmin().from("setter_reports").insert(toSetterRow(values));
    if (error) {
      console.error("Supabase setter_reports insert error:", error);
      return { ok: false, error: "Nie udało się zapisać raportu. Spróbuj ponownie." };
    }
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Błąd serwera. Spróbuj ponownie za chwilę." };
  }
}
