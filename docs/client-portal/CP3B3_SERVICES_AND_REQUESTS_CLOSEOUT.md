# CP-3B.3 Services and Requests Closeout

Date: 2026-08-05

Scope: client portal services and own service requests.

## Verdict

`BLOCKED`

The service-request contract was corrected in QA and the structural postcheck
now passes, but the authenticated browser proof for the live `services` and
`service-requests` views is still blocked in this desktop environment.

## What Was Corrected

- The QA migration gap was fixed with a new corrective migration that uses the
  real `properties.display_code` contract through private helpers instead of
  leaking it in the public RPC definitions.
- Direct table write privileges were revoked from `authenticated` on the
  operational and financial tables checked by the postcheck.
- The QA postcheck now passes in the real QA database target.
- The same postcheck also passed in a disposable PostgreSQL 17 cluster before
  touching QA.

## Evidence

### Database

- QA target: `kpvvydthlxupjjqqdpxy`
- Corrective migration applied:
  - [`/C:/Users/USUARIO/costa-clean-app/supabase/migrations/20260805123000_portal_service_request_contract_v3.sql`](/C:/Users/USUARIO/costa-clean-app/supabase/migrations/20260805123000_portal_service_request_contract_v3.sql)
  - [`/C:/Users/USUARIO/costa-clean-app/supabase/migrations/20260805124000_portal_service_request_table_write_privileges_v1.sql`](/C:/Users/USUARIO/costa-clean-app/supabase/migrations/20260805124000_portal_service_request_table_write_privileges_v1.sql)
- QA postcheck:
  - `PASS` against the real QA database
- Disposable PostgreSQL 17 proof:
  - `PASS` after the same corrective path and privilege fix

### Repo Gates

- `npm test` `PASS`
- `npm test -- --pool=threads` `PASS`
- `npm run qa:agents` `PASS`
- `npm run lint` `PASS`
- `npm run build` `PASS`

### Browser Smoke

- Active local app checked at `http://127.0.0.1:5173/`
- The browser smoke reached the login screen, not an authenticated portal shell.
- The `services` and `service-requests` views therefore did not expose real
  authenticated data in this environment.
- The captured navigation and screenshots show the login surface only.

## What Remains Blocked

- Authenticated browser proof for the live services/request views.
- The requested end-to-end service-request list/detail/create/cancel matrix.
- Final UI proof of zero residual synthetic rows in the live portal shell.

## Notes

- Production was not modified.
- The repository work is limited to the corrective QA contract, the privilege
  fix, the postcheck hardening, and documentation updates.
- No secrets, JWTs or anon keys are printed here.

