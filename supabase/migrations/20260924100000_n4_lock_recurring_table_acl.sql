-- N4 forward ACL correction.
-- Normalize only the recurring-service table ACLs; do not alter defaults,
-- owners, service_role privileges, RLS, policies, or migration history.

revoke all privileges on table
  public.recurring_service_plans,
  public.recurring_service_plan_slots,
  public.recurring_service_occurrences
from public, anon, authenticated;

grant select on table
  public.recurring_service_plans,
  public.recurring_service_plan_slots,
  public.recurring_service_occurrences
to authenticated;
