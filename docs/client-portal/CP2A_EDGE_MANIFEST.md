# CP-2A Edge manifest

## Functions

| Function | Boundary | Allowed actions |
|---|---|---|
| `portal-account-actions` | account lifecycle | application, invitation acceptance |
| `portal-service-actions` | customer-reviewed changes | profile/property change, service request create/cancel |
| `portal-member-actions` | tenant administration | invite/revoke within explicit client |
| `portal-invoice-download` | private document delivery | authorize and sign one exact object |

`_shared/portalContract.ts` enforces exact fields, action/surface separation, sizes and identifiers. `_shared/portalHandler.ts` verifies the bearer with Supabase Auth, requires confirmed email, hashes network/rate subjects, uses server-only service-role calls to trusted RPCs, emits generic errors and logs only event/status/correlation ID. Configuration accepts only QA ref `kpvvydthlxupjjqqdpxy` and rejects production ref `wfxnwfcdjainpojhbdri`.

`verify_jwt=false` in local config is intentional because JWT validation is performed explicitly by the shared handler before dispatch. Missing/invalid configuration fails before network access. The member function has no delivery adapter in CP-2A, so it cannot send email or create a live invitation through Edge.

Secrets, by name only: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORTAL_INVITATION_PEPPER`, `PORTAL_RATE_LIMIT_PEPPER`, `PORTAL_ALLOWED_ORIGIN`; optional `PORTAL_REQUIRE_AAL2_FOR_ADMIN`. No values are versioned.

Hashes and future QA-only deploy/rollback commands are frozen in `CP2B_EXACT_QA_AUTHORIZATION.md`.
