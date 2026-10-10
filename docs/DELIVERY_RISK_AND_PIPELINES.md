# Costa Clean delivery lanes

This policy separates quick, independently releasable work from changes that can affect data, authorization, identity, money, or infrastructure. It prepares checks and (where enabled by the repository's GitHub/Vercel integration) a Preview; it never merges, deploys, runs migrations, changes secrets, or writes Production.

## Risk classification

- **L1 — visual:** vetted presentation-only CSS declarations, raster/font/media assets, and non-release documentation. JSX/TSX is conservatively L2 because class names and markup can be consumed by runtime logic; prove dependencies before considering any narrower policy.
- **L2 — functional:** business logic and other code not confidently limited to presentation or critical infrastructure. Run lint, build, and related tests; if no related test can be identified, run the complete test suite.
- **L3 — critical:** migrations, RLS/ACL, auth, payments/billing, database/storage/Edge, secrets, dependency manifests, Vercel config, API/data paths, CI workflows, or uncertain high-impact changes. Highest risk in a mixed diff wins. L3 is rejected by the Fast Delivery runner.

The classifier reviews both paths and changed content. Unknown code defaults to L2; sensitive SQL/content or critical paths elevate to L3. Changes to `.github/workflows/`, `scripts/release/`, or `docs/release/` classify as L3. This is a classification signal, not a trust root: repository branch protection must require both workflow checks and require CODEOWNERS approval for those policy paths; this local task does not change GitHub settings.

Examples:

| Example diff | Lane | Why |
|---|---|---|
| Change button color in CSS | L1 | Presentation only |
| Change quote total calculation | L2 | Business behavior; must have functional regression coverage |
| Add RLS policy or edit invoice migration | L3 | Data access/schema/financial integrity |

## A. Fast Delivery (L1/L2)

GitHub workflow: `.github/workflows/fast-delivery.yml`. Locally:

```sh
npm ci
node scripts/release/classify-change-risk.mjs --base <base-sha>
node scripts/release/run-fast-delivery.mjs --base <base-sha>
```

For L1 it selects related test files when present (or reports none for pure assets/docs); L2 always runs the full suite so shared-code effects cannot evade test selection. Only the one exact, unchanged SHA-base CP3B timeout may be reported as a pre-existing exception for unrelated L2 changes. L3 is refused. A Vercel Preview may be prepared only by the repository's separately configured Git integration; this workflow itself has read-only GitHub permissions and no deployment or Production credentials.

## B. Critical Release (L3)

GitHub workflow: `.github/workflows/critical-release.yml`. It runs lint, build, and the complete test suite, then requires SHA-bound evidence for a complete data backup+restore, rollback, runtime ACL/RLS, authenticated Preview, Edge runtime, independent security review, and human release approval. The checked-in evidence file is an intentionally empty template, so the gate fails closed until actual evidence exists.

This workflow only verifies. It does not deploy or authorize deployment. No migration, secret, permission, Production-data, merge, or deploy action is performed by either lane. The critical evidence gate now also requires a trusted external verifier identifier; none is configured, so L3 remains explicitly blocked even if a PR edits the evidence JSON to say `PASS`.

## GitHub protection review and exact proposal

Read-only GitHub inspection on 2026-10-11 returned no repository rulesets (`GET /repos/.../rulesets` was an empty list). The integration returned 403 for `GET /branches/main/protection`, so branch-protection settings could not be verified. `CODEOWNERS` was not found at the repository root or `.github/CODEOWNERS` on the default branch. Therefore protection is **unverified**, not assumed absent or active.

Before treating Fast Delivery as publishable, an administrator should configure a ruleset (or equivalent branch protection) for `main` and release branches:

1. Require pull requests; require at least one approving review from a qualified human reviewer; dismiss stale approvals and require approval of the latest reviewable push.
2. Require the `Fast Delivery / validate` status check for all PRs and the `Critical Release / verify` check whenever the risk classifier reports L3. Because GitHub required checks are static, configure the critical check as required and make its non-L3 outcome successful; L3's evidence gate must remain blocking.
3. Require CODEOWNERS review for `.github/workflows/**`, `scripts/release/**`, `docs/release/**`, `supabase/**`, and `scripts/client-portal/run-cp3b2a-qa-v6r1f.mjs` (or the finalized V6R1F package path). A repository owner must replace `@REPLACE_WITH_RELEASE_SECURITY_TEAM` below with an existing authorized team before enabling the file.
4. Configure an independently operated evidence verifier with a trust root outside the PR-controlled tree. It must cryptographically validate SHA-bound backup/restore, rollback, ACL/RLS, authenticated Preview, Edge runtime, independent review, and human approval evidence. Populate the verifier ID and validation contract only after an authorized owner establishes that trust root.
5. Block force pushes and branch deletion; require up-to-date branches before merge; do not grant bypass to routine automation.
6. Keep workflow token permissions read-only unless a separately reviewed workflow has a narrowly scoped need. Fast Delivery and Critical Release must have no deployment or Production credentials.

Proposed `.github/CODEOWNERS` entry (not installed because the qualified team handle is not established):

```text
/.github/workflows/** @REPLACE_WITH_RELEASE_SECURITY_TEAM
/scripts/release/** @REPLACE_WITH_RELEASE_SECURITY_TEAM
/docs/release/** @REPLACE_WITH_RELEASE_SECURITY_TEAM
/supabase/** @REPLACE_WITH_RELEASE_SECURITY_TEAM
/scripts/client-portal/run-cp3b2a-qa-v6r1f.mjs @REPLACE_WITH_RELEASE_SECURITY_TEAM
```

An L1 Preview is only possible if GitHub/Vercel integration is already configured; this branch does not prove that integration or authorize deployment. A safe visual check was exercised synthetically using a CSS-only change descriptor, followed by the repository's real lint/build gates; no visual file was retained and no deployment was performed.

## Baseline test failures

Baseline SHA: `4dd3530a126dba31d401e64176cdd59f20dc7372`. This base has one reproduced failure: `CP-3B.2A.6R.1E final real PostgreSQL adapter revalidates the capability map immediately before consuming it` (5 s Vitest timeout; measured ~6.3–6.9 s). Its test and runner Git blob IDs are pinned in `docs/release/known-test-baseline.json`. Fast Delivery may report only this exact unchanged failure as a baseline exception for unrelated L2 changes; any CP3B-related file change disables the exception, and all new/unexpected failures remain blocking. L1 changes with no relevant test report `NO_RELATED_TESTS`. Any L3 release requires the full test job with no baseline exception.

## CP2A Docker transport

Run `node scripts/client-portal/run-cp2a1-docker-proof.mjs`. It starts a fresh PostgreSQL 17 container pinned to its image digest, attached to `--network none`, without published ports or persistent volume mounts (database files live on `tmpfs`). It validates its unique run label and isolation before use and before removal. Existing containers/volumes are not selected or modified. This is a PostgreSQL/Auth-Storage compatibility proof with synthetic Auth rows, not a full Supabase GoTrue or full-schema certification. It makes no remote calls and records no credential.
