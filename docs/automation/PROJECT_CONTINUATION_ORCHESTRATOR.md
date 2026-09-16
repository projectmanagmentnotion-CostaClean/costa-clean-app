# Project Continuation Orchestrator

## Purpose

The continuation orchestrator extends the local Prompt Bridge rather than
creating a second automation service. For the configured `ecosystem-config`
project it connects a completed Codex report to the existing
project-continuation reviewer, then either stops safely or queues one bounded
next job for the same Codex app thread and worktree.

It is disabled unless the bridge process starts with
`PROJECT_CONTINUATION_ALLOW_EXEC=1`.

## Chain lifecycle

Each private chain records only operational metadata:

- `chainId`, project key, initial/current job IDs and iteration count;
- maximum iterations, timestamps, status and optional stop reason;
- prompt hashes and workspace fingerprints for dedupe/progress guards.

Valid statuses are `running`, `awaiting_approval`, `complete`, `blocked`,
`stopped`, `max_iterations` and `failed`. The default maximum is 10 and the
allowed range is 1 through 10.

On a valid completion the read-only reviewer verifies the real repository and
returns the existing structured review contract. `continue` is accepted only
when the next prompt has all required headings and passes sensitive-content,
approval, duplicate-prompt and progress checks. Other verdicts terminate the
chain.

## Approval boundaries

The executor may perform bounded local code, tests, lint, build and
documentation work only. It pauses before production, DNS, SiteGround, remote
Supabase/database changes, credentials, Brevo setup or sends, external account
changes, paid activity, real data, destructive work or merge/publication
operations. Existing approval gates are preserved; the orchestrator creates an
`awaiting_approval` job and never bypasses them.

The reviewer always uses a read-only Codex sandbox. The existing executor uses
`workspace-write` and no longer passes an automatic approval flag.

## Start and observe

```powershell
cd C:\Users\USUARIO\costa-clean-app
$env:PROJECT_CONTINUATION_ALLOW_EXEC = '1'
$env:PROJECT_CONTINUATION_MAX_ITERATIONS = '10'
npm run agent:orchestrator
```

Use `GET /api/chains` or `GET /api/chains/:id` for metadata-only status. These
endpoints never return prompts, raw Codex output, credentials, tokens or PII.

## Recovery and failure behavior

Private manifests, reviews, next prompts and executor final reports live below
`.project-agent/private/prompt-bridge/continuation-chains/`, which Git ignores.
After a restart the bridge loads chain metadata but never re-dispatches a
completed job or resumes a paused approval automatically.

The chain fails closed for empty or secret-like reports, invalid reviewer JSON,
invalid prompts, worktree/branch mismatches and reviewer failures. It stops for
a repeated next prompt or after two consecutive executor completions with no
HEAD/tracked-diff fingerprint progress.

## Security constraints

The configured `ecosystem-config` project remains bound to its existing Codex
thread and its own worktree. Cross-worktree dispatch is rejected by the bridge
identity check. Private artifact contents are never committed or exposed by the
chain observability endpoints.
