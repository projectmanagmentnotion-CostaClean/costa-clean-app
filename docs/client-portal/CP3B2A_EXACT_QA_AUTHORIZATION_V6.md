# CP-3B.2A.6R.1E Exact QA Authorization V6R1E

Authorization ID: `CP3B2A-QA-V6R1E-AUTHORIZATION-PENDING`

Package status: `PREPARED_NOT_AUTHORIZED`

Authorized base:

- repository: `C:\Users\USUARIO\costa-clean-app`
- branch: `main`
- source/provenance HEAD: `81f1f73ffbc46ba44e6fd285816d56f4f565c411`
- runtime authorized HEAD: provided later by exact human authorization and must match the local HEAD, `origin/main`, the approved backup HEAD, and the snapshot HEAD
- QA project ref: `kpvvydthlxupjjqqdpxy`
- production ref: `wfxnwfcdjainpojhbdri`
- private backup location: `.project-agent/private/cp3b2a-v6r1e`

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
