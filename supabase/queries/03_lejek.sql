-- Lejek: umówione → odbyte → sprzedaż, per dzień i closer (ostatnie 30 dni).
-- Uruchom cały plik w Supabase → SQL Editor (Run). Zwraca jeden wynik.

select
  report_date     as "Data",
  closer_name     as "Closer",
  calls_booked    as "Umówione",
  calls_held      as "Odbyte",
  no_shows        as "No-show",
  disqualified    as "Niezakwalifikowani",
  won             as "Sprzedaż",
  paid            as "Zapłacone",
  open            as "Otwarte",
  lost            as "Nie kupił",
  show_rate_pct   as "Show rate %",
  close_rate_pct  as "Close rate %",
  avg_fit         as "Śr. dopasowanie",
  avg_intent      as "Śr. intencja"
from public.eod_daily_stats
where report_date >= current_date - 30
order by report_date desc, closer_name;
