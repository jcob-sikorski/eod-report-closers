-- Podsumowania dnia od closerów.
-- Uruchom cały plik w Supabase → SQL Editor (Run). Zwraca jeden wynik.

select
  report_date          as "Data",
  closer_name          as "Closer",
  marketing_insight    as "Dla marketingu",
  self_improvement     as "Co zrobię inaczej",
  priority_change      as "Priorytetowa zmiana"
from public.eod_reports
order by report_date desc, created_at desc
limit 100;
