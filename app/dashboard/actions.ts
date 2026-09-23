"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, expectedToken, safeEqual } from "@/lib/dashboard-auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return { error: "Dashboard nie ma ustawionego hasła (DASHBOARD_PASSWORD)." };

  const given = String(formData.get("password") ?? "");
  // Small delay blunts password guessing.
  await new Promise((r) => setTimeout(r, 400));
  if (!safeEqual(given, pw)) return { error: "Nieprawidłowe hasło." };

  (await cookies()).set(AUTH_COOKIE, expectedToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/dashboard",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/dashboard");
}

export async function logout() {
  (await cookies()).delete({ name: AUTH_COOKIE, path: "/dashboard" });
  redirect("/dashboard");
}
