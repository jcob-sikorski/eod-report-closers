-- Kontrola spójności danych. Powinno zwrócić 0 wierszy
-- (dla raportów wysłanych aktualną wersją formularza).
-- Uruchom cały plik w Supabase → SQL Editor (Run). Zwraca jeden wynik.

select * from (
  select r.report_date as "Data", r.closer_name as "Closer", c.position as "Nr", c.prospect as "Klient", c.outcome as "Wynik",
    case
      when c.outcome = 'no_show' and coalesce(c.fit_score, c.intent_score) is not null then 'no-show z ocenami'
      when c.outcome <> 'no_show' and (c.fit_score is null or c.intent_score is null) then 'brak ocen 1–5'
      when c.outcome <> 'no_show' and (c.lead_situation is null or c.main_pains is null or c.why_now is null) then 'brak sytuacji / bólów / why now'
      when c.outcome = 'disqualified' and coalesce(cardinality(c.disqualification_reasons), 0) = 0 then 'brak powodu dyskwalifikacji'
      when c.outcome <> 'disqualified' and c.disqualification_reasons is not null then 'powód dyskwalifikacji przy innym wyniku'
      when c.outcome in ('open','lost','won_unpaid') and c.objections is null then 'brak obiekcji'
      when c.objections is not null and c.objections <> array['none'] and c.objection_quote is null then 'obiekcja bez cytatu'
      when c.outcome in ('open','lost','won_unpaid') and c.missing_before_call is null then 'brak: czego brakowało'
      when c.outcome in ('open','won_unpaid') and c.next_step is null then 'brak następnego kroku'
      when c.expectation_mismatch and c.expectation_mismatch_details is null then 'rozjazd oczekiwań bez opisu'
    end as "Problem"
  from public.eod_calls c
  join public.eod_reports r on r.id = c.report_id
) t
where "Problem" is not null
order by "Data" desc;
