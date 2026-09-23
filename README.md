# Raport EOD — Closerzy

Formularz Next.js (App Router), w którym closerzy na koniec dnia dodają **kartę dla każdej rozmowy** (wynik, sytuacja leada, główne bóle, obiekcje, czego brakowało do zakupu, następny krok…) oraz **3 wnioski z dnia**. Dane trafiają do Supabase: `eod_reports` (1 wiersz na dzień) i `eod_calls` (1 wiersz na rozmowę). Widok `eod_daily_stats` liczy show rate i close rate per dzień i closer.

## Konfiguracja

1. **Supabase** → SQL Editor → wklej i uruchom `supabase/schema.sql`.
2. Skopiuj `.env.example` do `.env.local` i uzupełnij:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SECRET_KEY` — Project Settings → API Keys → Secret key (`sb_secret_…`) lub starszy `service_role`
   - `DASHBOARD_PASSWORD` — hasło do `/dashboard` (bez niego dashboard jest zablokowany)
3. `npm install && npm run dev` → http://localhost:3000
4. Wyślij testowy raport i sprawdź zapis, uruchamiając `supabase/checks.sql` w SQL Editorze.

## Deploy na Vercel

1. Wypchnij repo na GitHub i zaimportuj je w Vercel (framework wykryje się sam).
2. W Settings → Environment Variables dodaj `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` i `DASHBOARD_PASSWORD`.
3. Deploy.

## Jak to działa

- UI: [shadcn/ui](https://ui.shadcn.com) (styl new-york, kolor neutral) + Tailwind CSS v4, font Geist. Komponenty są w `components/ui/`, kolejne dodasz przez `npx shadcn@latest add <nazwa>`. Motyw jasny/ciemny podąża za ustawieniem systemu.
- `lib/questions.ts` — jedyne źródło prawdy: listy opcji (obiekcje, powody dyskwalifikacji, materiały), pola karty rozmowy, pytania na koniec dnia, warunki widoczności i walidacja.
  - **Obiekcje, powody dyskwalifikacji itd. możesz edytować tylko w tym pliku** — w bazie są zapisywane jako kody bez ograniczeń CHECK, więc nie trzeba migracji. Nie zmieniaj istniejących kodów (`value`), tylko etykiety, bo stare dane przestaną się zgadzać.
  - Kody wyników (`outcome`) są zablokowane w SQL, bo korzysta z nich widok statystyk.
- Pola karty pokazują się zależnie od wyniku: przy „Nie pojawił się” tylko notatka; przy „Niezakwalifikowany” powody dyskwalifikacji zamiast obiekcji; obiekcje i „czego brakowało” są wymagane przy wynikach otwarty / nie kupił, a następny krok przy otwartym. Ukryte pola zapisują się jako `NULL`.
- `app/actions.ts` — Server Action: waliduje dane i wywołuje funkcję SQL `submit_eod_report`, która zapisuje raport i wszystkie rozmowy w jednej transakcji. Klucz sekretny nigdy nie trafia do przeglądarki.
- Wersja robocza zapisuje się w `localStorage`, imię closera jest zapamiętywane.
- RLS jest włączone bez polityk, a uprawnienia ma tylko `service_role` — tabele są niedostępne kluczem publicznym.
- `/dashboard` — zestawienie dla marketingu (chronione hasłem `DASHBOARD_PASSWORD`, cookie na 30 dni): show rate, close rate, % niezakwalifikowanych, średnie oceny, trend dzienny, wyniki, obiekcje, powody dyskwalifikacji, materiały, rozjazd oczekiwań oraz zakładki z tekstami (bóle, czego brakowało, cytaty obiekcji, otwarte deale, wnioski closerów). Filtry: zakres dat (7/30/90 dni/wszystko) i closer. Logika agregacji: `lib/dashboard.ts`.
- `supabase/checks.sql` — wszystkie odpowiedzi w czytelnej formie (jeden wynik — uruchom cały plik). `supabase/queries/` — osobne analizy dla marketingu, każdy plik zwraca jeden wynik (lejek, obiekcje, powody dyskwalifikacji, bóle klientów ich słowami, czego brakowało do zakupu, rozjazd oczekiwań, otwarte deale).

> Formularz nie ma logowania — każdy z linkiem może wysłać raport. Jeśli potrzebujesz ochrony, dodaj Vercel Password Protection albo Supabase Auth.
