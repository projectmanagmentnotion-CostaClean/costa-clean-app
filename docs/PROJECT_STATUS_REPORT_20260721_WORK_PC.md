# Costa Clean CRM - Project Status Report (Work PC)

Date: `2026-07-21`
Environment: work PC
Repository: `C:\Users\USUARIO\costa-clean-app`

## Executive Summary

The work PC was synchronized with `origin/main` through a non-destructive fast-forward. The synchronized application state is `a42bad7c650d98d5366472c59bea0bf6e71c2123`, which includes the QA sandbox blueprint and the completed recurring service operations UX sprint. The local technical baseline is green: lint and build pass, and `170/170` tests pass across 37 test files.

No deployment, authenticated visual run, write-and-clean run, full-submit run, production write, schema change, fiscal action, or real-data mutation was performed in this work block.

## 1. Git State

| Item | Result |
| --- | --- |
| Machine | Work PC |
| Repository path | `C:\Users\USUARIO\costa-clean-app` |
| Branch | `main` |
| Initial HEAD | `41c43c49a9fc9666cd7e6a2e21122f07ffba18f3` |
| HEAD after synchronization | `a42bad7c650d98d5366472c59bea0bf6e71c2123` |
| `origin/main` after synchronization | `a42bad7c650d98d5366472c59bea0bf6e71c2123` |
| Synchronization method | `git fetch origin`, `git checkout main`, `git pull --ff-only origin main` |
| Local changes before sync | None |
| Stash created by this block | No |
| Existing stash preserved | `stash@{0}: On main: temp-before-rebase-vercel` |
| Worktree after sync | Clean and aligned with `origin/main` |

The pull advanced the work PC by eight commits without reset, overwrite, rebase, force push, or loss of local work.

## 2. Local Technical Validation

Executed against the synchronized source before this report was created:

| Gate | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run build` | Passed; Vite transformed 372 modules |
| `npm run test` | Passed |
| Test result | `170/170` tests across 37 test files |

`node_modules` was already present and `package-lock.json` did not change in the synchronized commits, so dependencies were not reinstalled.

This validation is a local code/build/test result. Authenticated visual QA and end-user browser flows were not rerun in this block, so the live results below are cited from the versioned project evidence rather than presented as a new run.

## 3. Production Status

The latest versioned production validation is documented in `docs/PRODUCTION_DEPLOY_QA_20260719.md`:

- Vercel's Git integration published the authorized `main` source after commit `a1188ca`.
- The visible production build badge reported commit `a1188ca` and version `2026-07-19-a1188ca`.
- Authenticated production visual QA passed `360/360` checks.
- The production end-user dry-run passed `435/435` checks at `390x844`, `768x1024`, and `1366x900`.
- `quote-create`, `expense-create`, and `invoice-create` passed in mobile, tablet, and desktop dry-run coverage.
- Invoice-create reached the direct-invoice route, billing fields, client selection, embedded property flow, safe cancellation, and return to invoice context.
- No final submit was executed by the production dry-run and it created zero entities.

The current repository HEAD is newer than the versioned production build evidence. Commit `a42bad7` documents a later local/current-build recurring-operations validation of visual QA `360/360` and end-user flow coverage `588/588`, but this work block did not deploy or independently revalidate production at that commit.

## 4. End-User Flow Agent

The in-app flow agent is implemented by `scripts/qa/run-end-user-flow-agent.mjs` with shared policy in `scripts/qa/endUserFlowAgentCore.mjs` and cleanup registration in `scripts/qa/qaCleanupRegistry.mjs`.

### What it does

- Reuses an authenticated local browser profile through the CDP harness.
- Audits mobile `390x844`, tablet `768x1024`, and desktop `1366x900`.
- Covers invoice, client, property, quote, expense, payment, job, contextual service from client, contextual service from property, recurring-service status, and fiscal closing flows.
- Checks shell readiness, browser/error boundaries, page header, mobile navigation, horizontal overflow, opening action, focused form visibility, first actionable field, context preservation, cancellation, and safe return.
- Writes reports and screenshots only to ignored private paths.

### Dry-run mode

Dry-run is the default. It may open forms, enter dummy values, move through non-persistent steps, inspect embedded flows, and cancel. It does not execute final submit actions. Dangerous actions are skipped and recorded explicitly.

The latest recurring-operations evidence at `a42bad7` reports 11 flows, `588/588` checks, three explicit policy skips, and zero created entities. This is existing project evidence, not a new browser run from this PC block.

### Write-and-clean mode

Write-and-clean is an explicit, guarded mode. Its registry currently supports only:

- client creation
- property creation
- quote creation
- expense creation

Each allowed flow must use a unique `QA-AUTO`/`qaRunId`, identify the exact created row, register it before cleanup, and produce a cleanup result affecting at least one row. A zero-row cleanup is a failure. Invoice, payment, job/service, and fiscal writes remain blocked or skipped by policy.

### Current limits

- It depends on a valid authenticated profile and the intended `QA_APP_URL`.
- Local write-and-clean needs the public Supabase URL and anon key in an ignored local environment.
- A localhost build is not proof of isolation; the Supabase project fingerprint must be classified.
- It cannot safely validate fiscal numbering, invoices, payments, cancellations, or full relationship chains without a disposable/restorable sandbox.
- Real service recurrence remains unavailable because the repository has no service-recurrence persistence contract; the runner records `service-recurring-contract-unavailable` instead of simulating success.

## 5. Project Continuation Agent

The Project Continuation Agent audits a completed sprint report against repository evidence and generates the next bounded prompt. Its main entry point is `scripts/ops/run-project-continuation-agent.mjs`; its repository skill contract is `.agents/skills/project-continuation-agent/SKILL.md`.

### Activation

- Review and next-prompt generation: `npm run agent:continue -- --input <report-file>`.
- Automatic bounded execution additionally requires `PROJECT_CONTINUATION_ALLOW_EXEC=1`, `--execute`, and a maximum iteration count.

### Why it blocks gates

- Sprint output is treated as untrusted evidence.
- Material claims are classified as verified, unsupported, contradicted, or not applicable.
- Review runs are read-only; execution uses workspace-write without sandbox or approval bypass.
- The loop stops on `complete`, `blocked`, `stop`, suspected secrets, unsafe prompt content, Codex failure, fresh approval needs, or the iteration limit.
- It cannot authorize commits, pushes, deploys, production writes, schema/auth/fiscal mutations, invoices, payments, or external messages.

### Current state and latest blockers

The agent and its tests are present and the repository test suite is green. The recent project evidence correctly blocked progress when the current build or public local Supabase configuration was unavailable, and later kept full-submit blocked because an isolated/restorable Supabase QA target, baseline, and reset proof do not yet exist. This block did not run the agent with `--execute`.

## 6. Write-And-Clean Status

Historical evidence shows a controlled pilot successfully created and cleaned three clients and three properties across the three viewports; an earlier desktop quote was also created and cleaned. Later source fixes made quote CTA geometry and expense entity-ID confirmation traceable. Production visual and dry-run gates subsequently became green on a current deployed build.

The most recent local authenticated validation documented `435/435` dry-run checks and zero writes. Write-and-clean was deliberately not executed because the configured target was not proven to be a disposable QA environment.

Allowed only under the current narrow cleanup registry:

- client
- property
- quote
- expense

Blocked or unavailable:

- invoice issue/create writes
- payment/cobro writes
- fiscal actions and cancellations
- job/service writes without an approved cleanup contract
- numbering reset or restoration through application writes

Fiscal submits must not be tested in production because archiving or deleting a QA row cannot rewind consumed document sequences, restore fiscal traceability, remove every relation/side effect, or guarantee concurrency safety. Exact restoration requires a sandbox snapshot restore or disposable branch discard.

## 7. QA Sandbox

The repository now contains a complete versioned design layer for the sandbox:

- environment blueprint
- synthetic seed-data plan
- total reset plan
- phased full-flow roadmap
- `.env.qa.example`
- environment classification and fingerprint guardrails
- sandbox command wrappers

The wrappers require `VITE_APP_ENV=qa`, a public Supabase project URL/key, and a `QA_SANDBOX_PROJECT_REF` matching the URL fingerprint. They reject service-role/secret keys, isolate authentication under `.auth/sandbox/`, require explicit write flags, and fail closed for unknown targets.

Full-submit is intentionally not implemented. Its future gate requires a disposable/restorable Supabase QA project or branch, a dedicated QA user, sanitized seed data, a baseline manifest, sandbox-only integrations and numbering, a unique `QA-AUTO` run ID, registry-and-reset cleanup, and either snapshot restore or branch discard with exact post-reset verification.

Current blocker: the isolated/restorable Supabase QA target has not been provisioned and the private `.env.qa.local` has not been created. No credentials should be pasted into chat or committed.

## 8. Roadmap Status

### Closed

- Governance and UX transformation baseline, Sprints 0-14.
- Motion foundation and product adoption phases.
- Mobile-first reset, cross-module de-nesting, mobile loading polish, and authenticated QA harness recovery.
- Embedded property-create synchronization and duplicate guard.
- Production deploy validation, authenticated visual QA, and production dry-run evidence.
- End-user flow agent foundation and safety hardening.
- QA sandbox blueprint, seed plan, reset plan, wrappers, and guardrails.
- Recurring Operations and Service Scheduling UX sprint at `a42bad7`: compact upcoming agenda, operational states, contextual service-flow coverage, and honest recurrence-policy skip.

### In progress or externally blocked

- Provisioning the actual disposable/restorable Supabase QA environment.
- Implementing and validating seed, baseline, reset execution, and post-reset comparison after provisioning.
- Full sandbox submit coverage, including fiscal/financial paths, only after all environment gates pass.
- A real service-recurrence domain contract and persistence model; current UI correctly marks it unavailable.
- Separate sensitive technical debt around invoice correction, RLS/RPC, numbering, and production policies remains outside this block.

### Recommended next step

Provision the isolated/restorable Supabase QA project or disposable branch, choose sandbox integrations and the reset mechanism, and create the ignored `.env.qa.local` locally. This is now the highest-leverage blocker because the Recurring Operations and Service Scheduling sprint is already complete.

## 9. Safety Record

For this work-PC sync and report block:

| Safety measure | Result |
| --- | --- |
| Real invoices issued | 0 |
| Real payments/cobros recorded | 0 |
| Financial writes | 0 |
| Known QA residue created | 0 |
| Real data created or deleted | 0 |
| Deploys executed | 0 |
| Write-and-clean runs | 0 |
| Full-submit runs | 0 |
| Secrets added to version control | 0 |

No Supabase schema, SQL, RPC, migration, production auth, `financialWriteApi`, `invoice_number`, `display_code`, fiscal numbering, route, or business write path was changed.

## 10. Recommended Next Sprint

Recommended: **Isolated Supabase QA Provisioning and Restore Proof**.

Target outcome:

1. Manually provision a dedicated Supabase QA project or disposable database branch.
2. Select and document sandbox-only outbound integrations.
3. Configure the ignored `.env.qa.local` without exposing values.
4. Validate environment fingerprinting and authenticated sandbox dry-run.
5. Implement deterministic synthetic seed and baseline capture.
6. Exercise provider snapshot restore or branch discard.
7. Prove zero QA residue and exact baseline/numbering restoration before enabling any full-submit command.

The separate real service-recurrence contract can follow as its own product/data sprint after its schema, API, cleanup, and sandbox behavior are explicitly approved.

## 11. Useful Commands

```powershell
npm run lint
npm run build
npm run test
npm run qa:visual:auth
node scripts/qa/run-end-user-flow-agent.mjs --mode=dry-run
npm run agent:continue -- --input <report-file> --execute --max-iterations 3
```

The final command is intentionally execution-capable and must only be used after setting the explicit launch gate and reviewing its bounded input. It was not executed in this work block.
