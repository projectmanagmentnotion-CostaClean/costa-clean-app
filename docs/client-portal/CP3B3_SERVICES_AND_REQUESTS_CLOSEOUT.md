# CP-3B.3 Services and Requests Closeout

Date: 2026-09-09

Scope: client portal services and own service requests.

## Verdict

`PARTIAL — AUTHENTICATED QA EVIDENCE CAPTURED`

The service-request contract was corrected in QA and the authenticated browser
proof is now available in the normal Chrome session against the QA build. The
functional request path passed for one controlled synthetic request. This
closeout does not claim the unobserved idempotency retry or DevTools
console/network checks as executed.

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

- Active QA app checked at `http://127.0.0.1:4174/portal` in the existing
  authenticated Chrome profile.
- Target observed from the QA build: `kpvvydthlxupjjqqdpxy.supabase.co`.
- Services list: `EMPTY_STATE_PASS`; no upcoming or previous services were
  exposed.
- One controlled synthetic request was submitted once for `PRO-0074`, service
  `Limpieza regular`, preferred date `2026-09-20`, morning window, and details
  `QA CP-3B.3 synthetic request`.
- Public receipt observed: `CC-SR-1F6F8616183F06DCC2750102` with
  `Pendiente de revisión`.
- Request detail exposed the public property reference, truthful request
  fields, and customer-safe review wording; no internal identifiers were
  shown.
- The same request was cancelled through the customer flow after explicit
  confirmation. The detail and history both showed `Cancelada`; the history
  row remained and no property/service mutation was observed.
- No producer or dispatcher was run, and no production target was used.

## Evidence Not Executed

- Same-key idempotency retry with a measured duplicate count.
- DevTools console error review and request-by-request QA/production network
  capture.
- Reload/session persistence evidence for this exact request flow.
- Remote synthetic-residue query after cancellation.

## Notes

- Production was not modified.
- QA synthetic receipt `CC-SR-1F6F8616183F06DCC2750102` remains in history as
  `cancelled` unless a separately authorized remote cleanup is performed.
- The repository work is limited to the corrective QA contract, the privilege
  fix, the postcheck hardening, and documentation updates.
- No secrets, JWTs or anon keys are printed here.
