-- N5.1 QA-only forward repair. No policy, RLS, data, or write privilege changes.
begin;

grant select on public.expense_capture_sessions to authenticated;
grant select on public.expense_capture_documents to authenticated;

commit;
