\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

begin;

drop function if exists public.portal_submit_profile_change_request_v2(text, jsonb, uuid);
drop function if exists public.portal_submit_property_change_request_v2(text, text, jsonb, uuid);
drop function if exists public.portal_list_own_profile_change_requests_v2(text, integer);
drop function if exists public.portal_list_own_property_change_requests_v2(text, text, integer);
drop function if exists portal_private.normalize_profile_change_v2(jsonb);
drop function if exists portal_private.normalize_property_change_v2(jsonb);
drop function if exists portal_private.reviewed_change_receipt_v2(text, text, timestamptz, jsonb, text);

drop policy if exists "Portal reads same-client profile requests" on public.client_portal_profile_change_requests;
drop policy if exists "Portal reads same-client property requests" on public.client_portal_property_change_requests;

drop index if exists public.client_portal_profile_change_v2_idempotency_uidx;
drop index if exists public.client_portal_property_change_v2_idempotency_uidx;
drop index if exists public.client_portal_profile_change_v2_public_reference_uidx;
drop index if exists public.client_portal_property_change_v2_public_reference_uidx;

alter table public.client_portal_profile_change_requests
  drop constraint if exists client_portal_profile_change_public_reference_format,
  drop column if exists idempotency_key,
  drop column if exists public_reference;
alter table public.client_portal_property_change_requests
  drop constraint if exists client_portal_property_change_public_reference_format,
  drop column if exists idempotency_key,
  drop column if exists public_reference;

commit;

select jsonb_build_object(
  'gate', 'CP-3B.2A.6R.1E',
  'kind', 'rollback',
  'result', 'PASS'
)::text as cp3b2a_qa_rollback_v6;
