-- CP-4.2B.5 QA runtime hotfix: PostgreSQL UUID text is lowercase by default.
-- Keep the QA-only receipt prefix while accepting canonical UUID hex case.
-- Target: kpvvydthlxupjjqqdpxy only. Production remains prohibited.

begin;

alter table public.public_lead_intake_requests
  drop constraint if exists public_lead_intake_requests_receipt_check;

alter table public.public_lead_intake_requests
  add constraint public_lead_intake_requests_receipt_check
  check (receipt_id ~ '^QA-CP42B-[0-9A-Fa-f-]{36}$');

commit;
