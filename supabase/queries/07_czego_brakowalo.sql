-- Czego brakowało leadom, żeby kupili od razu — materiał na treści przed rozmową, FAQ, reklamy.
-- Uruchom cały plik w Supabase → SQL Editor (Run). Zwraca jeden wynik.

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
  r.report_date                                  as "Data",
  c.prospect                                     as "Klient",
  coalesce((select label from labels where kind = 'outcome' and code = c.outcome), c.outcome) as "Wynik",
  (select string_agg(coalesce(l.label, x), ', ') from unnest(c.objections) as x left join labels l on l.kind = 'objection' and l.code = x) as "Obiekcje",
  c.missing_before_call                          as "Czego brakowało",
  coalesce((select label from labels where kind = 'materials' and code = c.materials_watched), c.materials_watched) as "Materiały przed rozmową"
from public.eod_calls c
join public.eod_reports r on r.id = c.report_id
where c.missing_before_call is not null
order by r.report_date desc, c.position;
