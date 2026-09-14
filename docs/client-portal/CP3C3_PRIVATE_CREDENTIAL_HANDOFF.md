# CP-3C.3 Private Credential Handoff

Status: `CLOSED — superseded by CP-3C.3R8.1`

At handoff time, the authenticated visual matrix could not be executed from
this workspace because the required QA-only credentials for the five
controlled identities were not available in `.auth/cp3c3/credentials.json`,
and no safe private admin channel was exposed to the process.

The former handoff requirement was completed through the integrated QA
Dashboard session under CP-3C.3R8.1. The temporary QA admin capability was
revoked after exact fixture cleanup, and the private credential files were
removed. No human credential or token handoff is pending.

Historical safe paths, no longer required for this gate:

1. Place valid QA-only credentials for `ADMIN_A`, `MEMBER_A_V2`, `ADMIN_B_V2`,
   `SUSPENDED_OR_INACTIVE_A` and `REVOKED_A` in the already-defined ignored
   `.auth/cp3c3/credentials.json` file, preserving the runner's expected shape.
2. Provide a temporary authorized QA admin mechanism that can rotate only the
   passwords for those identities. The mechanism must target the QA project
   and must not expose secrets in source control, logs or browser evidence.

No password was inferred from historical ledgers. No direct SQL manipulation of
`auth.users.encrypted_password` was attempted. No credentials, tokens, cookies,
service-role keys or private reports are stored in this repository.
