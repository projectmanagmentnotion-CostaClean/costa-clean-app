# GitHub protection and Fast Delivery activation

## Verified remote baseline (read-only)

- Repository: `projectmanagmentnotion-CostaClean/costa-clean-app`.
- Default branch is `main`; the repository owner's verified login has admin permission.
- Current remote `main` SHA was confirmed read-only as `a9977eafa6e4873a5d3aae64c0bd4dc64c5cece2`.
- `main` currently reports `protected: false`; its required checks are disabled.
- The repository rulesets endpoint returned an empty list.
- The remote `main` tree returned 404 for `.github/CODEOWNERS`, root `CODEOWNERS`, and the Fast Delivery workflow. Local files are not active remotely until an authorized push/PR makes them visible to GitHub.
- The branch-protection endpoint returned an integration permission error in a separate request. The branch object itself did return `protected: false`; do not treat the endpoint error as evidence that protection exists.
- The local candidate SHA has no remote check runs because it has not been published.

## Minimum administrator configuration for `main`

Create a branch ruleset targeting the exact branch `main` (or classic branch protection if rulesets are unavailable):

1. Require a pull request before merge.
2. Require at least one approving review; the PR author cannot satisfy it. Dismiss stale approvals and require approval of the latest reviewable push.
3. Use one approval from a human distinct from the PR author. The verified repository owner is also the current integration identity; that account cannot approve its own PR. A second collaborator/reviewer must be added before enabling this rule or merges will intentionally remain blocked. Do not invent a team slug or permit self-approval as a workaround.
4. Keep `.github/CODEOWNERS` assigned to the verified owner for now. Make CODEOWNERS approval mandatory only after a distinct, verified reviewer/team is assigned to those paths; otherwise the rule can be impossible for a one-person maintainer setup.
5. Require successful CI contexts only after workflows are published and run on a PR; select exact names in GitHub's check picker. Locally defined names are listed below but do not yet exist remotely.
6. Require branches to be up to date before merge only if the team accepts the extra CI reruns.
7. Block force pushes and branch deletion; do not allow bypass for routine actors. Any emergency bypass must be restricted to named administrators and audited.

The repo owner login verified from GitHub is `projectmanagmentnotion-CostaClean` (account type User; permission admin); it is a valid CODEOWNERS candidate, not an independent reviewer when it is also the PR author. Add a second real collaborator and assign that verified account/team to protected paths before requiring CODEOWNERS approval.

## Proportional workflow behavior

- Fast Delivery classifies the complete diff by maximum risk. L1/L2 run the fast workflow; L3 is excluded from that lane and must pass Critical Release. All `.github/` paths, including workflow and CODEOWNERS changes, classify as L3.
- The Costa Clean V3 validation workflow now runs the full Linux app/API and Windows suites only for L2/L3. Its lint/build gate remains unconditional. For L1, the separate Fast Delivery job runs its lint/build and change-related tests, so unrelated frozen CP3B tests do not block that path.
- Locally defined candidate check contexts: `Fast delivery (L1/L2) / validate`, `Critical release verification (L3, no deployment) / verify`, `Costa Clean V3 Release Validation / Change risk classification`, `Costa Clean V3 Release Validation / Linux — Lint / TypeScript / Build`, `Costa Clean V3 Release Validation / Linux — App and API tests`, and `Costa Clean V3 Release Validation / Windows — Full suite including CP2B frozen QA proofs`. None is confirmed active on remote `main` yet. Proposed required set for main: all six contexts, selected from GitHub after the first real PR run. The fast and critical jobs are stable on every PR (the fast job explicitly excludes L3; the critical job performs the L3 checks). The V3 classification and lint/build jobs always run; its Linux/Windows test jobs are skipped for L1 and run for L2/L3. A failed classifier itself is required, so skipped dependent jobs cannot conceal a classifier failure. This set creates no workflow-run/status-trigger cycle. Confirm GitHub emits the exact contexts, including successful skipped jobs, before enforcing them.
- L3 remains blocked when critical-evidence verification lacks an external trusted verifier; changing the workflow cannot satisfy that evidence.

## CP3B timeout diagnosis (kept separate from L1 delivery)

- V6R1E is unchanged and remains the active frozen runner. Its `assertAuthorizedFileIntegrityV6` synchronously starts Git separately for metadata (`ls-files -v`), index divergence (`diff --cached`), and authorized blob identity (`rev-parse commit:path`) for each protected file. Package verification repeats this traversal in `planV6`, `preflightReadOnlyV6`, and `preflightV6`.
- On the Windows full suite, `keeps read-only plan and preflight usable without execution authorization` exceeds its 15,000 ms limit (observed about 16,142 ms); `revalidates the capability map immediately before consuming it` exceeds 5,000 ms (observed about 7,585 ms). Synchronous child-process startup blocks Vitest's event loop, so timeout reporting can arrive later than the configured limit. This is process-launch overhead from repeated per-file Git probes, not a PostgreSQL wait or a justification to increase timeouts.
- V6R1F already batches a package snapshot into five Git processes and has focused negative coverage for staged/worktree divergence, HEAD movement, traversal, and symlink/reparse paths. It remains separate: the frozen V6R1E preflight does not yet consume its snapshot API, and the full runner's per-stage TOCTOU equivalence has not been demonstrated. Do not switch the active preflight until tests prove identical rejection behavior and an independent reviewer approves the transition.
- Reproduction: `npx vitest run scripts/client-portal/cp3b2aV6RealAdapter.test.mjs`; focused batching checks: `npx vitest run scripts/client-portal/cp3b2aV6R1FGitIntegrity.test.mjs`.

## Admin read permissions needed for future verification

Grant the GitHub integration/app read access to repository metadata, contents, Actions checks/workflow runs, and repository administration/rulesets. Current branch protection reads are incomplete at the endpoint level; only a repository admin can confirm and apply the ruleset. This change set does not call any write API.
