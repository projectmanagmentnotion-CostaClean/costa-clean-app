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

The local environment did not have a Vercel CLI command in `PATH` and the repository had no `.vercel/project.json` link. A temporary `vercel@latest whoami` attempt produced no authenticated identity and timed out after 124 seconds. No deployment command was run and no project was linked automatically.

## Live Production Evidence

The authenticated in-app browser remained visible on:

`https://app.costacleanbcn.com/?view=dashboard&debugBuild=1`

The build badge reported:

- commit: `41c43c4`
- version: `2026-07-16-41c43c4`

Production therefore did not serve the authorized HEAD `a0fe487` at the time of this check.

## Manual External Action Required

An authorized operator with access to the existing Vercel team must run the documented Vercel flow from the repository root:

```powershell
npm install --global vercel
vercel login
vercel link --project costa-clean-app
vercel project inspect costa-clean-app
vercel deploy --prod
```

During `vercel link`, the operator must select the existing CostaClean scope and existing `costa-clean-app` project. They must not create a new project or alter environment variables. `.vercel/` is already ignored by Git.

After deployment, the operator must verify that the deployment completed successfully and then open:

`https://app.costacleanbcn.com/?view=dashboard&debugBuild=1`

The build badge must report `a0fe487` before production QA resumes.

## QA Status

- Deployment result: blocked pending authenticated Vercel action
- HEAD deployed: not verified; production still showed `41c43c4`
- URL checked: `https://app.costacleanbcn.com/`
- `qa:visual:auth`: not run against the stale build
- end-user flow dry-run: not run against the stale build
- write-and-clean: not run
- quote mobile/tablet: fixed in source, live validation pending
- expense create: fixed in source, live validation pending
- invoice-create: live validation pending current production build
- invoice, payment, and fiscal writes: skipped by policy
- invoices issued by this block: `0`
- real payments recorded by this block: `0`
- known QA residue created by this block: `0`

## Private Artifacts

Existing ignored continuation-agent evidence remains under `.project-agent/private/`. No `.auth/`, `.env.local`, cookies, tokens, storage state, QA browser profiles, private reports, or private screenshots were added to Git.

## Remaining Gate

Production cannot be declared current or QA-green until Vercel serves `a0fe487` and the visible authenticated checks pass at `390x844`, `768x1024`, and `1366x900`. Only after the visual and dry-run gates pass may the separately guarded non-financial write-and-clean scenarios be considered.
