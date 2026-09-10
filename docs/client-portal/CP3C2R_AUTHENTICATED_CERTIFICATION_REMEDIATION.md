# CP-3C.2R Authenticated Certification Remediation

Date: 2026-09-10  
Target: QA project `kpvvydthlxupjjqqdpxy` only  
Status: `PARTIAL — replacement identities verified; invitation and integrated browser certification remain blocked`

## QA Boundary

- Production writes, deploys, Auth mutations and requests: `0`.
- QA migration applied: `portal_cross_tenant_denial_semantics_v1`.
- QA-only Edge deployment: `portal-invoice-download`.
- No CRM UI, CRM schema or production environment was modified.
- Credentials and invitation tokens remain only in ignored private ledgers.

## Identity Remediation

- `ADMIN_A`: password repaired; password auth `200`; `/auth/v1/user` `200`; self-access is active `client_admin` on Client A.
- `MEMBER_A`: preserved unchanged after confirmed Auth row corruption; replacement `MEMBER_A_V2` authenticates normally and owns only the original Client A member row.
- `ADMIN_B`: preserved unchanged after confirmed Auth row corruption; replacement `ADMIN_B_V2` authenticates normally and owns only the original Client B admin row.
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

The active invitation remains pending, unexpired, Client B and
`client_member`. Its stored hash is not the legacy all-zero fixture value, so
the database row alone does not prove runtime pepper parity. The raw token is
not present in the private ledger and was not invented or regenerated.
Acceptance/replay therefore remain deferred rather than being reported as
PASS. Used, expired and revoked fixtures were not changed.

## Browser Evidence

The local portal was restarted against `.env.qa.local` and the QA browser
loaded the authenticated portal at `390x844` as `ADMIN_A`. The replacement
identities also pass direct Auth, `/auth/v1/user` and self-access checks. The
members Edge Function returns the generic `request_unavailable` for the local
origin before its member RPCs, so integrated member Console/Network evidence
is incomplete. No production request was made by the QA scripts or QA server.

## Gate Decision

`CP-3C.2` remains `PARTIAL`. CP-3C.3 must not start automatically. Remaining
debt is limited to active invitation acceptance/replay and the integrated
browser member Console/Network matrix; the two corrupted Auth identities are
preserved and have verified V2 replacements.
