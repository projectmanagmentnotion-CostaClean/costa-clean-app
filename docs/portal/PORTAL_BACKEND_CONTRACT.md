# Portal Backend Contract Audit

Audit date: 2026-09-04

## Inventory

- Portal migrations: security boundary, self-access context, reviewed changes, service-request contracts v2/v3, and write privilege corrections.
- Edge Functions: `portal-account-actions`, `portal-service-actions`, `portal-invoice-download`, `portal-member-actions`.
- Shared boundary: `supabase/functions/_shared/portalHandler.ts` and `portalContract.ts`.
- Browser adapter: `src/portal/adapters/portalSupabaseClient.ts` and `portalSupabaseAuthProvider.ts`.
- Storage contract: private invoice-document access is represented by the invoice download function and documented in `INVOICE_DOCUMENT_SECURITY.md` and `CP2A_STORAGE_REVIEW.md`.
- QA evidence: `scripts/client-portal/*.manifest.json`, SQL prechecks/postchecks/rollback files, concurrency runners, and contract tests.

## Security invariants observed

- Portal browser code uses the authenticated Supabase session path; no `service_role` usage was found under `src/portal`.
- Portal access is membership-based and routed through portal-specific reads/actions rather than treating email as tenancy proof.
- Client A/client B isolation is a named contract and is covered by the access and QA matrices.
- Invoice access is read-only from the portal perspective; download is mediated by a dedicated Edge Function.
- Reviewed changes and service requests use narrow contracts, explicit states, and idempotency/replay controls.
- Invitation security documentation covers hashing, expiry, single use, and replay protection. Delivery/runtime certification remains a separate QA concern.

## RLS and RPC posture

The repository contains explicit security-boundary migrations and allowlisted contracts. The source and documentation preserve RLS/membership predicates and do not authorize a blanket authenticated user path for portal data. No Supabase production mutation was performed in this audit, and no claim is made that every remote policy currently equals the local migration history without a separately authorized read-only remote inspection.

## Risks and open gates

- Current CRM and portal share the same repository but must retain distinct trust surfaces and bootstrap boundaries.
- Public WordPress must never write directly to canonical CRM tables; a future lead-intake boundary must be narrow and server-trusted.
- No public portal registration should be introduced without an explicit authorization and security review.
- Real private-PDF expiry, invitation delivery, and two-client cross-tenant E2E remain required certification work.
- Supabase remote schema, Auth Admin, Storage, and Edge deployment were not changed.

## Backend decision

Preserve the current contracts and migrations as the authoritative local design. Do not copy portal tables into a new public-web project, expose service-role credentials, or apply migrations remotely as part of unification.

