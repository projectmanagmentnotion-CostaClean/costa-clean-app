\set ON_ERROR_STOP on

do $$
begin
  if to_regprocedure(
    'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)'
  ) is null
    or to_regprocedure(
      'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)'
    ) is null
  then
    raise exception 'legacy_change_contract_missing';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'client_portal_profile_change_requests',
        'client_portal_property_change_requests'
      )
      and column_name in ('idempotency_key', 'public_reference')
  ) then
    raise exception 'contract_gap_not_reproduced_columns_present';
  end if;

  if to_regprocedure(
    'public.portal_submit_profile_change_request_v2(text,jsonb,uuid)'
  ) is not null
    or to_regprocedure(
      'public.portal_submit_property_change_request_v2(text,text,jsonb,uuid)'
    ) is not null
  then
    raise exception 'contract_gap_not_reproduced_functions_present';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.portal_submit_profile_change_trusted(uuid,text,jsonb,text,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.portal_submit_property_change_trusted(uuid,text,text,jsonb,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'legacy_edge_prestate_not_reproduced';
  end if;
end;
$$;

\echo CP3B2_REVIEWED_CHANGE_CONTRACT_MISSING reproduced
