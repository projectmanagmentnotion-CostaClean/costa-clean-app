# Ready For Normal Operation — 2026-07-23

## Operating status

Costa Clean production at `https://app.costacleanbcn.com` is ready for normal operation. Mandatory Gates 1–5 are closed within their documented boundaries, P0/P1 open findings are `0`, and the final authenticated production smoke passed.

## Available operational modules

- Secure login and authenticated logout
- Inicio / operational dashboard
- Leads
- Clients
- Properties
- Quotes
- Jobs / services
- Invoices
- Payments / collections
- Expenses
- Fiscal closing views
- Public quote request
- Protected public gym manual quiz

## Actions that still require human review

- Invoice issuance, numbering and fiscal identifiers
- Recording or reconciling payments
- Expense support and fiscal classification
- Quarterly/annual closing interpretation and exports
- Quote acceptance and conversion into operational/financial records
- Any bulk action, destructive cleanup or correction of real data
- Any production rollback or security-incident response

AI-assisted summaries and fiscal intelligence are decision support only. They do not replace accounting, tax or legal review.

## Active protections

- Authenticated AppShell with centralized logout, pending/double-click guard and `SIGNED_OUT` handling
- Anonymous read closure for protected production resources
- Authenticated RPC/write paths
- Public quiz Edge ingress, strict contract checks, server-authoritative scoring and providerless HMAC throttling
- Privacy-safe custom quiz logs
- Fail-closed `db push` npm guards
- Repository secret/private-artifact exclusions
- Separate authorization boundaries for production, QA, Auth, schema and financial/fiscal work

## Known limits

- The current workspace is single-workspace and appropriate only for mutually trusted internal users. It is not a multi-tenant ownership model.
- Providerless quiz protection can be pressured by distributed attackers rotating fingerprints.
- The physical migration directory and legacy history are not proven safe for Supabase CLI push.
- The local disposable PostgreSQL migration proof is not equivalent to a remote Supabase disposable project.
- Full-submit financial/fiscal QA remains outside this roadmap and is not authorized.

## Deferred debt

- Remote disposable Supabase proof
- A separately authorized CLI zero-SQL migration-history gate
- Turnstile or another proof-of-human provider, only if real abuse metrics justify it
- Optional A: measured asset/bundle optimization
- Optional B: incremental CSS/layout consolidation
- Optional C: P3/P4 UX polish
- A tenancy/role model if the trust or company boundary changes

## Conditions that reopen a roadmap

Open a new scoped roadmap before:

- onboarding another company, workspace or differently trusted user group;
- changing roles, ownership, RLS, RPCs, Auth providers or user administration;
- unlocking `db push`, changing migration history or applying schema;
- changing invoice numbering, fiscal sequences, payments, closings or financial full-submit;
- adding a CAPTCHA/proof-of-human provider or changing quiz privacy/retention;
- responding to a P0/P1 security incident;
- a production regression that leaves protected content accessible after logout;
- a new feature or architecture change spanning multiple protected domains.

Otherwise, the next action is normal operation with routine, scoped maintenance under `AGENTS.md`, `CODEX_WORKFLOW.md` and `APP_QUALITY_GATES.md`.
