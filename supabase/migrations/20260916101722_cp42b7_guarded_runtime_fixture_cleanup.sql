-- CP-4.2B.7R: privileged cleanup for the one synthetic full-funnel fixture.
-- QA-only target: kpvvydthlxupjjqqdpxy. Never apply to production.
-- The audit append-only trigger remains intact. This SECURITY DEFINER function
-- is intentionally constrained to the exact CP42B7 synthetic identity.

begin;

create or replace function public.cleanup_cp42b7_runtime_fixture_qa(
  p_submission_id uuid,
  p_lead_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_intake_ok boolean;
  v_lead_ok boolean;
  v_attribution_ok boolean;
  v_seed_ok boolean;
  v_consents_ok boolean;
begin
  if p_submission_id is null or nullif(btrim(p_lead_id), '') is null then
    raise exception 'CP42B7_QA_CLEANUP_GUARD_FAILED';
  end if;

  select exists (
    select 1
    from public.public_lead_intake_requests as intake
    where intake.submission_id = p_submission_id
      and intake.lead_id = p_lead_id
      and intake.contract_version = 'cp42b-v2'
  ) into v_intake_ok;

  select exists (
    select 1
    from public.leads as lead
    where lead.id = p_lead_id
      and lead.public_intake_last_submission_id = p_submission_id
      and lead.full_name = 'QA CP42B7 Runtime'
      and lead.email = 'qa.cp42b7.runtime@qa.invalid'
      and lead.phone = '+34999999999'
  ) into v_lead_ok;

  select exists (
    select 1
    from public.public_quote_intake_attribution as attribution
    where attribution.submission_id = p_submission_id
      and attribution.utm_source = 'qa_b7_runtime'
      and attribution.utm_medium = 'internal_qa'
      and attribution.utm_campaign = 'cp42b7_certification'
  ) into v_attribution_ok;

  select exists (
    select 1
    from public.public_quote_draft_seeds as seed
    where seed.submission_id = p_submission_id
      and seed.lead_id = p_lead_id
      and seed.schema_version = 'quote_draft_seed_v1'
      and seed.contract_version = 'costa_clean_quote_intelligence@1.0.0'
      and seed.estimate_model_version = 'estimate_v1'
  ) into v_seed_ok;

  select count(*) = 4 into v_consents_ok
  from public.public_quote_intake_consents as consent
  where consent.submission_id = p_submission_id;

  if not (v_intake_ok and v_lead_ok and v_attribution_ok and v_seed_ok and v_consents_ok) then
    raise exception 'CP42B7_QA_CLEANUP_GUARD_FAILED';
  end if;

  delete from public.public_quote_intake_audit
  where submission_id = p_submission_id;
  delete from public.public_quote_draft_seeds
  where submission_id = p_submission_id and lead_id = p_lead_id;
  delete from public.public_quote_intake_attribution
  where submission_id = p_submission_id;
  delete from public.public_quote_intake_consents
  where submission_id = p_submission_id;
  delete from public.public_lead_intake_requests
  where submission_id = p_submission_id and lead_id = p_lead_id;
  delete from public.leads
  where id = p_lead_id
    and public_intake_last_submission_id = p_submission_id
    and full_name = 'QA CP42B7 Runtime'
    and email = 'qa.cp42b7.runtime@qa.invalid'
    and phone = '+34999999999';

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'submission_deleted', true,
    'lead_deleted', true
  );
end;
$$;

alter function public.cleanup_cp42b7_runtime_fixture_qa(uuid, text) owner to postgres;
revoke all on function public.cleanup_cp42b7_runtime_fixture_qa(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.cleanup_cp42b7_runtime_fixture_qa(uuid, text) to service_role;

commit;
