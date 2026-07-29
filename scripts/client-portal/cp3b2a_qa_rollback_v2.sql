\if :{?ON_ERROR_STOP}
\else
\echo 'ON_ERROR_STOP is required'
\quit 3
\endif

begin;

do $guard$
begin
  if exists (
    select 1 from public.client_portal_profile_change_requests
    where idempotency_key is not null or public_reference is not null
  ) or exists (
    select 1 from public.client_portal_property_change_requests
    where idempotency_key is not null or public_reference is not null
  ) then
    raise exception 'rollback_rejected_v2_rows_exist' using errcode = '55000';
  end if;
end;
$guard$;

drop function if exists public.portal_submit_profile_change_request_v2(text, jsonb, uuid);
drop function if exists public.portal_submit_property_change_request_v2(text, text, jsonb, uuid);
drop function if exists public.portal_list_own_profile_change_requests_v2(text, integer);
drop function if exists public.portal_list_own_property_change_requests_v2(text, text, integer);
drop function if exists portal_private.normalize_profile_change_v2(jsonb);
drop function if exists portal_private.normalize_property_change_v2(jsonb);
drop function if exists portal_private.reviewed_change_receipt_v2(
  text, text, timestamptz, jsonb, text
);

create policy "Portal reads same-client profile requests"
on public.client_portal_profile_change_requests for select to authenticated
using (portal_private.has_active_portal_membership(auth.uid(), client_id));
create policy "Portal reads same-client property requests"
on public.client_portal_property_change_requests for select to authenticated
using (portal_private.has_active_portal_membership(auth.uid(), client_id));

grant execute on function
  public.portal_submit_profile_change_trusted(uuid, text, jsonb, text, uuid)
to service_role;
grant execute on function
  public.portal_submit_property_change_trusted(uuid, text, text, jsonb, text, uuid)
to service_role;

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
  'result', case when
    to_regprocedure('public.portal_submit_profile_change_request_v2(text,jsonb,uuid)') is null
    and to_regprocedure('public.portal_submit_property_change_request_v2(text,text,jsonb,uuid)') is null
    and to_regprocedure('public.portal_list_own_profile_change_requests_v2(text,integer)') is null
    and to_regprocedure('public.portal_list_own_property_change_requests_v2(text,text,integer)') is null
    and to_regprocedure('portal_private.normalize_profile_change_v2(jsonb)') is null
    and to_regprocedure('portal_private.normalize_property_change_v2(jsonb)') is null
    and to_regprocedure(
      'portal_private.reviewed_change_receipt_v2(text,text,timestamptz,jsonb,text)'
    ) is null
    and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name in (
          'client_portal_profile_change_requests',
          'client_portal_property_change_requests'
        )
        and column_name in ('idempotency_key', 'public_reference')
    )
    and (
      select count(*) from pg_policies
      where schemaname = 'public'
        and policyname in (
          'Portal reads same-client profile requests',
          'Portal reads same-client property requests'
        )
    ) = 2
    and has_function_privilege(
      'service_role',
      'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)',
      'EXECUTE'
    )
    then 'PASS' else 'FAIL' end,
  'contractAbsent', (
    to_regprocedure('public.portal_submit_profile_change_request_v2(text,jsonb,uuid)') is null
    and to_regprocedure('public.portal_submit_property_change_request_v2(text,text,jsonb,uuid)') is null
    and to_regprocedure('public.portal_list_own_profile_change_requests_v2(text,integer)') is null
    and to_regprocedure('public.portal_list_own_property_change_requests_v2(text,text,integer)') is null
  ),
  'customerPoliciesRestored', (
    select count(*) = 2 from pg_policies
    where schemaname = 'public'
      and policyname in (
        'Portal reads same-client profile requests',
        'Portal reads same-client property requests'
      )
  ),
  'legacyServiceGrantsRestored', (
    has_function_privilege(
      'service_role',
      'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)',
      'EXECUTE'
    )
  )
) as cp3b2a_qa_rollback_v2;
