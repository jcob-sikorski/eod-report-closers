-- EOD report for closers — v3 (one report per day + one row per call).
-- Run the whole file in Supabase → SQL Editor. Safe to re-run, and it upgrades
-- older versions in place without losing data.

-- ─── Migration from v1 (one wide table) ─────────────────────────────────────
-- v1 data is kept as eod_reports_v1; drop it yourself once you don't need it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'eod_reports' and column_name = 'overall_rating'
  ) then
    alter table public.eod_reports rename to eod_reports_v1;
    alter index if exists public.eod_reports_report_date_idx rename to eod_reports_v1_report_date_idx;
    alter index if exists public.eod_reports_closer_idx rename to eod_reports_v1_closer_idx;
  end if;
end $$;

-- v2 had a per-source stats view; lead source is no longer collected.
drop view if exists public.eod_source_stats;

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.eod_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  closer_name text not null,
  report_date date not null,
  marketing_insight text not null,  -- Jedna rzecz, którą powinien wiedzieć marketing
  self_improvement text not null,   -- Co zrobisz inaczej
  priority_change text not null     -- Priorytetowa zmiana: co, kto, które rozmowy, jaki wynik
);

create table if not exists public.eod_calls (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.eod_reports (id) on delete cascade,
  position smallint not null,                       -- order within the report (1, 2, …)

  prospect text not null,                           -- imię/nazwisko lub ID w CRM
  outcome text not null check (outcome in ('paid','open','lost','disqualified','no_show')),
  no_show_note text,

  fit_score smallint check (fit_score between 1 and 5),
  intent_score smallint check (intent_score between 1 and 5),
  disqualification_reasons text[],                  -- codes, see DISQUALIFICATION_REASONS
  lead_situation text,                              -- krótki opis sytuacji leada
  main_pains text,                                  -- główne bóle, jego słowami
  objections text[],                                -- codes, see OBJECTIONS
  objection_quote text,
  why_now text,
  missing_before_call text,                         -- czego brakowało, żeby kupił od razu
  materials_watched text,                           -- yes | partly | no | not_sent
  expectation_mismatch boolean,
  expectation_mismatch_details text,
  next_step text                                    -- co, kto, do kiedy
);

-- ─── Migration from v2 ───────────────────────────────────────────────────────
do $$
begin
  -- "problem in their words" became "main pains"
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'eod_calls' and column_name = 'problem_in_their_words')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'eod_calls' and column_name = 'main_pains') then
    alter table public.eod_calls rename column problem_in_their_words to main_pains;
  end if;

  -- lead source is no longer asked; keep old values but stop requiring them
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'eod_calls' and column_name = 'lead_source') then
    alter table public.eod_calls alter column lead_source drop not null;
  end if;
end $$;

alter table public.eod_calls add column if not exists lead_situation text;
alter table public.eod_calls add column if not exists main_pains text;
alter table public.eod_calls add column if not exists objections text[];
alter table public.eod_calls add column if not exists missing_before_call text;
alter table public.eod_calls add column if not exists next_step text;

-- single "main objection" became a multi-select
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'eod_calls' and column_name = 'main_objection') then
    update public.eod_calls set objections = array[main_objection]
    where main_objection is not null and objections is null;
    alter table public.eod_calls drop column main_objection;
  end if;
end $$;

-- v3.1: "Kupił, nie zapłacił" (won_unpaid) removed. Any leftover rows become "open".
update public.eod_calls set outcome = 'open' where outcome = 'won_unpaid';
alter table public.eod_calls drop constraint if exists eod_calls_outcome_check;
alter table public.eod_calls add constraint eod_calls_outcome_check
  check (outcome in ('paid','open','lost','disqualified','no_show'));

drop index if exists public.eod_calls_source_idx;
create index if not exists eod_reports_report_date_idx on public.eod_reports (report_date desc);
create index if not exists eod_reports_closer_idx on public.eod_reports (closer_name, report_date desc);
create index if not exists eod_calls_report_idx on public.eod_calls (report_id, position);
create index if not exists eod_calls_outcome_idx on public.eod_calls (outcome);

-- ─── Atomic submit: report + all calls in one transaction ───────────────────

create or replace function public.submit_eod_report(p_report jsonb, p_calls jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_calls) <> 'array' or jsonb_array_length(p_calls) = 0 then
    raise exception 'p_calls must be a non-empty array';
  end if;

  insert into public.eod_reports (closer_name, report_date, marketing_insight, self_improvement, priority_change)
  values (
    p_report->>'closer_name',
    (p_report->>'report_date')::date,
    p_report->>'marketing_insight',
    p_report->>'self_improvement',
    p_report->>'priority_change'
  )
  returning id into v_id;

  insert into public.eod_calls (
    report_id, position, prospect, outcome, no_show_note,
    fit_score, intent_score, disqualification_reasons, lead_situation, main_pains,
    objections, objection_quote, why_now, missing_before_call,
    materials_watched, expectation_mismatch, expectation_mismatch_details, next_step
  )
  select
    v_id,
    c.ord::smallint,
    c.v->>'prospect',
    c.v->>'outcome',
    c.v->>'no_show_note',
    (c.v->>'fit_score')::smallint,
    (c.v->>'intent_score')::smallint,
    case when jsonb_typeof(c.v->'disqualification_reasons') = 'array'
         then array(select jsonb_array_elements_text(c.v->'disqualification_reasons')) end,
    c.v->>'lead_situation',
    c.v->>'main_pains',
    case when jsonb_typeof(c.v->'objections') = 'array'
         then array(select jsonb_array_elements_text(c.v->'objections')) end,
    c.v->>'objection_quote',
    c.v->>'why_now',
    c.v->>'missing_before_call',
    c.v->>'materials_watched',
    (c.v->>'expectation_mismatch')::boolean,
    c.v->>'expectation_mismatch_details',
    c.v->>'next_step'
  from jsonb_array_elements(p_calls) with ordinality as c(v, ord);

  return v_id;
end;
$$;

-- ─── Stats: funnel per day and closer ───────────────────────────────────────

create or replace view public.eod_daily_stats
with (security_invoker = true) as
select
  r.report_date,
  r.closer_name,
  count(*)                                                        as calls_booked,
  count(*) filter (where c.outcome <> 'no_show')                  as calls_held,
  count(*) filter (where c.outcome = 'no_show')                   as no_shows,
  count(*) filter (where c.outcome = 'disqualified')              as disqualified,
  count(*) filter (where c.outcome = 'paid')                      as won,
  count(*) filter (where c.outcome = 'paid')                      as paid,
  count(*) filter (where c.outcome = 'open')                      as open,
  count(*) filter (where c.outcome = 'lost')                      as lost,
  round(100.0 * count(*) filter (where c.outcome <> 'no_show') / count(*), 1)                          as show_rate_pct,
  round(100.0 * count(*) filter (where c.outcome = 'paid')
        / nullif(count(*) filter (where c.outcome <> 'no_show'), 0), 1)                                 as close_rate_pct,
  round(avg(c.fit_score), 2)                                      as avg_fit,
  round(avg(c.intent_score), 2)                                   as avg_intent
from public.eod_calls c
join public.eod_reports r on r.id = c.report_id
group by r.report_date, r.closer_name;

-- ─── Security ────────────────────────────────────────────────────────────────
-- RLS on, no policies: nothing is reachable with the publishable/anon key.
-- The app writes server-side with SUPABASE_SECRET_KEY (service_role).

alter table public.eod_reports enable row level security;
alter table public.eod_calls enable row level security;

revoke all on public.eod_reports, public.eod_calls, public.eod_daily_stats from anon, authenticated;
grant select, insert, update, delete on public.eod_reports, public.eod_calls to service_role;
grant select on public.eod_daily_stats to service_role;

revoke execute on function public.submit_eod_report(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.submit_eod_report(jsonb, jsonb) to service_role;

-- Make the Data API pick up the changes immediately.
notify pgrst, 'reload schema';
