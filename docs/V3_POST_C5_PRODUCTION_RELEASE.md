# V3 — Post-C5 Production Release

Status: `CLOSED / CERTIFIED`

Release authorization: explicit human authorization for the exact certified
candidate below. No later product commit was included in the deployment.

## Released identity

- Repository: `projectmanagmentnotion-CostaClean/costa-clean-app`
- Branch: `codex/app-v3-mobile-first-redesign`
- Released SHA: `6f1454f98f1f29b0e758a50329502ba7af903100`
- Vercel project: `costa-clean-app`
- Vercel project ID: `prj_SjR3KtjAoBMhP5foigsyCEmxHojh`
- Vercel team: `team_VEreq24eKfIaRjeflStguIw9`
- Production deployment: `dpl_DQDxBGQkyt92H11B3F87NNL4P4rF`
- Deployment URL: `https://costa-clean-ak08tunw9.vercel.app`
- Canonical alias: `https://app.costacleanbcn.com`
- Deployment target/state: `production / READY`
- Deployment commit metadata: exact released SHA and branch verified through Vercel

The previous active final deployment was `dpl_BtBXiCoBwfwUFF4ghn5wtUKji4x7`.
The verified rollback target is `dpl_AdTgyDsaKiWSveVreqzMztsPrcEK`; the historical
V2 rollback remains `dpl_6SKXizLD3wi8qCqTpeTjAYdJAdbF`.

## Pre-deploy gates

- Candidate identity, branch, upstream and clean worktree: PASS.
- Vercel project/team/domain identity: PASS.
- Production backend reference: `wfxnwfcdjainpojhbdri`.
- QA backend reference `kpvvydthlxupjjqqdpxy`: absent from delivered production assets.
- Static production asset scan: one production backend reference, zero QA references.
- Secret scan of release documentation changes: zero matches. Dedicated `gitleaks`,
  `trufflehog` and `detect-secrets` binaries were unavailable in the environment.
- Approved candidate validation: `867 passed | 4 skipped` with the approved
  15-second Vitest timeout; agents `294/294 PASS`; lint, build and diff check PASS.
- The standard 5-second test command retains the known CP3B2A V6R1E infrastructure
  timeout caveat; the same tests pass with the approved 15-second timeout and no
  assertion failure.

## Independent pre-deploy review

A fresh detached reviewer inspected the actual candidate and produced the structured
artifact at the ignored local path:

`.project-agent/private/post-c5-predeploy-independent-review.json`

Result: `PASS` (`complete`), quality score `96`, P0/P1/P2/P3 `0/0/0/0`, no missing
evidence and no residual risks. The review confirmed the exact SHA, target identity,
rollback identity, protected-contract drift `0`, no deployment activity before the
release, and no private artifacts.

## Production deployment and smoke

The exact released SHA was deployed once with the canonical production target. The
canonical root and `?v3=1` both returned HTTP `200` after aliasing.

Authenticated, read-only smoke used the existing controlled production session. No
credentials, cookies, tokens or secrets were inspected or modified.

| Viewport | Surfaces exercised | Result |
| --- | --- | --- |
| `390x844` | Home, Clients, Invoices, Invoice Workspace | PASS |
| `768x1024` | Properties, Quotes, Payments | PASS |
| `1280x800` | Expenses, Services, Alerts | PASS |
| `1920x1080` | Closings, Home, Operations navigation | PASS |

The invoice workspace verified the total/paid/outstanding hierarchy, one clear
settlement CTA, non-mutating settlement wording, PDF/document actions, More actions,
hard reload and Back. Escape closed More actions and restored focus to its trigger.
The V2 fallback was reachable separately and did not alter the V3 route.

The direct `recurring` query did not expose a standalone route and resolved to Home;
no recurring generation action was invoked. This is recorded as route N/A rather than
as an invented runtime PASS.

Sanitized invariant results:

- Authenticated shell: present after navigation and hard reload.
- Visible UUID: `0`.
- Unicode-as-icon: `0`.
- Legacy V2 selectors in V3 surfaces: `0`.
- Horizontal overflow: `0` across exercised surfaces.
- Broken loaded images: `0`. Lazy property images had valid natural dimensions.
- Visible interactive controls below `44x44`: `0`.
- Console errors: `0`.
- Page errors: `0`.
- Failed critical requests: `0`.
- Vercel runtime errors after deployment: none found in the selected window.
- Vercel production error logs for the released deployment: none found.
- QA backend requests: `0`.
- QA mutations: `0`.
- Production business mutations: `0`.
- Settlement, quote conversion, payment creation, expense upload, service mutation,
  alert mutation, closing persistence and recurring generation: not invoked.

Production read requests required by the authenticated smoke are expected and are
distinct from production business mutations. No QA-originated production request or
mutation was made.

## Backend and scope safety

Supabase schema, RPCs, policies, buckets, auth configuration and storage were not
changed. No production deployment other than the authorized exact candidate was
performed. No C6 or Wealth OS work was started.

## Rollback readiness

The previous active deployment and the verified rollback deployment were retained and
identified before release. Rollback is therefore available without changing source or
database state.

## Verdict

`POST-C5 PRODUCTION RELEASE CLOSED / CERTIFIED`

`GLOBAL RELEASE CANDIDATE DEPLOYED`

`PRODUCTION V3 CERTIFIED BUILD ACTIVE`

V3-10C6 remains unstarted.
