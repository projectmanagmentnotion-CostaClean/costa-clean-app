# Production Deploy QA - 2026-07-19

## Scope

Authorized target: deploy the current application build and run visible authenticated production QA without changing Supabase schema, SQL, RPC, migrations, production auth, fiscal numbering, calculations, or financial write paths.

## Initial State

- Branch: `main`
- Initial HEAD: `a0fe487711188703892f1b6d91a983f2616a29ed`
- Commit: `a0fe487 qa: add continuation agent and fix write-clean flows`
- `git pull origin main`: already up to date
- Worktree before validation: clean and synchronized with `origin/main`

## Pre-deploy Validation

- `npm run lint`: OK
- `npm run build`: OK
- `npm run test`: OK, `34` files and `153/153` tests
- Generated application build: `dist/`

## Documented Deploy Flow

The repository documents Vercel as the production platform, `main` as the production branch, `dist/` as the published output, and `https://app.costacleanbcn.com/` as the production domain. The project does not define a deploy script in `package.json`.

The local environment did not have a Vercel CLI command in `PATH` and the repository had no `.vercel/project.json` link. A temporary `vercel@latest whoami` attempt produced no authenticated identity and timed out after 124 seconds. No direct deployment command was run and no project was linked automatically.

The first documentation commit for this validation was pushed to `main` as `a1188ca`. That authorized push activated the documented Vercel Git integration and published the current application source automatically.

## Live Production Evidence

The authenticated in-app browser remained visible on:

`https://app.costacleanbcn.com/?view=dashboard&debugBuild=1`

Before the push, the build badge reported:

- commit: `41c43c4`
- version: `2026-07-16-41c43c4`

After `a1188ca` reached `origin/main`, the same visible authenticated page was reloaded and reported:

- commit: `a1188ca`
- version: `2026-07-19-a1188ca`

`a1188ca` contains the complete `a0fe487` application build plus this deployment report. Production was therefore confirmed on the current authorized source without a manual CLI deployment.

## QA Results

- `qa:visual:auth`: `360/360` checks passed
- end-user flow dry-run: `435/435` checks passed
- viewports: `390x844`, `768x1024`, and `1366x900`
- quote-create mobile/tablet/desktop: passed
- expense-create mobile/tablet/desktop: passed
- invoice-create mobile/tablet/desktop: passed
- invoice-create reached the direct-invoice route, billing fields, client selector, embedded property flow, safe cancellation, and return to the invoice context
- no final submit was executed in dry-run
- dry-run created entities: `0`

The first dry-run exposed false negatives in the local CDP harness for nested StepFlow titles, visible fields, scrolling, nested cancellation, and asynchronous opening actions. The harness was hardened without changing product components, routes, persistence, invoice logic, or financial writes. The final consolidated rerun passed all checks.

## Write-and-clean Result

The optional guarded pass ran with `QA_ALLOW_WRITE_CLEAN=1` and produced `228/228` policy checks with `0` failed checks. It did not perform any real submit because the local runner could not load the public Supabase environment required for deterministic cleanup.

- client, property, quote, and expense: `cleanup-not-available: missing-supabase-public-env`
- invoice: `invoice-write-not-safe`
- payment: `payment-write-not-safe`
- job: `cleanup-not-available`
- fiscal closing: `fiscal-write-not-safe`
- entities created: `0`
- cleanup failures: `0`
- known residue created by this block: `0`

This result validates the safety gates but does not validate real submit-and-clean behavior for the four allowed entity types. That gate remains blocked until the runner is supplied the existing public Supabase configuration through an ignored local environment, without exposing or versioning it.

## Safety Outcome

- Supabase schema, SQL, RPC, migrations, production auth, routes, financial write APIs, numbering, fiscal behavior, and calculations were not changed.
- invoices issued by this block: `0`
- real payments recorded by this block: `0`
- real financial writes: `0`
- production data deleted: `0`

## Private Artifacts

Existing ignored continuation-agent evidence remains under `.project-agent/private/`. Visual and flow QA reports remain under `qa-reports/private/`; screenshots remain under `qa-screenshots/private/`. No `.auth/`, `.env.local`, cookies, tokens, storage state, QA browser profiles, private reports, or private screenshots were added to Git.

## Remaining Gate

Production is current and the authenticated visual and dry-run gates are green. The remaining blocker is real submit-and-clean evidence for client, property, quote, and expense with deterministic cleanup; invoice, payment, job, and fiscal writes remain intentionally prohibited or unavailable.
