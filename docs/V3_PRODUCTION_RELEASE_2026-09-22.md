# Costa Clean V3 production release — 2026-09-22

## Release identity

- Authorized/deployed product SHA: `727ecfd29d1a888deb4d064f3528ea5671ac9024`
- Source branch at deploy: `codex/v3-clean-release-candidate`
- Vercel project: `costa-clean-app` (`prj_SjR3KtjAoBMhP5foigsyCEmxHojh`)
- Vercel team: `projectmanagmentnotion-costaclean's projects` (`team_VEreq24eKfIaRjeflStguIw9`)
- Production deployment: `dpl_48sc4D1uGpuZoPau3mqJtv6rLtrR`
- Deployment URL: `https://costa-clean-ncalor922.vercel.app`
- Target/state: `production / READY`
- Vercel deployment metadata reports `githubCommitSha=727ecfd29d1a888deb4d064f3528ea5671ac9024`.
- Canonical domain `https://app.costacleanbcn.com` is an alias of this deployment.
- Previous production rollback reference: `dpl_8M1PyVpw4DZLHXmhWUmGdwRmq42J`, deployed SHA `988f714a5285baa9edba50c949a49d121ae9158f`.
- Product code, project settings, environment variables, DNS, auth configuration and Supabase were not changed by this release.

## Deployment verification

- Pre-deploy HEAD matched the authorized SHA; worktree was clean and the remote release branch contained the same SHA.
- Vercel production build passed (`tsc -b` and Vite; 657 modules transformed).
- Deployment reached `READY`; Vercel inspect confirms the exact authorized commit metadata and canonical alias.
- Build outputs contain the internal app functions only: closing intelligence, expense fiscal intelligence and lead-message drafts.
- Vercel runtime-error scan for the post-deploy window found no runtime error clusters; scoped error/fatal logs for this deployment returned no entries.

## Public and authenticated smoke

- Canonical root: HTTP `200`, `text/html`.
- Current entry bundle: HTTP `200`, JavaScript MIME.
- Recursive public asset check: 150 referenced JS/CSS assets checked; 0 missing assets and 0 MIME mismatches.
- No reload loop observed; authenticated navigation completed across the app without failed browser requests or page/console errors.
- Authenticated Edge smoke: **396/396 checks passed** at `390x844`, `820x1180` and `1440x900`, covering Home, Clients, Properties, Leads, Invoices, Quotes, Payments, Expenses, Services/Jobs, alerts/fiscal surfaces and representative create-flow openings.
- Dashboard period selector changed to the quarter view and back successfully.
- Invoice and quote lists rendered existing records (25 invoices and 12 quotes in the read-only smoke); existing invoice and quote canonical previews opened successfully.
- Expense StepFlow opened; Continue/Back preserved local draft values; Cancel displayed the unsaved-work guard and the explicit continue/discard action closed it. No final submit was used.
- Authenticated visual checks reported one visible `data-brand-lockup="CostaClean"` at each of the three production smoke viewports, no horizontal overflow, app height within the viewport, mobile/tablet bottom navigation and desktop navigation rail without duplication.
- Auth bypass: NO.

## Network and mutation safety

- Sanitized telemetry from instrumented production-browser runs captured **338 production Supabase read requests**. Additional visual-only browser checks were not attached to the request counter, so 338 is the measured instrumented-run count, not a claim of the total across every supplemental smoke navigation.
- QA Supabase requests: `0` in the instrumented runs.
- Unknown Supabase hosts: `0`.
- Production business writes: `0`.
- QA business writes: `0`.
- Failed requests, console errors and page errors: `0` in instrumented runs.
- No clients, properties, leads, invoices, quotes, payments, expenses, services, recurring plans, closings or alerts were created/edited/deleted; no email or payment action was sent; no storage upload occurred.
- Production mutations: `0`; Supabase production mutations: `0`.

## Final verdict and SHA separation

**PRODUCTION_RELEASE = PASS**

**ROLLBACK_REQUIRED = NO**

- `DEPLOYED_PRODUCT_SHA`: `727ecfd29d1a888deb4d064f3528ea5671ac9024`
- `POST_RELEASE_DOCUMENTATION_SHA`: the documentation-only commit that adds this record; it is not deployed and does not replace the product SHA above.
- Next exact gate: none for this authorized release; any future production deploy requires a new explicit authorization.
