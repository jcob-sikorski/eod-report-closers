-- Lejek setterów per osoba (ostatnie 30 dni): połączenia → rozmowy → umówione.
-- Uruchom cały plik w Supabase → SQL Editor (Run). Zwraca jeden wynik.

select
  setter_name                                                         as "Setter",
  count(*)                                                            as "Raporty",
  sum(dials)                                                          as "Połączenia",
  sum(connected)                                                      as "Rozmowy",
  sum(qualified)                                                      as "Zakwalifikowani",
  sum(booked)                                                         as "Umówione",
  round(100.0 * sum(connected) / nullif(sum(dials), 0), 1)            as "Connect rate %",
  round(100.0 * sum(booked) / nullif(sum(connected), 0), 1)           as "Booking rate %",
  round(100.0 * sum(booked) / nullif(sum(qualified), 0), 1)           as "Umówione z zakwalifikowanych %",
  round(avg(lead_quality), 2)                                         as "Śr. jakość leadów"
from public.setter_reports
where report_date >= current_date - 30
group by setter_name
order by sum(booked) desc;
