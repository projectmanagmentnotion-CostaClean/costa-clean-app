# Notification Producer Phase 2

## Local contract

`costa-clean-notification-producer` is a server-side Supabase Edge Function. It is intended to run from an authenticated scheduler using `COSTA_CLEAN_NOTIFICATION_PRODUCER_SECRET` or the service-role bearer token. It reads authoritative tables with the service role, resolves active internal staff from `internal_staff_memberships`, and inserts only `ready` rows in `notification_reminders`.

The producer families are:

- `unpaid_invoices_older_threshold` -> `collections` -> `/?view=invoices&filter=overdue`
- `expenses_missing_support` -> `administration` -> `/?view=expenses&filter=missing_support`
- `completed_jobs_without_invoice_older_threshold` -> `operations` -> `/?view=jobs&filter=completed_without_invoice`
- `accepted_quotes_without_job_older_threshold` -> `operations` -> `/?view=quotes&filter=accepted_pending_action`

Deduplication is deterministic per staff user and condition: `v1:<rule-id>:<source-id>`, scoped by the database `user_id`. Reminder payloads contain the rule id only; no customer, supplier, invoice, quote, job or expense display data is sent.

The existing UI alert decisions use aggregate fingerprints. They are not treated as equivalent to producer records. Producer suppression is explicit only when `alert_key`, per-record fingerprint, scope and user match, with status `resolved` or `dismissed`.

## QA status

- Local producer tests: PASS.
- Full local suite: PASS (`590 passed`, `4 skipped`).
- `npm run lint`: PASS.
- `npm run build`: PASS.
- VAPID keypair: not generated or configured in this work block.
- Remote QA target: not independently verified; remote writes and deployment remain blocked.

Required deployment secrets remain outside Git:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COSTA_CLEAN_NOTIFICATION_PRODUCER_SECRET`
- `COSTA_CLEAN_NOTIFICATION_DISPATCH_SECRET`
- `COSTA_CLEAN_VAPID_SUBJECT`
- `COSTA_CLEAN_VAPID_PUBLIC_KEY`
- `COSTA_CLEAN_VAPID_PRIVATE_KEY`
- frontend `VITE_COSTA_CLEAN_VAPID_PUBLIC_KEY`

The function configuration and remote scheduler are intentionally not changed here. A future deployment block must first identify an independently verified non-production Supabase target and separately configure the Edge Function gateway and scheduler.
