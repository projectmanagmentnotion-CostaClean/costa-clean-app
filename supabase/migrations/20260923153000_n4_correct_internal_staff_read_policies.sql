-- N4 corrective migration: align recurring-service read policies with the
-- certified internal-staff authorization predicate. The original N4 migration
-- remains immutable and is not replayed or rewritten.

drop policy if exists recurring_service_plans_internal_read on public.recurring_service_plans;
create policy recurring_service_plans_internal_read on public.recurring_service_plans
  for select to authenticated
  using (app_private.is_active_internal_staff(auth.uid()));

drop policy if exists recurring_service_plan_slots_internal_read on public.recurring_service_plan_slots;
create policy recurring_service_plan_slots_internal_read on public.recurring_service_plan_slots
  for select to authenticated
  using (app_private.is_active_internal_staff(auth.uid()));

drop policy if exists recurring_service_occurrences_internal_read on public.recurring_service_occurrences;
create policy recurring_service_occurrences_internal_read on public.recurring_service_occurrences
  for select to authenticated
  using (app_private.is_active_internal_staff(auth.uid()));
