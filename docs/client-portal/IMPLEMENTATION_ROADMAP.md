# Client Portal Implementation Roadmap

Date: 2026-07-27
Current state: CP-0/CP-1/CP-2A/CP-2A.1/CP-2A.2 complete; CP-2B blocked pending explicit V3 authorization; CP-3 not started

## CP-0 — Discovery

Status: `DONE — source/live read-only evidence`

- Exact app repository and baseline verified.
- Public site identified as WordPress/SiteGround; no Git repository exists in connected/local scope.
- WordPress framework/plugins/forms/legal surfaces inventoried.
- CRM Auth, canonical tables, PDF rendering, Storage, RLS, RPC, Edge and routes mapped.
- Data classification and trust-boundary map produced.
- Production and QA writes: zero.

Residual prerequisite: obtain a WordPress/SiteGround export, owner and deployment procedure before CP-4.

## CP-1 — Security, tenancy and legal design

Status: `DONE — documentation only`

- Explicit memberships, secure invitations and pending approval designed.
- `client_admin`/`client_member`, service requests, audit, revocation, recovery, anti-enumeration, rate limiting and MFA-ready controls specified.
- P0 current any-authenticated policy risk identified.
- Exact RLS/grant/RPC intent and cross-client matrix defined.
- Private invoice delivery and short signed access specified.
- Legal, content, consent, processor/transfer and retention matrices prepared.
- Exact CP-2 QA authorization package prepared.

No professional legal approval is claimed.

## CP-2A — Immutable source package and disposable proof

Status: `DONE — source only, QA/production unchanged`

- one reviewed migration, four Edge boundaries and private Storage design;
- explicit staff trust boundary and deny-by-default customer tenancy;
- deterministic synthetic fixtures, authorization matrix and exact cleanup;
- PostgreSQL 17.10 disposable apply/rollback/reapply proof;
- frozen migration/Edge/runner/fixture/rollback hashes;
- future QA commands documented but not executed.

Evidence: `CP2A_IMPLEMENTATION_PACKAGE.md` and `CP2B_EXACT_QA_AUTHORIZATION.md`.

## CP-2A.1 — QA-compatible execution package

Status: `DONE — source/local only, QA/production unchanged`

- original 16 frozen artifacts preserved byte-for-byte;
- separate V2 Auth/fixtures/matrix/cleanup/recovery/runner package;
- Auth UUIDs generated dynamically and injected privately;
- exact private ledger under `.git/cp2b-private/`;
- target/hash/backup/authorization execution gates;
- PostgreSQL 17 disposable dynamic-Auth/matrix/cleanup/rollback proof;
- V2 manifest and future exact authorization prepared but not granted.

Evidence: `CP2A1_QA_EXECUTION_PACKAGE.md`, `CP2B_EXACT_QA_AUTHORIZATION_V2.md`, and `scripts/client-portal/cp2b_qa_package_v2.manifest.json`.

## CP-2A.2 — Windows-compatible Supabase CLI runner

Status: `DONE — source/local read-only, QA/production unchanged`

- the clean V2 block was reproduced as Windows `spawnSync(.cmd) -> EINVAL` before ledger creation;
- a separate V3 launcher executes the real Supabase JavaScript entry and supports restricted, quoted `.cmd` execution;
- V3 adds a separate manifest, authorization ID, outer execution gate and Windows preload while preserving all original/V2 bytes;
- real Windows shim, Supabase version, authenticated project listing, QA link, production rejection, command quoting and secret redaction are locally proven;
- no V2/V3 `--execute` command ran and remote writes remain zero.

Evidence: `CP2A2_WINDOWS_RUNNER_FIX.md`, `CP2B_EXACT_QA_AUTHORIZATION_V3.md`, and `scripts/client-portal/cp2b_qa_package_v3.manifest.json`.

## CP-2B — QA schema, authorization and server APIs

Status: `BLOCKED_PENDING_EXPLICIT_V3_AUTHORIZATION`

Order:

1. reconcile exact QA pre-state and produce unique migration/hash/rollback;
2. local/disposable PostgreSQL proof;
3. create explicit internal staff boundary before any portal identity;
4. create portal tables, constraints, indexes, RLS/FORCE RLS and grants;
5. create narrow RPC/Edge functions and rate limits;
6. create private invoice-documents bucket/registry;
7. create synthetic two-client fixtures;
8. execute catalog and live allow/deny matrix;
9. reconcile zero financial/production changes and exact cleanup;
10. commit/push evidence.

Do not use `db push` or migration repair.

## CP-3 — Portal UI in QA

Status: `NOT STARTED`

- dedicated `/portal` route guard and shell;
- invitation, pending registration, login, recovery, logout, session/security and MFA readiness;
- dashboard, profile, properties, services, requests and invoices;
- layered privacy and versioned terms acceptance;
- accessible StepFlows and explicit states;
- mobile/iPad/desktop visible QA;
- no production release.

## CP-4 — Public website and legal integration

Status: not opened

- establish WordPress source/backup/change workflow;
- add `Área de clientes` link only to canonical portal URL;
- update legal notice, privacy, cookies, portal terms and service conditions;
- add first layers to every WPForms/portal collection point;
- separate marketing/cookie/contract/privacy controls;
- test Complianz prior blocking and actual trackers;
- maintain `pending professional legal approval` until review is recorded.

No website form may auto-create/link a CRM client.

## CP-5 — Production security release

Status: not opened

- independent production authorization;
- exact QA-proven hashes and rollback;
- provider contracts/regions/subprocessors complete;
- invite-only designated pilot;
- negative isolation, document and request proof;
- incident/support runbooks;
- no invoice/payment/numbering writes.

## CP-6 — Final smoke and handoff

Status: not opened

- cross-client isolation and revocation;
- invoice download expiry;
- request-to-review workflow;
- legal links/consent;
- P0/P1 zero;
- operational ROPA, retention, rights and breach handoff;
- final roadmap closeout.

## Dependency order

```text
internal staff trust split
  -> memberships/invitations/applications
  -> narrow portal APIs + audit/rate limit
  -> private document boundary
  -> two-client QA proof
  -> portal UI
  -> WordPress/legal integration
  -> production pilot
```

No downstream gate may run around a failed upstream security boundary.
