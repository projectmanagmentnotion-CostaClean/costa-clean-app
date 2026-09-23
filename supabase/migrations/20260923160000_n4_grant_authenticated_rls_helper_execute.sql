-- N4 corrective migration: allow authenticated RLS evaluation through the
-- self-only internal-staff helper. The helper remains SECURITY DEFINER with
-- an empty search_path and performs the membership check itself.
grant execute on function app_private.is_active_internal_staff(uuid)
to authenticated;
