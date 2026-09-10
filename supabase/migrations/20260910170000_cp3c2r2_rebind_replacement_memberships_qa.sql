-- CP-3C.2R2: QA-only rebind for the two corrupted CP-3C.1 identities.
-- This migration must never be applied to production. The QA fixture guard
-- below makes an accidental production application fail closed.
begin;

do $$
begin
  if not exists (select 1 from public.clients where id = 'QA-CP3C1-CLIENT-B-20260910') then
    raise exception 'cp3c2r2_qa_fixture_required';
  end if;
end;
$$;

alter table public.client_portal_memberships
  disable trigger client_portal_membership_no_relink;

do $$
begin
  if not exists (
    select 1 from public.client_portal_memberships
    where id = '11111111-1111-4111-8111-111111111111'
      and user_id = '93b1f5f1-ca54-4b5d-8209-a883788c8352'
      and client_id = 'QA-CP3B2B-PORTAL-20260908-CLIENT'
      and role = 'client_member' and status = 'active'
  ) then raise exception 'cp3c2r2_member_precondition_failed'; end if;
  if not exists (
    select 1 from public.client_portal_memberships
    where id = '22222222-2222-4222-8222-222222222222'
      and user_id = '50466c12-4ce5-4351-9050-e23f475b6cfe'
      and client_id = 'QA-CP3C1-CLIENT-B-20260910'
      and role = 'client_admin' and status = 'active'
  ) then raise exception 'cp3c2r2_admin_precondition_failed'; end if;
end;
$$;

update public.client_portal_memberships
set user_id = 'c311031e-10af-42e3-8cd2-f00a74370dd1'
where id = '11111111-1111-4111-8111-111111111111';
update public.client_portal_memberships
set user_id = '6c182b2a-52ca-465e-8e82-01ff79d7e3fc'
where id = '22222222-2222-4222-8222-222222222222';

alter table public.client_portal_memberships
  enable trigger client_portal_membership_no_relink;
commit;
