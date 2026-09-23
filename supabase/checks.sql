-- Wszystkie odpowiedzi z raportów EOD — jeden wiersz na rozmowę, najnowsze na górze.
-- Uruchom cały plik w Supabase → SQL Editor (Run). Zwraca jeden wynik.
-- Pytania z podsumowania dnia powtarzają się przy każdej rozmowie z tego raportu.
-- Pozostałe analizy są w folderze supabase/queries/ (każdy plik = jeden wynik).

with labels(kind, code, label) as (
  values
    ('outcome', 'paid', 'Kupił i zapłacił'),
    ('outcome', 'open', 'Decyzja otwarta'),
    ('outcome', 'lost', 'Nie kupił'),
    ('outcome', 'disqualified', 'Niezakwalifikowany'),
    ('outcome', 'no_show', 'Nie pojawił się'),
    ('dq', 'budget', 'Brak możliwości finansowych'),
    ('dq', 'too_early', 'Za wczesny etap zakupowy'),
    ('dq', 'wrong_profile', 'Nie ta grupa docelowa'),
    ('dq', 'no_authority', 'Nie decyduje sam(a)'),
    ('dq', 'no_problem', 'Brak realnego problemu'),
    ('dq', 'other', 'Inne'),
    ('objection', 'price', 'Cena / za drogo'),
    ('objection', 'timing', 'Zły moment / brak czasu'),
    ('objection', 'trust', 'Wątpliwości co do efektów'),
    ('objection', 'partner', 'Musi skonsultować z kimś'),
    ('objection', 'think', '„Muszę to przemyśleć”'),
    ('objection', 'alternative', 'Rozważa inną opcję'),
    ('objection', 'diy', 'Chce spróbować sam(a)'),
    ('objection', 'none', 'Brak obiekcji'),
    ('objection', 'other', 'Inna'),
    ('materials', 'yes', 'Tak'),
    ('materials', 'partly', 'Częściowo'),
    ('materials', 'no', 'Nie'),
    ('materials', 'not_sent', 'Nie wysłano')
)
select
  r.report_date                                              as "Data",
  r.closer_name                                              as "Closer",
  c.position                                                 as "Nr",
  c.prospect                                                 as "Klient",
  coalesce((select label from labels where kind = 'outcome' and code = c.outcome), c.outcome) as "Wynik",
  c.fit_score                                                as "Dopasowanie 1–5",
  c.intent_score                                             as "Intencja 1–5",
  c.lead_situation                                           as "Sytuacja leada",
  c.main_pains                                               as "Główne bóle",
  (select string_agg(coalesce(l.label, x), ', ') from unnest(c.objections) as x left join labels l on l.kind = 'objection' and l.code = x) as "Obiekcje",
  c.objection_quote                                          as "Cytat przy obiekcji",
  c.why_now                                                  as "Dlaczego teraz",
  c.missing_before_call                                      as "Czego brakowało do zakupu",
  coalesce((select label from labels where kind = 'materials' and code = c.materials_watched), c.materials_watched) as "Materiały przed rozmową",
  case c.expectation_mismatch when true then 'Tak' when false then 'Nie' end as "Rozjazd oczekiwań",
  c.expectation_mismatch_details                             as "Czego się spodziewał",
  c.next_step                                                as "Następny krok",
  (select string_agg(coalesce(l.label, x), ', ') from unnest(c.disqualification_reasons) as x left join labels l on l.kind = 'dq' and l.code = x) as "Powody dyskwalifikacji",
  c.no_show_note                                             as "Notatka (no-show)",
  r.marketing_insight                                        as "Dzień: dla marketingu",
  r.self_improvement                                         as "Dzień: co zrobię inaczej",
  r.priority_change                                          as "Dzień: priorytetowa zmiana",
  to_char(r.created_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') as "Wysłano"
from public.eod_calls c
join public.eod_reports r on r.id = c.report_id
order by r.created_at desc, c.position
limit 500;
