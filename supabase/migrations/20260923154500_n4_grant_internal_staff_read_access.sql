-- N4 corrective migration: expose recurring read tables to authenticated users.
-- RLS and the internal-staff SELECT policies remain the authorization boundary.
grant select on table
  public.recurring_service_plans,
  public.recurring_service_plan_slots,
  public.recurring_service_occurrences
to authenticated;
