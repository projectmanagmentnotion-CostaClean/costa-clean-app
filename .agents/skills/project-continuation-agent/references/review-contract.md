# Review Contract

## Required Decision

The review must contain:

- `verdict`: `continue`, `complete`, `blocked`, or `stop`
- `summary`: concise factual assessment
- `quality_score`: integer from 0 to 100
- `verified_evidence`: claims supported by repository or command evidence
- `missing_evidence`: claims that cannot be established
- `risks`: concrete risks that affect the next decision
- `stop_reason`: required unless verdict is `continue`
- `next_prompt`: required only when verdict is `continue`

## Continue Gate

Use `continue` only when:

- the next objective is concrete and bounded
- current blockers and dirty-worktree state are preserved
- protected domains are explicit non-goals
- acceptance criteria are testable
- validation commands and live QA requirements are explicit
- stop conditions prevent invented success or unsafe escalation

## Mandatory Stops

Return `blocked` or `stop` when continuation requires:

- a secret or private auth artifact
- bypassing an approval, sandbox, policy, or browser confirmation
- production schema, SQL, migration, RPC, auth, invoice numbering, fiscal, invoice emission, payment, or destructive real-data mutation
- commit, push, deploy, or external communication without a separately authorized workflow
- claiming live or deployed success from source-only evidence

## Prompt Shape

The generated prompt must use these headings:

1. `Objective`
2. `Evidence`
3. `Scope`
4. `Non-goals`
5. `Acceptance criteria`
6. `Validation`
7. `Stop conditions`
8. `Delivery`
