begin;

create or replace function public.portal_resolve_self_access_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_verified boolean := false;
  v_active_count integer := 0;
  v_selected_client_id text := null;
  v_memberships jsonb := '[]'::jsonb;
  v_application_status text := null;
  v_state text := 'authenticated_without_access';
begin
  if v_user_id is null then
    return jsonb_build_object(
      'state', v_state,
      'selectedClientId', null,
      'memberships', v_memberships,
      'applicationStatus', null
    );
  end if;

  v_is_verified := portal_private.is_verified_portal_user(v_user_id);

  select
    count(*)::integer,
    min(m.client_id),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'clientId', m.client_id,
          'membershipId', m.id,
          'role', m.role,
          'status', m.status
        )
        order by m.client_id
      ),
      '[]'::jsonb
    )
  into v_active_count, v_selected_client_id, v_memberships
  from public.client_portal_memberships as m
  where v_is_verified
    and m.user_id = v_user_id
    and m.status = 'active'
    and m.revoked_at is null;

  select a.status
  into v_application_status
  from public.client_portal_applications as a
  where a.user_id = v_user_id;

  if v_active_count = 1 then
    v_state := 'active_member';
  elsif v_active_count > 1 then
    v_state := 'client_selection_required';
    v_selected_client_id := null;
  else
    v_selected_client_id := null;
    v_memberships := '[]'::jsonb;

    if exists (
      select 1
      from public.client_portal_memberships as m
      where m.user_id = v_user_id
        and m.status = 'suspended'
    ) then
      v_state := 'suspended';
    elsif exists (
      select 1
      from public.client_portal_memberships as m
      where m.user_id = v_user_id
        and m.status = 'revoked'
    ) then
      v_state := 'revoked';
    elsif v_application_status = 'pending_review' then
      v_state := 'pending_review';
    else
      v_state := 'authenticated_without_access';
    end if;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'selectedClientId', v_selected_client_id,
    'memberships', v_memberships,
    'applicationStatus', v_application_status
  );
end;
$$;

alter function public.portal_resolve_self_access_context() owner to postgres;
revoke all on function public.portal_resolve_self_access_context()
  from public, anon, authenticated, service_role;
grant execute on function public.portal_resolve_self_access_context()
  to authenticated;

comment on function public.portal_resolve_self_access_context() is
  'Resolves only the authenticated caller portal access state from auth.uid(); '
  'the result is non-enumerable, contains no PII, and performs no writes.';

commit;
