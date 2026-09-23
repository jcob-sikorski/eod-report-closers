import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "eod_dashboard";

/** Cookie value derived from the password — changing DASHBOARD_PASSWORD logs everyone out. */
export function expectedToken(): string | null {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return null;
  return createHash("sha256").update(`eod-dashboard:v1:${pw}`).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function isAuthed(): Promise<boolean> {
  const token = expectedToken();
  if (!token) return false;
  const got = (await cookies()).get(AUTH_COOKIE)?.value;
  return !!got && safeEqual(got, token);
}
