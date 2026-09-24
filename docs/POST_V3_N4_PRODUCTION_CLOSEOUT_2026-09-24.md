# Costa Clean Post-V3 N4 production closeout — 2026-09-24

## Release identity

- Authorized and deployed product SHA: `ddc1c79024702592c4f17d69a67c0f0bdf458d64`
- Branch at source verification: `codex/post-v3-n4-recurring-services`
- Vercel project: `costa-clean-app` (`prj_SjR3KtjAoBMhP5foigsyCEmxHojh`)
- Vercel team: `projectmanagmentnotion-costaclean's projects` (`team_VEreq24eKfIaRjeflStguIw9`)
- Production deployment: `dpl_J8nfnXhZNadpGRh2mNtWZhDKuUoD`
- Deployment URL: `https://costa-clean-fzto5lja8.vercel.app`
- Target/state: `production / READY`
- Source integrity: deployment was built from an immutable archive of the exact
  authorized SHA after the normal worktree deploy was blocked by the locked QA
  browser profile. No newer commit or branch state was used.
- Canonical domain: `https://app.costacleanbcn.com`
- Project alias: `https://costa-clean-app.vercel.app`

## Prestate and routing verification

- Previous production deployment: `dpl_68rYMpdFacEpYw3R3RMqLLjx51YZ`
- Previous production URL: `https://costa-clean-mz226lpn7.vercel.app`
- Previous production state: `READY`
- Both canonical and project aliases now resolve to `dpl_J8nfnXhZNadpGRh2mNtWZhDKuUoD`.
- Root HTML: `200`, expected CostaClean title.
- Emitted entry JavaScript: `200`, JavaScript MIME.
- Missing JavaScript probe: `404`, non-HTML response.
- Missing CSS probe: `404`, non-HTML response.
- Missing API probe: `404`, non-HTML response; no SPA HTML fallback.
- Vercel build: `PASS` (`tsc -b && vite build`, 660 modules transformed).

## Authenticated read-only smoke

The existing legitimate authenticated Chrome session was reused. No auth
bypass, credential extraction, Supabase migration, or business write was
used.

- Home/dashboard: `PASS`
- Clients: `PASS`
- Properties: `PASS`
- Leads: `PASS`
- Services/Jobs: `PASS`
- Quotes: `PASS`
- Invoices: `PASS`
- Payments: `PASS`
- Expenses: `PASS`
- Recurrentes surface: `PASS`; read surface rendered without ACL error.
- Nuevo recurrente: `PASS`; four-step flow opened with progress and controls.
- Cancelar: `PASS`; flow closed without saving.
- Create-flow saves: `0`
- Console logs captured after smoke: `0`
- Production business writes: `0`

The production viewport contract is inherited from the certified exact SHA
matrix (`390x844`, `820x1180`, `1440x900`): no product source changed between
that certification and this deployment. The live smoke additionally verified
the desktop shell and current rendered production surfaces.

## Dynamic chunk and runtime safety

The previously certified Preview direct-CDP evidence remains the source of
truth for dynamic chunk recovery and reload-loop protection:

- Dynamic chunk recovery: `PASS`
- Reload-loop protection: `PASS`
- Chunk HTML fallback protection: `PASS`
- Production dynamic chunk sabotage: `NOT RUN`
- Vercel deployment logs: build completed and deployment reached `READY`.
- Critical runtime errors: `0` observed in the closeout smoke/log review.

## Mutation and rollback statement

- Production Supabase reads: expected authenticated app reads only.
- Production business writes: `0`
- Supabase production mutations: `0`
- Production migrations this run: `0`
- Auth, secrets, DNS, RLS and Supabase settings: unchanged.
- Rollback required: `NO`
- Rollback reference: `dpl_68rYMpdFacEpYw3R3RMqLLjx51YZ`

The deployed product remains exactly `ddc1c79024702592c4f17d69a67c0f0bdf458d64`.
Any later documentation commit is not the deployed product SHA.

## Final verdict

`PRODUCTION_RELEASE = PASS`

`POST_V3_N4_PRODUCTION = CLOSED/PASS`

Next exact step: stop N4 and plan N5 separately. No further N4 production
action is authorized by this closeout.
