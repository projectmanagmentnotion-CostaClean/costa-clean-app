# GitHub protection and Fast Delivery activation

## Verified remote baseline (read-only)

- Repository: `projectmanagmentnotion-CostaClean/costa-clean-app`.
- `main` currently reports `protected: false`; its required checks are disabled.
- The repository rulesets endpoint returned an empty list.
- The remote `main` tree did not expose `.github/workflows/` or a `CODEOWNERS` file when queried. The workflows in this branch are local-only until an authorized push/PR makes them visible to GitHub.
- The branch-protection endpoint returned an integration permission error in a separate request. The branch object itself did return `protected: false`; do not treat the endpoint error as evidence that protection exists.
- The local candidate SHA has no remote check runs because it has not been published.

## Minimum administrator configuration for `main`

Create a branch ruleset targeting the exact branch `main` (or classic branch protection if rulesets are unavailable):

1. Require a pull request before merge.
2. Require at least one approving review; the PR author cannot satisfy it. Dismiss stale approvals and require approval of the latest reviewable push.
3. Require CODEOWNERS review for changes covered by `.github/CODEOWNERS`.
4. Require the successful CI checks listed below only after the workflows have been published and run on a PR, selecting the exact check names from GitHub's check picker rather than guessing contexts.
5. Require branches to be up to date before merge if the team accepts the extra CI reruns.
6. Block force pushes and branch deletion; do not allow bypass for routine actors. Any emergency bypass must be restricted to named administrators and audited.

The repo owner login verified from GitHub is `projectmanagmentnotion-CostaClean`; it is the current CODEOWNERS candidate. Confirm that this account can provide an independent review for the PR author, and add a second verified human/team owner if it cannot. Do not replace it with an unverified team slug.

## Proportional workflow behavior

- Fast Delivery classifies the complete diff by maximum risk. L1/L2 run the fast workflow; L3 is excluded from that lane and must pass Critical Release.
- The Costa Clean V3 validation workflow now runs the full Linux app/API and Windows suites only for L2/L3. Its lint/build gate remains unconditional. For L1, the separate Fast Delivery job runs its lint/build and change-related tests, so unrelated frozen CP3B tests do not block that path.
- Require both `Fast delivery (L1/L2)` and `Critical release verification (L3, no deployment)` check contexts when they have appeared on a PR. Also require the V3 lint/build and conditional suite contexts after confirming their exact names in the GitHub UI.
- L3 remains blocked when critical-evidence verification lacks an external trusted verifier; changing the workflow cannot satisfy that evidence.

## Admin read permissions needed for future verification

Grant the GitHub integration/app read access to repository metadata, contents, Actions checks/workflow runs, and repository administration/rulesets. Current branch protection reads are incomplete at the endpoint level; only a repository admin can confirm and apply the ruleset. This change set does not call any write API.
