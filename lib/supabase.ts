import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  // Tolerate a pasted REST endpoint (…supabase.co/rest/v1/) — supabase-js wants the bare project URL.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SECRET_KEY w zmiennych środowiskowych.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
