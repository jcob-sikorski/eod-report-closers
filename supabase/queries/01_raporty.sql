-- Lista raportów z liczbą rozmów i wynikami.
-- Uruchom cały plik w Supabase → SQL Editor (Run). Zwraca jeden wynik.

select
  r.report_date                                               as "Data",
  r.closer_name                                               as "Closer",
  count(c.id)                                                 as "Rozmowy",
  count(*) filter (where c.outcome = 'paid')                  as "Kupił i zapłacił",
  count(*) filter (where c.outcome = 'won_unpaid')            as "Kupił, nie zapłacił",
  count(*) filter (where c.outcome = 'open')                  as "Otwarte",
  count(*) filter (where c.outcome = 'lost')                  as "Nie kupił",
  count(*) filter (where c.outcome = 'disqualified')          as "Niezakwalifikowani",
  count(*) filter (where c.outcome = 'no_show')               as "No-show",
  to_char(r.created_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') as "Wysłano"
from public.eod_reports r
left join public.eod_calls c on c.report_id = r.id
group by r.id
order by r.created_at desc
limit 100;
