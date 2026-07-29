# Universal Release Log

## 2026-07-29 — Client portal CP-3B.2A.3 V3 failure observability package

- tipo: local security source/proof and QA read-only preparation
- estado: `PREPARED_NOT_AUTHORIZED`
- root cause confirmada: `V2_RUNNER_OBSERVABILITY_DEFECT`
- detonante remoto original: `UNKNOWN_PENDING_V3_EXECUTION`
- corrección: verified private first-failure envelope, full redacted private
  expected/actual, immutable primary snapshot, typed process/parser diagnostics,
  complete policy/ACL boundary, exact ledger pins, one recovery and zero retry
- PostgreSQL 17: rejects injected extra policy and grant-option drift with exact
  expected/actual, then drives the V3 core through real local
  apply/failure/persist/reread/recovery and reapply/second matrix with zero
  audit/rate residue `PASS`
- migración correctiva: none; frozen migration and V1/V2 bytes unchanged
- efectos remotos: QA/production/Auth/Edge/Storage/history/canonical/frontend
  writes `0`
- autorización futura:
  `CP3B2A-QA-V3-AUTHORIZATION-PENDING`
- siguiente estado: V3
  `READY_PENDING_EXPLICIT_V3_AUTHORIZATION`; CP-3B.2 blocked

## 2026-07-29 — Client portal CP-3B.2A.2 blocked failure investigation

- tipo: security investigation and QA execution-package remediation
- entorno: local PostgreSQL 17 + Supabase QA read-only preflight
- migración original:
  `supabase/migrations/20260728160000_portal_reviewed_change_contract.sql`
- SHA-256:
  `4030c67ba82f353cd81345a59fca8ee0c3088affd0869c8d9e744c02f24bb544`
- incidente V2: one apply, one recovery, zero retry; exact prestate restored;
  V2 authorization exhausted
- root cause demostrada: the V2 runner discarded the first post-apply
  exception and retained only a generic recovered error
- corrección: V3 runner diagnostics, typed parser, exact object postcheck,
  historical-safe transactional matrix, exclusive HEAD-bound attempt ledger
  and ambiguous-apply reconciliation
- migración correctiva: none; V1/V2 and original migration unchanged
- proof local: PostgreSQL 17 apply/postcheck, historical rows,
  `PASS_ROLLED_BACK`, rowful rollback blocked, exact recovery, zero residue
- autorización V3: `CP3B2A-QA-V3-AUTHORIZATION-PENDING`
- efectos remotos: QA writes `0`; production/Auth/Edge/Storage/history/
  canonical/frontend/WordPress/SiteGround writes `0`
- blocker: V2 discarded the original SQL/parser/transport trigger; the exact
  assertion/object/expected/actual required by the gate cannot be reconstructed
  without a new remote effect, which this gate prohibits
- independent review: `FAIL`; the draft is not committed or authorizable
- estado: CP-3B.2A.2 `BLOCKED_PENDING_EXACT_TRIGGER_EVIDENCE`; V3 application
  `BLOCKED_NOT_AUTHORIZABLE`; CP-3B.2
  `BLOCKED_PENDING_CP3B2A_QA_V3`; CP-3B.3 `NOT_STARTED`

## 2026-07-29 — Client portal CP-3B.2A.1 QA execution/recovery package

- fecha: 2026-07-29
- proyecto: Costa Clean Client Portal
- tipo: QA application/recovery package; remote reads only
- resumen: freezes exact V2 precheck, postcheck, transactional matrix, guarded
  rollback, runner, disposable proof, tests, immutable manifest and future
  authorization contract for the reviewed-change migration
- validación: V1/CP-3B.0/CP-2B hashes; migration SHA-256; 14 targeted tests;
  PostgreSQL 17 apply/postcheck/matrix/rollback/reapply and simulated-failure
  recovery; direct plan; live QA read-only preflight; private eight-artifact
  backup
- regresión: `431 passed / 4 skipped`; agents 160/160; lint/build pass
- seguridad: exact QA pooler/direct identity, production reject, apply-last
  order, clean authorized HEAD and matching backup required, one apply path,
  zero automatic retries, rollback guard when V2 rows exist
- remoto: QA reads only; QA writes `0`; production writes `0`;
  Auth/Edge/Storage/history/canonical writes `0`; WordPress and SiteGround
  untouched
- estado: CP-3B.2A.1 `DONE`; CP-3B.2A QA application
  `READY_PENDING_EXPLICIT_V2_AUTHORIZATION`; CP-3B.2
  `BLOCKED_PENDING_CP3B2A_QA`; CP-3B.3 `NOT_STARTED`
- evidencia:
  [client-portal/CP3B2A1_QA_EXECUTION_PACKAGE.md](client-portal/CP3B2A1_QA_EXECUTION_PACKAGE.md)

## 2026-07-28 — Client portal CP-3B.2A reviewed change source contract

- fecha: 2026-07-28
- proyecto: Costa Clean Client Portal
- tipo: source-only PostgreSQL security contract and QA read-only preflight
- resumen: adds prepared idempotent profile/property correction contracts,
  persisted opaque receipts and requester-only minimized status lists
- validación: frozen-gap reproduction; PostgreSQL 17 security, payload,
  eligibility, idempotency, concurrency, list, rollback/reapply and zero-residue
  proof; QA read-only catalog preflight; full regression
- seguridad: `auth.uid()` tenancy, verified active membership, archived/deleted
  denial, broad customer table-policy removal and legacy Edge fail-closed grant
  revocation
- remoto: QA/production writes, Auth users, Edge/Storage/history/canonical writes
  `0`; WordPress and SiteGround untouched
- estado: CP-3B.2A `DONE — SOURCE/LOCAL PROOF AND QA READ-ONLY PREFLIGHT`; QA
  application `NOT_AUTHORIZED`; CP-3B.2 `BLOCKED_PENDING_CP3B2A_QA`; CP-3B.3
  `NOT_STARTED`
- evidencia:
  [client-portal/CP3B2A_REVIEWED_CHANGE_CONTRACT.md](client-portal/CP3B2A_REVIEWED_CHANGE_CONTRACT.md)

## 2026-07-28 — Client portal CP-3B.1 authentication lifecycle

- fecha: 2026-07-28
- proyecto: Costa Clean Client Portal
- tipo: local frontend Auth/access lifecycle implementation
- resumen: connects the isolated portal bootstrap to Supabase Auth and the
  parameterless self-access RPC with strict fail-closed DTO validation
- validación: Auth lifecycle and negative-state tests; 12 visible synthetic
  scenarios; required viewport/orientation matrix; reduced motion; source and
  product-bundle boundary scans; full regression
- seguridad: no email/metadata tenancy, browser client-ID trust, direct table
  access, frontend `service_role`, technical error leakage or stale-session
  protected content
- remoto: QA/production writes, Auth users and backend changes `0`; WordPress
  and SiteGround untouched
- regresión: `404 passed / 4 skipped`; agents 160/160; lint/build pass
- limitación: physical Safari iOS, physical keyboard, provider autofill and
  third-party password-manager UI were not executed in the Windows environment
- estado: CP-3B.1 `DONE — local implementation and visible synthetic-runtime
  evidence`; CP-3B.2 `NOT STARTED`
- evidencia:
  [client-portal/CP3B1_AUTH_ACCESS_LIFECYCLE_20260728.md](client-portal/CP3B1_AUTH_ACCESS_LIFECYCLE_20260728.md)

## 2026-07-28 — Client portal CP-3B.0 QA application V2

- fecha: 2026-07-28
- proyecto: Costa Clean Client Portal
- tipo: exact authorized Supabase QA security-boundary application
- resumen: the frozen V2 runner executed once and created only the
  zero-parameter `portal_resolve_self_access_context()` function
- validación: exact Git/target/hash identity; fresh eight-artifact private
  backup; complete pre-effect order; one apply; postcheck; transactional QA
  matrix rolled back; independent catalog/digest/residue reads; full regression
- seguridad: `auth.uid()` self-context; `jsonb`, `STABLE`,
  `SECURITY DEFINER`, owner `postgres`, fixed `search_path=pg_catalog`; execute
  only for `authenticated`; no email or browser-supplied tenancy
- remoto: one QA function created; table rows, policies, table grants, Auth
  users, Edge, Storage and migration history changes `0`; production,
  WordPress and SiteGround untouched
- regresión: `368 passed / 4 skipped`; agents 160/160; lint/build pass
- estado: CP-3B.0/CP-3B.0A/QA application `DONE`; CP-3B.1
  `UNBLOCKED_NOT_STARTED`; CP-3B.2 `NOT STARTED`
- evidencia:
  [client-portal/CP3B0_QA_APPLICATION_20260728.md](client-portal/CP3B0_QA_APPLICATION_20260728.md)

## 2026-07-28 — Client portal CP-3B.0A QA execution/recovery package

- fecha: 2026-07-28
- proyecto: Costa Clean Client Portal
- tipo: QA application preparation, local proof and remote read-only preflight
- resumen: freezes a V2 runner with exact authorization/HEAD/backup gates,
  PostgreSQL V5 transport, complete postcheck, QA-only transactional matrix and
  one-function recovery for a future self-context RPC application
- validación: V1 and CP-2B frozen chains; V2 hashes; PostgreSQL 17 disposable
  apply/postcheck/matrix/rollback/recovery; negative gates; private backup and
  catalog snapshot; live QA read confirms target and absent function
- seguridad: production rejected; no secrets or private paths printed; no real
  users/PII; matrix fixtures roll back; application has no automatic retry
- remoto: QA reads only; QA/production writes, remote Auth users, Edge deploys,
  Storage mutations and migration-history writes `0`; `--execute` not run
- estado: CP-3B.0A `DONE — source/local/preflight only`; QA application
  `READY_PENDING_EXPLICIT_V2_AUTHORIZATION`; CP-3B.1
  `BLOCKED_PENDING_CP3B0_QA`; CP-3B.2 `NOT STARTED`
- evidencia:
  [client-portal/CP3B0A_QA_EXECUTION_PACKAGE.md](client-portal/CP3B0A_QA_EXECUTION_PACKAGE.md)
  and
  [client-portal/CP3B0_EXACT_QA_AUTHORIZATION_V2.md](client-portal/CP3B0_EXACT_QA_AUTHORIZATION_V2.md)

## 2026-07-28 — Client portal CP-3B.0 self access context source contract

- fecha: 2026-07-28
- proyecto: Costa Clean Client Portal
- tipo: source-only PostgreSQL security contract and local disposable proof
- resumen: adds a zero-parameter `auth.uid()` self-context RPC so the future
  portal Auth bootstrap can resolve active, multi-client, pending, suspended,
  revoked and no-access states without email, metadata or a browser-provided
  client identifier
- validación: original block reproduction; PostgreSQL 17.10 synthetic
  authorization matrix; admin/member, cross-user and multi-client cases;
  grants/search-path/security-definer review; rollback/reapply; zero residue;
  full suite, agent validation, lint and build at closeout
- seguridad: minimal active-membership DTO; suspended/revoked identifiers
  hidden; PII returned `0`; no dynamic SQL, writes, audit event, policy or table
  grant change
- remoto: QA writes `0`; production writes `0`; Auth users, Edge deploys,
  Storage mutations and migration-history writes `0`
- estado: CP-3B.0 source/local proof `DONE`; QA application `NOT AUTHORIZED`;
  CP-3B.1 `BLOCKED_PENDING_CP3B0_QA`; CP-3B.2 `NOT STARTED`
- evidencia:
  [client-portal/CP3B0_SELF_ACCESS_CONTEXT_CONTRACT.md](client-portal/CP3B0_SELF_ACCESS_CONTEXT_CONTRACT.md)
  and
  [client-portal/CP3B0_EXACT_QA_AUTHORIZATION.md](client-portal/CP3B0_EXACT_QA_AUTHORIZATION.md)

## 2026-07-28 — Client portal CP-3A isolated UI/Auth boundary

- fecha: 2026-07-28
- proyecto: Costa Clean Client Portal
- tipo: local frontend foundation and trust-boundary implementation
- resumen: splits the application entry into isolated portal/CRM bootstraps and
  adds the `/portal` access state machine, typed read-only boundary, responsive
  shell, base pages and development-only synthetic preview
- validación: 18/18 focused tests; full suite `342 passed / 4 skipped`;
  `qa:agents` 160/160; lint/build; visible mobile/iPad/desktop route, state,
  navigation and overflow checks
- seguridad: no portal Supabase/CRM import, direct canonical access, write
  method, email linkage, real PII, secret or production mock adapter
- remoto: QA writes `0`; production writes `0`; Auth, SQL, migrations, RLS,
  Edge, Storage, WordPress and SiteGround unchanged
- estado: CP-3A `DONE`; CP-3B.1 next and `NOT STARTED`
- evidencia:
  [client-portal/CP3A_PORTAL_UI_FOUNDATION_20260728.md](client-portal/CP3A_PORTAL_UI_FOUNDATION_20260728.md)

## 2026-07-27 — Client portal CP-2B V5 Supabase Cloud QA boundary

- fecha: 2026-07-27
- proyecto: Costa Clean Client Portal
- tipo: authorized QA security-boundary execution and validation
- resumen: executed the exact frozen V5 runner once in QA, established the
  internal-staff/portal tenancy boundary, deployed four narrow Edge Functions
  and retained a private empty invoice-document bucket
- validación: SQL cross-client matrix, HTTP Edge denial matrix, invitation
  security, pending-review service requests, 60-second document contract,
  independent cleanup/catalog/Auth/Storage/Edge reconciliation, full suite
  `324 passed / 4 skipped`, lint and build
- cleanup: ten synthetic Auth users created and deleted; synthetic users,
  fixtures and Storage objects remaining `0`; completed ledger retained
  privately and prior blocked ledger preserved
- datos: active internal staff memberships `1`; portal tables/RLS/FORCE RLS
  `11/11`; financial counts `0/0/0`; public sequences unchanged
- remoto: QA boundary changed as authorized; production, WordPress, SiteGround,
  `/portal` and CP-3 untouched
- deuda: invitation delivery `NOT IMPLEMENTED`; frozen CP-2A.4 proof and three
  authenticated V5 tests remain pre-effect-only and reject the deployed
  poststate
- estado: CP-2B `DONE`; CP-3 `NOT STARTED`
- evidencia:
  [client-portal/CP2B_V5_QA_EXECUTION_20260727.md](client-portal/CP2B_V5_QA_EXECUTION_20260727.md)

## 2026-07-27 — Client portal CP-2A.4 PostgreSQL secret transport

- fecha: 2026-07-27
- proyecto: Costa Clean Client Portal
- tipo: corrective security transport / authenticated read-only QA proof
- resumen: adds a separate V5 PostgreSQL transport that converts the private URL to a minimal `PG*` environment before the launcher boundary and moves live connectivity/staff/prestate ahead of ledger and Auth effects
- validación: V4 failure reproduced before spawn; live QA `SELECT 1`; exact staff UUID; clean portal prestate; production rejection; 36/36 authenticated V5 tests; full regression/lint/build recorded at closeout
- remoto: QA writes `0`; production writes `0`; new ledgers, Auth users, Edge deploys and Storage mutations `0`; WordPress, SiteGround, `/portal` and CP-3 untouched
- datos: secrets/private artifacts versioned `0`; real PII added `0`; prior blocked ledger preserved privately
- estado: CP-0/CP-1/CP-2A/CP-2A.1/CP-2A.2/CP-2A.3/CP-2A.4 `DONE`; CP-2B `BLOCKED_PENDING_EXPLICIT_V5_AUTHORIZATION`; CP-3 `NOT STARTED`
- autorización: V5 is `PREPARED_NOT_AUTHORIZED`; no previous authorization carries forward and no future HEAD is authorized
- evidencia: [client-portal/CP2A4_POSTGRES_SECRET_TRANSPORT_FIX.md](client-portal/CP2A4_POSTGRES_SECRET_TRANSPORT_FIX.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V5.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V5.md)

## 2026-07-27 — Client portal CP-2A.3 bootstrap contract correction

- fecha: 2026-07-27
- proyecto: Costa Clean Client Portal
- tipo: corrective security bootstrap contract / source and local disposable proof
- resumen: adds the separate V4 apply wrapper and runner that bootstrap only the confirmed active staff identity using the migration's exact `(user_id, role)` contract, while preserving all original, V2 and V3 artifacts
- validación: original SQLSTATE `42703` reproduced; 11/11 RLS and FORCE RLS tables; active/suspended staff separation; parameterized matrix; exact cleanup; recovery and zero residue; authenticated CP-2A.2 Windows proof; 291 tests passed and 1 skipped; lint/build passed
- remoto: QA writes `0`; production writes `0`; Auth users, Edge deploys, Storage and SQL mutations `0`; WordPress, SiteGround, `/portal` and CP-3 untouched
- integración: remote base `ddc4581d6aea99a1ebf22ea6349077a08f9dee3f` preserved with its six-file Production Agents pilot; V4 restored without conflicts
- datos: secrets/private artifacts versioned `0`; private blocked incident ledger preserved outside Git; V4 backup intentionally deferred until an exact authorized HEAD exists
- estado: CP-0 `DONE`; CP-1 `DONE`; CP-2A `DONE`; CP-2A.1 `DONE`; CP-2A.2 `DONE`; CP-2A.3 `DONE`; CP-2B `BLOCKED_PENDING_EXPLICIT_V4_AUTHORIZATION`; CP-3 `NOT STARTED`
- autorización: V4 is `PREPARED_NOT_AUTHORIZED`; no V1, V2 or V3 authorization carries forward
- evidencia: [client-portal/CP2A3_BOOTSTRAP_CONTRACT_FIX.md](client-portal/CP2A3_BOOTSTRAP_CONTRACT_FIX.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V4.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V4.md)

## 2026-07-27 — Client portal CP-2A.2 Windows-compatible runner

- fecha: 2026-07-27
- proyecto: Costa Clean Client Portal
- tipo: corrective local launcher / source and read-only proof
- resumen: replaces direct Windows `.cmd` spawning with a direct Supabase JavaScript target, restricted batch compatibility, V3 authorization gate, immutable manifest, tests, and proof
- validación: real Windows `.cmd`; Supabase version and authenticated project list through V3; QA linked; production not linked; injection/timeout/redaction/negative authorization gates; full suite/lint/build recorded at closeout
- remoto: QA writes `0`; production writes `0`; Auth users, Edge deploys, Storage and SQL mutations `0`; WordPress and `/portal` untouched
- datos: real PII added `0`; secrets/private artifacts versioned `0`
- estado: CP-0 `DONE`; CP-1 `DONE`; CP-2A `DONE`; CP-2A.1 `DONE`; CP-2A.2 `DONE`; CP-2B `BLOCKED_PENDING_EXPLICIT_V3_AUTHORIZATION`; CP-3 `NOT STARTED`
- autorización: V3 is `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`; neither V1 nor V2 authorization carries forward
- evidencia: [client-portal/CP2A2_WINDOWS_RUNNER_FIX.md](client-portal/CP2A2_WINDOWS_RUNNER_FIX.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V3.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V3.md)

## 2026-07-27 — Client portal CP-2A.1 QA-compatible execution package

- fecha: 2026-07-27
- proyecto: Costa Clean Client Portal
- tipo: corrective security execution package / source and local disposable proof
- resumen: replaces fixed Auth fixture assumptions with Admin-API-generated UUIDs, exact private ledger, parameterized V2 SQL, exact cleanup, backup/hash gates, Edge denial matrix, and disable-first recovery
- validación: PostgreSQL 17 dynamic Auth/migration/fixtures/matrix/cleanup/recovery/rollback/zero-residue proof; 9/9 specific tests; plan/preflight; lint/build/full suite recorded at closeout
- remoto: QA writes `0`; production writes `0`; remote Auth/Edge/Storage/schema/data changes `0`; WordPress untouched
- datos: only runtime-generated local UUIDs and `example.invalid`; real PII `0`; secrets/private artifacts versioned `0`
- estado: CP-0 `DONE`; CP-1 `DONE`; CP-2A `DONE`; CP-2A.1 `DONE`; CP-2B `BLOCKED_PENDING_EXPLICIT_V2_AUTHORIZATION`; CP-3 `NOT STARTED`
- autorización: V2 is `PREPARED / NOT EXECUTED / AWAITING EXPLICIT AUTHORIZATION`; this commit does not authorize remote execution
- evidencia: [client-portal/CP2A1_QA_EXECUTION_PACKAGE.md](client-portal/CP2A1_QA_EXECUTION_PACKAGE.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION_V2.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION_V2.md)

## 2026-07-23 — Client portal CP-2A immutable QA-preparation package

- fecha: 2026-07-23
- proyecto: Costa Clean Client Portal
- tipo: security source package / local disposable proof
- resumen: explicit staff boundary, portal tenancy, narrow RPC/Edge APIs, private invoice documents, synthetic authorization matrix and disable-first rollback
- validación: PostgreSQL 17.10 apply/matrix/cleanup/rollback/reapply; strict Edge contract tests; lint/build/full test and db-push locks recorded at closeout
- producción/QA/Auth/Storage/Edge: unchanged; remote writes `0`; users created `0`
- datos: synthetic `QA-CP2-` and `@example.invalid` only; real PII `0`; fiscal/financial/sequence changes `0`
- estado: CP-2A `DONE`; CP-2B `NOT AUTHORIZED`; `/portal` UI not implemented
- rollback: exact local script, disable-first and fail-closed; no remote rollback executed
- evidencia: [client-portal/CP2A_IMPLEMENTATION_PACKAGE.md](client-portal/CP2A_IMPLEMENTATION_PACKAGE.md), [client-portal/CP2B_EXACT_QA_AUTHORIZATION.md](client-portal/CP2B_EXACT_QA_AUTHORIZATION.md)

## 2026-07-23 — Client portal CP-0 / CP-1 security and legal design

- fecha: 2026-07-23
- proyecto: Costa Clean Client Portal
- tipo: architecture / security / legal design, documentation only
- resumen: maps the WordPress public website and canonical CRM, defines explicit customer tenancy, invitations/manual approval, deny-by-default portal APIs, private invoice delivery, service-request review, legal/consent content and the exact future QA authorization gate
- commit: commit of this delivery with subject `docs: design secure Costa Clean client portal`; final identifier reported at closeout
- validación: starting commit `b0c1768b2c8d797aab61771c9db63472f31e962e`; source/live read-only audit; 13 required portal documents; cross-document review; lint/build; secret and Git diff review
- producción/QA/schema/Auth/usuarios/storage/datos: unchanged; remote writes `0`; invoice/payment/closing/sequence changes `0`
- riesgo: current any-authenticated canonical policies are P0 for future portal users; no WordPress Git repository was found; legal content remains pending verified facts and professional legal approval
- rollback: revert this documentation commit only; no database, Auth, Storage, WordPress or deployment rollback exists because none was changed
- estado: CP-0 `DONE`; CP-1 `DONE`; CP-2 `NOT AUTHORIZED`
- evidencia: [client-portal/ARCHITECTURE.md](client-portal/ARCHITECTURE.md), [client-portal/QA_AUTHORIZATION_PACKAGE.md](client-portal/QA_AUTHORIZATION_PACKAGE.md), [client-portal/IMPLEMENTATION_ROADMAP.md](client-portal/IMPLEMENTATION_ROADMAP.md)

## 2026-07-23 — Gate 5 production functional smoke and final roadmap close

- fecha: 2026-07-23
- proyecto: Costa Clean CRM
- tipo: P1 Auth correction / production frontend release / roadmap close
- resumen: adds one secure responsive account/logout flow through the existing Supabase client, proves visible logout and human re-login in production, and closes the mandatory roadmap
- commits runtime: `f2ba980e1b10c17a3c4f8441a54890e3839f01d9`, `2d63f6bc1798ff5a2c79347730881b894f790253`
- deployment: Git-triggered Vercel production deployment `dpl_4DDzs7QFgBXEjY1SrANtPUwKVqYb`, `READY`; canonical domain HTTP `200`
- validación: account/menu/Escape/focus; logout; protected-content removal; Back/reload; human login; persistence; ten modules; public quiz isolation; `1440x900`, `768x1024`, `390x844`; lint/build; `239/239` tests; both db-push locks
- producción/QA/datos: Auth session lifecycle only; QA unchanged; business writes `0`; financial/fiscal writes `0`; real-data changes `0`
- estado: Gate 5 `DONE`; roadmap `CLOSED`; production `READY FOR NORMAL OPERATION`; P0/P1 open `0`
- riesgo: single-workspace trust boundary, providerless distributed abuse and migration CLI lock remain documented; optional A/B/C and Turnstile remain deferred
- rollback: revert the runtime commits and redeploy only under a separately reviewed incident action; no database rollback exists because this sprint made no database change
- evidencia: [GATE_5_PRODUCTION_FUNCTIONAL_SMOKE_FINAL_20260723.md](GATE_5_PRODUCTION_FUNCTIONAL_SMOKE_FINAL_20260723.md), [READY_FOR_NORMAL_OPERATION_20260723.md](READY_FOR_NORMAL_OPERATION_20260723.md)

## 2026-07-22 — Gate 4B providerless public quiz protection in QA

- tipo: QA backend/frontend security implementation
- resumen: replaces direct public quiz RPC submission in QA with a public Edge Function, strict shared/server contract, HMAC pseudonymous throttling and a private transactional RPC
- validacion: exact triple QA identity, PostgreSQL 17 disposable proof and transactional apply, active Edge deployment, 12/12 live synthetic matrix, custom-log privacy scan and zero-residue cleanup
- produccion: unchanged; invoices, payments, closings, fiscal numbering/sequences and full-submit untouched
- secretos versionados: 0
- riesgo residual: providerless controls do not prove a human; Gate 4C must independently decide whether production requires Turnstile or another provider
- estado histórico: Gate 4B QA DONE; Gate 4C later passed under separate authorization
- evidencia: [GATE_4B_PROVIDERLESS_QA_EXECUTION_20260722.md](GATE_4B_PROVIDERLESS_QA_EXECUTION_20260722.md)

## 2026-07-22 — Gate 4A public quiz abuse-protection design

- tipo: security design / documentation only
- resumen: audits the anonymous quiz RPC and selects Turnstile Managed + Supabase Edge Function + private transactional RPC with privacy-preserving throttling
- producción/QA/schema/data/code/provider: unchanged
- coste estimado: EUR 0/month inside current free quotas; no paid overage authorized
- estado histórico: Gate 4A DONE; Gate 4B and Gate 4C later passed under separate authorizations
- evidencia: [PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md](PUBLIC_QUIZ_RPC_ABUSE_PROTECTION_AUTHORIZATION_PACKAGE_20260722.md)

## 2026-07-22 - Costa Clean App - production migration metadata repair gate

- tipo: production operational metadata repair
- resumen: registers exactly three canonical migration-history entries in production without executing migration bodies or changing business schema/data
- commit: commit of this delivery; final identifier reported at closeout
- validacion: triple target identity, fresh private rollback, canonical hashes, public fingerprint, 17 table counts, nine sequences, invoice identifiers, authenticated no-submit smoke, lint/build/tests and push locks
- riesgo: legacy history and physical migration filenames remain unresolved; authenticated visual audit is `358/360`; `db push` remains blocked
- rollback: private guarded transaction removes only the gate-created metadata schema after exact-content verification; not executed because the gate passed

Evidence: [PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

## 2026-07-22 - Costa Clean App - production migration metadata authorization package

- tipo: docs / production read-only authorization package
- resumen: validates empty production history and material incremental postconditions, then defines a future metadata-only transaction, exact rollback and explicit authorization boundary
- commit: commit of this delivery; final identifier reported at closeout
- validacion: exact production identity, 17-table inventory, migration sentinels, canonical hashes, schema-only fingerprint, lint/build/tests and intentional npm push locks
- riesgo: legacy history and physical migration filenames remain unresolved; package does not authorize repair and `db push` stays blocked
- rollback: documentation revert only; production and QA received no writes

Evidence: [PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md](PRODUCTION_MIGRATION_METADATA_REPAIR_AUTHORIZATION_PACKAGE_20260722.md).

## 2026-07-22 - Costa Clean App - QA migration metadata repair gate

- tipo: docs / QA operational metadata repair
- resumen: crea en QA oficial el historial compatible con Supabase CLI y registra solo tres incrementales canonicas; baseline excluida, produccion intacta
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validacion: identidad triple QA, hashes remotos, fingerprint `public`, 17 tablas y conteos pre/post; lint/build/tests y locks npm
- riesgo: historia legacy de produccion y baseline dentro del directorio incremental siguen sin resolver; `db push` permanece bloqueado
- rollback: artefacto privado exacto que elimina solo el schema de metadata creado tras guardas estrictas; no ejecutado porque el gate es PASS

Evidencia: [QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md](QA_MIGRATION_METADATA_REPAIR_GATE_20260722.md).

Registro transversal para cambios que adopten el sistema universal. Los proyectos con changelog propio pueden enlazarlo aquí sin duplicar todo su historial.

## Unreleased

### Costa Clean

#### 2026-07-22 - Anonymous Read Policy And Public Exposure Audit

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: read-only security audit
- resumen: confirms ten anon-readable REST tables in both QA and production, including personal, operational, commercial, payment and fiscal data; inventories 12 production and 24 QA non-trigger RPC grants effective for anon
- clasificacion: P0 because personal and financial data are anonymously readable; P1 operational exposure is included in the higher-severity finding
- cambios externos: none; no policy, grant, function, migration or business row was modified
- validacion: exact project-ref guards, read-only catalog introspection, anonymous HTTP HEAD probes, source correlation, lint/build/201 tests
- siguiente gate: coordinated authenticated read path and QA-only anonymous policy/grant closure, followed by separate production authorization
- rollback: documentation-only `git revert`; no database rollback required

Evidence: [ANON_READ_POLICY_AUDIT_20260722.md](ANON_READ_POLICY_AUDIT_20260722.md).

#### 2026-07-22 - Production RLS/RPC Write Path Release

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: production backend security release
- resumen: applies the QA-verified authenticated RPC migration to production and completes a separately authorized, marked, non-financial production smoke for client, property and job writes with immediate cleanup
- commit: documentation commit of this production release; final identifier is reported at close
- validación: preflight lint/build/201 tests, migration hash guard, PostgreSQL 17 transactional apply, post-apply catalog verification, and deployed bundle contract verification
- smoke productivo: `create_client`, `create_property`, `update_property`, `save_job_with_lines`, and `update_job_status` returned `200/200/200/204/200`; persisted state was verified and marker/ID residue is zero
- riesgo: single-workspace authorization and anonymous reads remain; direct `psql` migration-history drift remains blocked from `db push`; the smoke consumed one non-fiscal operational sequence value in each of `CLI/PRO/JOB` and did not reset them
- rollback: separately reviewed production SQL documented in the release evidence; rollback restores the insecure legacy write surface and requires frontend coordination

Evidence: [PRODUCTION_RLS_RELEASE_GATE_20260722.md](PRODUCTION_RLS_RELEASE_GATE_20260722.md).

#### 2026-07-21 - RLS and RPC Write Path Fix

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: backend security / QA migration / frontend write path
- resumen: replaces direct client/property/job-status REST writes with authenticated allowlisted RPCs, closes obsolete anon write policies, and hardens RPC execution grants
- commit: commit of this delivery; final identifier is reported at close
- validación: real QA writes persisted, exact cleanup returned both QA markers to 0, seed remained intact and financial tables stayed `0/0/0`; final app gates are recorded in the evidence
- riesgo: current model is single-workspace and anon reads remain a separate privacy concern; production migration is a separate authorized gate
- rollback: revert repository commit; QA schema rollback requires separately reviewed SQL and would restore the legacy insecure surface

Evidence: [RLS_WRITE_PATH_FIX_20260721.md](RLS_WRITE_PATH_FIX_20260721.md).

#### 2026-07-21 - QA Authenticated RLS Write Verification

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: QA / authenticated write hardening
- resumen: verifica writes reales con `session.access_token` en el proyecto QA; confirma RPC de reasignación y alta de servicio, detecta RLS bloqueando writes REST directos y evita falsos éxitos HTTP 200 con cero filas
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: marker temporal limpiado a 0, seed demo intacto, tablas financieras `0/0/0`; gates finales registrados en la evidencia
- riesgo: los INSERT/PATCH directos requieren revisión de policies en un sprint autorizado separado
- rollback: `git revert <commit-de-esta-entrega>`; no requiere cleanup adicional

Evidencia: [QA_AUTH_RLS_WRITE_VERIFICATION_20260721.md](QA_AUTH_RLS_WRITE_VERIFICATION_20260721.md).

#### 2026-07-21 - P1 Authenticated Property and Service Writes

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: functional / backend security patch
- resumen: sustituye el bearer anonimo de los REST writes directos de propiedades y estado de servicios por `session.access_token`, bloqueando el guardado sin sesion y preservando errores 401/403
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validacion: lint/build, `183/183` tests, sandbox check y QA visual `360/360`; dry-run sin writes `587/588` con un check intermitente distinto en cada rerun
- riesgo: acotado a headers y errores de writes no financieros; payloads, rutas y contratos permanecen intactos
- rollback: `git revert <commit-de-esta-entrega>` y repetir gates completos

Evidencia: [P1_AUTH_WRITE_PATH_HARDENING_20260721.md](P1_AUTH_WRITE_PATH_HARDENING_20260721.md).

#### 2026-07-21 — Full App Production Audit and Correction Pass

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: audit / patch
- resumen: audita arquitectura, módulos, UX/UI, responsive, accesibilidad, clientes API/Supabase y QA; corrige identidad del target QA y primer paso del servicio contextual
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: lint/build y 177 tests, QA visual sandbox `360/360` y dry-run sandbox `588/588`, con 0 entidades creadas
- riesgo: bajo en cambios aplicados; writes autenticados directos y optimización de assets quedan como sprints separados
- rollback: `git revert <commit-de-esta-entrega>` y repetir gates completos

Evidencia: [FULL_APP_AUDIT_20260721.md](FULL_APP_AUDIT_20260721.md) y [FULL_APP_AUDIT_FIXES_20260721.md](FULL_APP_AUDIT_FIXES_20260721.md).

#### 2026-07-21 — Universal Product Correction and Release System

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: docs / patch
- resumen: incorpora metodología universal de corrección, UX/UI, releases, riesgos, protocolo Codex y plantillas reutilizables
- commit: commit de documentación de esta entrega; el identificador final se informa en el cierre
- validación: `npm run lint`, `npm run build` y `npm run test`
- riesgo: bajo; cambios limitados a documentación
- rollback: `git revert <commit-de-esta-entrega>` y volver a ejecutar los gates documentales

#### 2026-07-22 — QA P0 Authenticated Read And Anonymous Closure

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: security / QA schema and frontend patch
- resumen: exige sesión real en lecturas internas, bloquea historial público del quiz y cierra SELECT/write policies y RPC grants anónimos sensibles solo en QA
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: anon REST `200 -> 401` en 10/10, authenticated REST `200` en 10/10, QA visual `360/360`, dry-run `587/588` sin writes
- riesgo: producción conserva el P0 hasta autorización separada; lectura autenticada sigue el modelo single-workspace
- rollback: revert de código; rollback SQL QA separado y explícitamente security-regressive

Evidencia: [P0_AUTHENTICATED_READ_PATH_CLOSURE_20260722.md](P0_AUTHENTICATED_READ_PATH_CLOSURE_20260722.md).

#### 2026-07-22 — Production P0 Anonymous Read Closure

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: security / production database release
- resumen: aplica en producción la migración exacta validada en QA, cierra lecturas y writes legacy anon, restringe RPC sensibles y preserva auth y el envío público validado del quiz
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: backup schema-only previo; anon REST `200 -> 401` en 10/10; authenticated REST `200` en 10/10; RPC anon `6 -> 0`; smoke visual `360/360`; cero writes de negocio
- riesgo: modelo single-workspace, historial de migraciones pendiente de reconciliar y rate limiting del quiz público
- rollback: inversa transaccional basada en el schema/reportes previos; reabre P0 y requiere autorización separada de incidente

Evidencia: [PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md](PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md).

#### 2026-07-22 — Supabase Migration History Reconciliation Audit

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: audit / operational guardrail
- resumen: inventaría cuatro migraciones y confirma mediante lectura remota que QA y producción tienen cero historial registrado; añade bloqueo npm/documental de `db push`
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: introspección `READ ONLY`, hashes SHA-256, fingerprints live y gates de repositorio; cero writes remotos
- riesgo: colisión de versión `20260721`, baseline QA-only mezclada con incrementales y ausencia total de metadata remota
- rollback: revertir docs/script/package; no existe rollback DB porque no se modificó ninguna base

Evidencia: [SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md](SUPABASE_MIGRATION_HISTORY_RECONCILIATION_20260722.md).

#### 2026-07-22 — Migration Manifest And Disposable Repair Proof Gate

- fecha: 2026-07-22
- proyecto: Costa Clean CRM
- tipo: docs / operational safety gate
- resumen: define aliases lógicos únicos, clasifica la baseline QA como `never-push`, conserva los archivos sin rename y documenta un repair futuro sin ejecutarlo
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: hashes SHA-256, lint/build/tests y locks npm; proof desechable `NO` porque solo existen refs de QA oficial y producción
- riesgo: bootstrap ejecutable y metadata repair siguen sin probar; `db push` continúa bloqueado
- rollback: revertir este commit documental; no existe rollback DB porque QA, producción, schema, datos e historial no se modificaron

Evidencia: [SUPABASE_MIGRATION_MANIFEST_20260722.md](SUPABASE_MIGRATION_MANIFEST_20260722.md), [SUPABASE_MIGRATION_REPAIR_PLAN_20260722.md](SUPABASE_MIGRATION_REPAIR_PLAN_20260722.md) y [SUPABASE_DISPOSABLE_REPAIR_PROOF_20260722.md](SUPABASE_DISPOSABLE_REPAIR_PROOF_20260722.md).

#### 2026-07-23 — Gate 4C Public Quiz Production Protection

- fecha: 2026-07-23
- proyecto: Costa Clean CRM
- tipo: security / production release completion
- resumen: cierra Gate 4C verificando read-only la migración, pepper, Edge y frontend ya publicados; ejecuta la matriz productiva de 12 casos y limpia exactamente el intento y los guards sintéticos
- commit: commit de esta entrega con asunto `security: release public quiz protection to production`; el identificador final se informa en el cierre
- validación: Edge `ACTIVE` versión 1, dominio `200`, preflight `204`, matriz `12/12`, scoring autoritativo reconciliado, logs `0` violaciones, cleanup `1/2`, seis intentos reales intactos, tests específicos `28/28`, suite `236/236`, lint/build y ambos locks
- riesgo: el endpoint público conserva una protección providerless dependiente de límites HMAC por fingerprint; cualquier rollback de base reabre el RPC legacy y es security-regressive
- rollback: artefactos privados preparados para DB/Edge/secret/Vercel; requieren autorización de incidente, y el rollback de repositorio usa `git revert` seguido del release controlado

Evidencia: [GATE_4C_PUBLIC_QUIZ_PRODUCTION_RELEASE_20260723.md](GATE_4C_PUBLIC_QUIZ_PRODUCTION_RELEASE_20260723.md).

### Ridaos Print

Sin entradas.

### Webs / Landings

Sin entradas.

### Otros proyectos

Sin entradas.

## Formato de nuevas entradas

Cada entrada debe incluir:

- fecha
- proyecto
- tipo
- resumen
- commit
- validación
- riesgo
- rollback

No se registra como publicado un cambio que solo esté validado en fuente local. Los bloqueos o validaciones parciales se describen explícitamente.
