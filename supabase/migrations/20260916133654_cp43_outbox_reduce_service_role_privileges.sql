begin;

-- Keep the trusted outbox write boundary minimal: queue workers cannot delete
-- delivery history, and public or generic authenticated roles have no access.
revoke all on table public.portal_invitation_delivery_outbox from public, anon, authenticated;
revoke delete on table public.portal_invitation_delivery_outbox from service_role;
grant select, insert, update on table public.portal_invitation_delivery_outbox to service_role;

commit;
