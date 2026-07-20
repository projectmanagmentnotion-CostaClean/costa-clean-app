# End-User QA Agent Design

## What It Is

The End-User QA Agent is a local authenticated QA runner that exercises the app like a real signed-in operator while staying in dry-run mode by default.

It reuses the existing CDP harness and authenticated QA profile:

- `scripts/qa/auth/cdpHarness.mjs`
- `scripts/qa/setup-auth-state.mjs`
- `scripts/qa/run-authenticated-visual-qa.mjs`
- `scripts/qa/run-end-user-flow-agent.mjs`

## Problem It Solves

The existing authenticated visual QA baseline proves that key views load and remain visually stable, but it does not cover focused user-flow openings and safe cancellations across the main creation surfaces.

The End-User QA Agent adds that layer without creating trash data.

## How It Tests The App

The agent launches a local authenticated browser profile, opens the app on:

- `http://127.0.0.1:4173/`
- fallback `http://127.0.0.1:5173/`

It then validates:

- view readiness
- shell visibility
- header visibility
- bottom nav visibility on mobile
- no browser error page
- no error boundary
- no horizontal overflow
- expected open button presence
- action-to-form response
- visible title
- first actionable field visibility
- safe cancel / close return to the parent context

By default it uses the local authenticated app URL, but a blocked local setup can be redirected temporarily with `QA_APP_URL` when the local environment is not ready.

## Covered Flows

- `?view=invoices`
- `?view=clients`
- `?view=properties`
- `?view=quotes`
- `?view=expenses`
- `?view=payments`
- `?view=jobs`
- `?view=fiscal_closing`

The invoice flow also attempts the embedded property subflow when it can reach it safely inside the same dry-run session.

## Modes

The default mode remains:

- `QA_AGENT_MODE=dry-run`
- `npm run qa:flow:agent`

An explicit guarded mode now also exists:

- `QA_AGENT_MODE=write-and-clean`
- `npm run qa:flow:agent -- --mode=write-and-clean`

`write-and-clean` is not a free-write mode. It is limited to flows with:

- deterministic QA markers via `qaRunId`
- post-create lookup by marker
- explicit cleanup payload in `scripts/qa/qaCleanupRegistry.mjs`
- private cleanup artifacts under `qa-reports/private/`

If a flow does not have a registered cleanup path, it stays dry-run only and is reported as `cleanup-not-available`.

## Dry-Run Meaning

Dry-run means:

- forms may open
- safe fields may receive dummy input
- selectors may be focused
- internal non-persistent step navigation may be used
- final submit actions are never executed

If `QA_AGENT_MODE` is missing, the agent still runs as `dry-run`.

If `QA_AGENT_MODE` is set to any unsupported value, the agent aborts.

## Prohibited Actions

The agent does not execute final or destructive actions such as:

- save
- create
- emit
- confirm final writes
- delete
- cancel invoices
- mark invoices collected in bulk

If a candidate action looks dangerous, it is skipped and recorded as `skipped-dangerous-action`.

## How It Avoids Trash Data

The central rule is unchanged:

The agent can open forms, write fields, and verify the experience, but it cannot execute a final submit or create/modify real records.

Practical guardrails:

- dry-run only
- dangerous label denylist
- safe opening / navigation allowlist
- cancel-before-save behavior
- private screenshots and private reports only

## How It Cancels Before Save

The harness tries only safe exit actions:

- `Cancelar`
- `Cerrar`
- `Volver`
- `Atras` / `Atrás`
- `Cerrar formulario`
- `Cerrar alta`

If it cannot prove that the next action is safe, it stops and records the skip.

## Reports

The agent writes private artifacts only:

- `qa-reports/private/end-user-flow-agent-latest.md`
- `qa-reports/private/end-user-flow-agent-latest.json`
- `qa-reports/private/qa-cleanup-latest.md`
- `qa-reports/private/qa-cleanup-latest.json`
- `qa-reports/private/qa-created-entities-latest.json`
- `qa-screenshots/private/`

These artifacts stay unversioned.

## Private Git-Ignored Routes And Artifacts

Ignored local paths include:

- `.auth/`
- `.auth/*.json`
- `playwright/.auth/`
- `test-results/auth/`
- `qa-screenshots/private/`
- `qa-reports/private/`
- `*.storage-state.json`
- `*storageState*.json`
- `*qa-browser-profile*`

## How To Run It

1. Start the local app on `127.0.0.1:4173` or `127.0.0.1:5173`
2. Ensure the authenticated QA profile exists:
   `npm run qa:auth:setup`
3. Run the agent:
   `npm run qa:flow:agent`
4. For guarded real-write verification only when cleanup is available:
   `QA_ALLOW_WRITE_CLEAN=1`
   `npm run qa:flow:agent -- --mode=write-and-clean`

## Difference Between `qa:visual:auth` And `qa:flow:agent`

- `qa:visual:auth` checks authenticated views and selected create-flow openings at the visual baseline level.
- `qa:flow:agent` behaves more like an end user moving through opening, first interaction, nested subflow attempt, and cancel/return behavior.

## Current Write-And-Clean Scope

As of `2026-07-18`, the write-enabled subset is intentionally narrow:

- `client-create`
- `property-create`
- `quote-create`
- `expense-create`

These runs remain visible in the browser by default and generate cleanup reports. They do not authorize invoice emission, payment creation, fiscal closing writes, auth changes, route changes, schema changes, or untracked private artifact commits.

## Why Dry-Run Is The Default

This app contains sensitive operational, financial, numbering, and fiscal flows.

A QA runner that silently writes real data would be unsafe by default.

Dry-run keeps UX verification fast, repeatable, and private while preserving real business data.

## Current-Build Validation Note - 2026-07-19

- `QA_APP_URL` is an execution override and must take precedence over the URL stored in QA auth metadata.
- A startup error surface is not an authenticated shell, even if shared branding or navigation words are present.
- Local current-build validation remains blocked until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are available outside version control.
- Production remains useful for authenticated live diagnosis, but it cannot validate a local fix until that build is deployed.
- Evidence and remaining steps are recorded in `docs/END_USER_QA_AGENT_DRY_RUN_FIXES_20260718.md`.
- Controlled submit pilots can limit scope with comma-separated `QA_VIEWPORT_IDS` and `QA_FLOW_IDS`; omitted filters preserve full coverage.

## Live Submit Evidence - 2026-07-19

- Visible `write-and-clean` runs created and cleaned `3` clients, `3` properties, and `1` desktop quote.
- Mobile and tablet quote creation exposed an inaccessible/unreliable advance CTA at the property step; no quote was created in those failed attempts.
- Expense submit returned to the module without an unambiguous persisted QA entity, so broader expense writes remain blocked.
- Invoice, payment, job, and fiscal writes remain prohibited until an explicit deterministic cleanup contract exists.

## Real Submit Failure Hardening - 2026-07-19

- Quote navigation now exposes stable property-step/select/option/next markers and uses one internal StepFlow footer; the outer overlay no longer hides the operational CTA on mobile/tablet.
- Expense creation preserves the returned row id, records it before cleanup can start, shows a persistent success state, and refreshes once instead of closing through a double-refresh path.
- The runner prefers the visible exact entity id over a database fingerprint fallback.
- Write-and-clean restrictions are enforced centrally. Invoice, payment, job, and fiscal flows cannot bypass policy through custom runners.
- A zero-row cleanup response is a cleanup failure, not a successful cleanup.
- Source fixes require validation on a deployed/current authenticated build before quote and expense can be declared live-green.

## Service Scheduling Coverage - 2026-07-20

- `job-create` sigue validando apertura, primer campo y cancelacion desde Jobs.
- `service-from-client` y `service-from-property` abren un registro real de lectura, conservan el parametro contextual y cancelan hacia el workspace de origen.
- `recurring-section` no simula persistencia inexistente: verifica la explicacion visible y registra `service-recurring-contract-unavailable`.
- La cobertura completa sube de `435` a `588` checks en `390x844`, `768x1024` y `1366x900`.
- `qa:visual:auth` usa `QA_APP_URL` como URL efectiva para lanzamiento, navegacion y reporte, igual que el flow agent.
