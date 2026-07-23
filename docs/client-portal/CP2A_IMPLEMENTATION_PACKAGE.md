# CP-2A implementation package

Status: `COMPLETE — SOURCE ONLY`. CP-2B and `/portal` UI are not executed or implemented.

## Boundary delivered

The package replaces the unsafe meaning of “any authenticated user is staff” with an explicit `internal_staff_memberships` authority. It adds deny-by-default portal tenancy, invitation/application/review workflows, service requests, audit/rate-limit records, private invoice-document metadata and narrow RPC/Edge projections. Email is contact data, never ownership evidence.

Canonical CRM tables remain the source of truth. Portal identities receive no direct canonical table access and no legacy CRM/financial RPC access. Every customer operation carries one explicit `client_id`, rechecks active membership and returns a generic denial for absent, random or cross-client objects.

## Source artifacts

- migration: `supabase/migrations/20260723160000_client_portal_security_boundary.sql`
- Edge shared boundary and four entry points under `supabase/functions`
- disposable fixtures, authorization matrix, cleanup, rollback and PostgreSQL 17 proof under `scripts/client-portal`
- future CP-2B apply/snapshot/plan files that are non-executable remotely in this gate

No QA/production database, Auth user, Storage bucket, secret, Edge deployment, email, WordPress or frontend was changed. No real PDF or fiscal data was used. The local proof is not Supabase Cloud proof.

## Source inventory

The pre-change source audit found 18 public tables, 8 sequences, 15 non-internal triggers, 49 public function signatures, 28 `SECURITY DEFINER` functions, 23 broad any-authenticated policies and four broad authenticated expense-object policies. The local proof writes the complete post-apply machine-readable inventory to its ignored private JSON report, including tables/owners/grants, policies, function signatures/owners/grants/configuration, sequences, triggers and default privileges. The exact future runtime inventory is emitted as JSON by `scripts/client-portal/cp2b_catalog_snapshot.sql`; it is read-only and has not been run against QA.

## Gate result

Local catalog assertions after apply: 11 portal tables, 20 portal functions, 11 tables with `FORCE RLS`, zero broad any-authenticated policies, private invoice bucket and zero security-definer functions without fixed `search_path`. Cleanup returned portal fixture rows and dummy documents to zero.
