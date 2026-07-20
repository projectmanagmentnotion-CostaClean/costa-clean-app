# QA Sandbox Environment Blueprint

## Objective

Provide an isolated, restorable environment where every supported flow can use real submits without changing production data, numbering, authentication, or external financial systems.

## Environment Model

| Surface | Data target | Writes | Purpose |
| --- | --- | --- | --- |
| Production | Production Supabase | Operational users only | Real business operation |
| Local preview with production config | Production Supabase through localhost | Dry-run, or explicitly approved limited cleanup only | Validate the current build without fiscal writes |
| QA sandbox | Separate Supabase QA project or disposable branch | QA-tagged writes under explicit gates | Real submit, relationships, cleanup, and reset |
| Dry-run | Any classified environment | None | UI, validation, navigation, and pre-submit logic |
| Write-and-clean | Classified environment with explicit allow flag | Registry-supported non-fiscal entities | Verify reversible persistence paths |
| Full-flow submit | QA sandbox only | All approved sandbox flows | Validate post-submit data and downstream behavior |

An unknown target always fails closed. A localhost URL is classified as `local-production-config` unless the sandbox wrapper supplies and validates the sandbox fingerprint.

## Supported Sandbox Coverage

The sandbox is intended to cover clients, properties, quotes, expenses, jobs/services, recurring services, draft invoices where supported, sandbox-issued invoices, sandbox payments, and sandbox cancellations. Invoice emission, payment registration, and fiscal cancellation remain unavailable until the sandbox and reset proof exist.

## Production Prohibitions

- Do not issue QA invoices or register QA payments.
- Do not alter `invoice_number`, `display_code`, fiscal series, or sequence state.
- Do not clean QA by ad hoc SQL or delete real records.
- Do not run snapshot restore, branch discard, or numbering reset against production.
- Do not use production auth, schema, RPC, migrations, or financial write paths as a QA reset mechanism.

## Recommended Architecture

1. Provision a separate Supabase QA project or disposable database branch.
2. Apply the reviewed schema, policies, functions, and migrations through the normal controlled delivery path.
3. Configure a dedicated QA user and an ignored `.env.qa.local`.
4. Seed sanitized baseline demo data with no customer payloads.
5. Capture a private baseline manifest and a restorable snapshot before full-flow execution.
6. Route email, payment, fiscal, and other outbound integrations to sandbox endpoints or disable them explicitly.
7. Run the versioned action matrix with a unique `qaRunId` and `QA-AUTO` labels.
8. Restore the snapshot or discard the branch, then prove the datastore matches its baseline.

## Local Variables

Create `.env.qa.local` manually from `.env.qa.example`. Git already ignores `.env.*.local`.

Required public and guard variables:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=qa
QA_SANDBOX_PROJECT_REF=
QA_SANDBOX_RESET_STRATEGY=
```

`QA_SANDBOX_PROJECT_REF` must match the project reference parsed from `VITE_SUPABASE_URL`. `QA_SANDBOX_RESET_STRATEGY` is reserved for `snapshot-restore` or `branch-discard` once restoration is implemented.

## Frontend Secret Boundary

Frontend and browser runners may contain only the public Supabase URL and anon/publishable key. Service-role keys, Supabase secret keys, private tokens, cookies, and credentials are forbidden. Privileged restoration, if later approved, must run in a separate backend/operator boundary and must never be exposed to Vite.

## QA Data Policy

- Every automated run uses a unique `qaRunId` generated with the `QA-AUTO` prefix.
- Human-readable demo values use `QA-AUTO` or stable `QA-DEMO` prefixes.
- Every created ID is recorded immediately in a private report.
- Registry cleanup must affect at least one row; zero rows is a failure.
- A cleanup failure stops the run and triggers full sandbox restore.
- Numbered and financial documents rely on snapshot restore or branch disposal, not soft archive alone.

## Fiscal Policy

QA fiscal numbering must use a sandbox-only series and datastore. QA numbers must never share a sequence, table state, export, or integration with production. Sandbox invoices and payments have no real fiscal or commercial validity and must be visibly labelled as QA.

## Safe Commands

The repository provides wrappers that load `.env.qa.local`, reject privileged keys, validate the Supabase project fingerprint, set `QA_ENV=sandbox`, isolate auth under `.auth/sandbox/`, and never print values:

```text
npm run qa:preview:sandbox
npm run qa:auth:sandbox
npm run qa:visual:sandbox
npm run qa:flow:sandbox:dry
npm run qa:flow:sandbox:write-clean
```

There is deliberately no full-submit command. Its prepared policy requires `QA_ENV=sandbox`, a matching public project fingerprint, both explicit allow flags, a `QA-AUTO` run ID, `registry-and-reset` cleanup, and an approved reset strategy. It remains blocked until sandbox provisioning, baseline capture, reset execution, and post-reset verification are implemented and separately approved.

## Closure Criteria

- Full-flow submit is 100% green in the isolated sandbox.
- Every created entity and downstream relation is verified.
- Snapshot restore or branch discard is exercised successfully.
- Post-reset checks prove zero QA residue and exact numbering/sequence restoration.
- Production remains unchanged and no private artifact is versioned.
