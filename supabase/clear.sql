-- ⚠️  USUWA WSZYSTKIE RAPORTY I ROZMOWY. Tego nie da się cofnąć.
-- Tabele, funkcja i widoki zostają — formularz i dashboard działają dalej, tylko bez danych.
-- Uruchom cały plik w Supabase → SQL Editor. Zwraca liczbę wierszy po czyszczeniu (powinno być 0).

truncate table public.eod_calls, public.eod_reports;

-- Opcjonalnie: usuń też stare dane z pierwszej wersji formularza (jeśli istnieją).
-- Odkomentuj linię poniżej, żeby to zrobić:
-- drop table if exists public.eod_reports_v1;

select
  (select count(*) from public.eod_reports) as raporty,
  (select count(*) from public.eod_calls)   as rozmowy;
