begin;

-- Product keeps the existing authenticated client workflow and internal-staff
-- RLS boundary, but never exposes the legacy expense relation through the
-- anonymous Data API. Storage policies remain bucket-scoped and unchanged.
revoke all on table public.expenses from public, anon;

commit;
