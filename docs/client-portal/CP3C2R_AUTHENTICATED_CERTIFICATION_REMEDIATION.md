# CP-3C.2R Authenticated Certification Remediation

Date: 2026-09-10  
Target: QA project `kpvvydthlxupjjqqdpxy` only  
Status: `DONE — CP-3C.2R3 consolidated QA certification`

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

The prior active token was classified as unrecoverable and not reused. A new
CP-3C-owned token was generated privately with the rotated QA pepper and its
HMAC-SHA256 hash was stored only in the QA fixture. Acceptance returned `200`
and consumed the invitation; replay returned neutral `404`. The invitee has
exactly one Client B `client_member` membership. Expired, revoked, used and
invalid token cases returned neutral denial with no membership creation.

## Browser Evidence

The local portal was restarted against `.env.qa.local` and the QA browser
loaded the authenticated portal. After the explicit local-origin allowlist,
the members surface loaded the real Client A list. Browser console logs showed
no unexpected errors; direct authenticated browser-origin calls verified the
member and invitation requests. No production request was made by the QA
scripts or QA server.

## Gate Decision

`CP-3C.2` is `DONE` for the authorized QA scope. CP-3C.3 must not start
automatically. Google provider private configuration and CP4.3 invitation
delivery remain explicitly external debts.
