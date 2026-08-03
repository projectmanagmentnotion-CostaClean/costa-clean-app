# CP-3B.2A.6R.1 Exact QA Authorization V6R1

Authorization ID: `CP3B2A-QA-V6R1-AUTHORIZATION-PENDING`

Package status: `PREPARED_NOT_AUTHORIZED`

Authorized base:

- repository: `C:\Users\USUARIO\costa-clean-app`
- branch: `main`
- required base HEAD: `79a83b42cd739e4a952f0a3eac61729600949766`
- QA project ref: `kpvvydthlxupjjqqdpxy`
- production ref: `wfxnwfcdjainpojhbdri`
- private backup location: `.project-agent/private/cp3b2a-v6r1`

Allowed in this gate:

- `node scripts/client-portal/run-cp3b2a-qa-v6.mjs --plan`
- `node scripts/client-portal/run-cp3b2a-qa-v6.mjs --preflight`
- `node scripts/client-portal/run-cp3b2a6-local-proof.mjs`

Blocked in this gate:

- `node scripts/client-portal/run-cp3b2a-qa-v6.mjs --execute`
- QA writes
- production writes
- migration-history mutation
- frontend changes
- invoice changes

This note is documentary only. It does not authorize any remote effect by itself.
