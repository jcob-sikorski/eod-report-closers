-- Wszystkie raporty setterów — jeden wiersz na settera i dzień, najnowsze na górze.
-- Uruchom cały plik w Supabase → SQL Editor (Run). Zwraca jeden wynik.

with labels(kind, code, label) as (
  values
    ('share', 'most', 'Większość tak'),
    ('share', 'half', 'Mniej więcej połowa'),
    ('share', 'few', 'Większość nie'),
    ('share', 'unknown', 'Nie wiem'),
    ('reason', 'no_memory', 'Nie pamięta zapisu'),
    ('reason', 'budget', 'Brak budżetu'),
    ('reason', 'too_early', 'Tylko się rozgląda'),
    ('reason', 'wrong_profile', 'Nie ta grupa docelowa'),
    ('reason', 'no_time', 'Brak czasu / zły moment'),
    ('reason', 'info_first', 'Chce najpierw info mailem'),
    ('reason', 'price', 'Pyta o cenę'),
    ('reason', 'partner', 'Musi skonsultować z kimś'),
    ('reason', 'other', 'Inne')
)
select
  s.report_date                                                        as "Data",
  s.setter_name                                                        as "Setter",
  s.new_leads                                                          as "Nowe leady",
  s.dials                                                              as "Połączenia",
  s.connected                                                          as "Rozmowy",
  s.qualified                                                          as "Zakwalifikowani",
  s.booked                                                             as "Umówione",
  s.callbacks                                                          as "Callbacki",
  round(100.0 * s.connected / nullif(s.dials, 0), 1)                   as "Connect rate %",
  round(100.0 * s.booked / nullif(s.connected, 0), 1)                  as "Booking rate %",
  s.lead_quality                                                       as "Jakość leadów 1–5",
  (select label from labels where kind = 'share' and code = s.remembered_optin) as "Pamiętali zapis",
  (select label from labels where kind = 'share' and code = s.watched_vsl)      as "Obejrzeli wideo",
  (select string_agg(coalesce(l.label, x), ', ') from unnest(s.no_book_reasons) x
     left join labels l on l.kind = 'reason' and l.code = x)          as "Powody braku umówienia",
  s.lead_voice                                                         as "Co mówili leady",
  s.marketing_insight                                                  as "Dla marketingu",
  s.self_improvement                                                   as "Co zrobię inaczej",
  s.blockers                                                           as "Blokery",
  to_char(s.created_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') as "Wysłano"
from public.setter_reports s
order by s.report_date desc, s.created_at desc
limit 500;
