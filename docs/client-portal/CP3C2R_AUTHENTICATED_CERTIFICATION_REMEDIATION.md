# CP-3C.2R Authenticated Certification Remediation

Date: 2026-09-10  
Target: QA project `kpvvydthlxupjjqqdpxy` only  
Status: `PARTIAL — remediation evidence captured; Auth and invitation certification remain blocked`

## QA Boundary

- Production writes, deploys, Auth mutations and requests: `0`.
- QA migration applied: `portal_cross_tenant_denial_semantics_v1`.
- QA-only Edge deployment: `portal-invoice-download`.
- No CRM UI, CRM schema or production environment was modified.
- Credentials and invitation tokens remain only in ignored private ledgers.

## Identity Remediation

- `ADMIN_A`: password repaired; password auth `200`; `/auth/v1/user` `200`; self-access is active `client_admin` on Client A.
- `MEMBER_A`: password repair was attempted on the verified synthetic identity, but Auth still returns `500 unexpected_failure`; no membership or role was changed.
- `ADMIN_B`: password repair was attempted on the verified synthetic identity, but Auth still returns `500 unexpected_failure`; no membership or role was changed.
- `INVITEE_ACTIVE`: one new synthetic `@qa.invalid` identity was created with no membership, application or consent; it is retained until CP3C.3.

## Cross-Tenant Denial

The three reproducible failures were `portal_get_client_profile`,
`portal_list_properties` and `portal_list_invoices`. All originated in
`portal_private.current_portal_client_id(text)`, which raised `P0002` and
surfaced as HTTP 500. The QA-only correction returns `NULL` for an
unauthorized client context, preserving filtered no-data behavior.

After the correction, the three calls returned `200` with `null`, `[]` and
`[]`; no foreign data was returned. Services and account context also return
the existing neutral no-data contract. No grants, write RPCs or tenant
checks were weakened.

## Invoice Certification

Existing fixture `INV-QA-CP3B4-20260909-001` was read without mutation:
status `issued`, subtotal `100`, tax `21`, total `121`, invoice number
`2026-001`. Download authorization returned `200` with `expiresIn=60`.
The private PDF returned `200`, `27126` bytes, MIME `application/pdf`, and
the expected SHA-256. The same signed URL returned `400` after 65 seconds;
a fresh authorization returned a new working URL. Unsigned object access
returned `400`.

## Invitation Certification

The original active invitation was repointed only to `INVITEE_ACTIVE`; used,
expired and revoked lifecycle fixtures were not changed. Acceptance returned
neutral `404`; the invitation remains pending and the new identity has zero
memberships. This remains a contract/fixture certification debt, not a
successful acceptance.

## Browser Evidence

The local portal was restarted against `.env.qa.local` because the prior
`4174` process pointed at the production Supabase URL. The QA browser loaded
the authenticated portal at `390x844`. Full multi-identity integrated
Console/Network certification was not completed: MEMBER_A and ADMIN_B Auth
fail before portal access, and the browser DevTools evidence is therefore
incomplete. No production request was made by the QA scripts or QA server.

## Gate Decision

`CP-3C.2` remains `PARTIAL`. CP-3C.3 must not start automatically. Remaining
debt is limited to the two Auth `unexpected_failure` identities, active
invitation acceptance/replay, and full integrated Console/Network matrix.
