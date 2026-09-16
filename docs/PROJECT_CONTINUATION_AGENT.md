# Project Continuation Agent

## Purpose

The agent audits a completed sprint output, verifies its claims against the repository, and creates the next bounded engineering prompt. In automatic mode it passes that prompt directly to a local non-interactive Codex run without using ChatGPT or browser UI.

## Safety Model

- Review runs are read-only.
- Execution runs use `workspace-write`; approval and sandbox bypass flags are never used.
- One launch gate enables the bounded loop: `PROJECT_CONTINUATION_ALLOW_EXEC=1`.
- The loop stops on `complete`, `blocked`, `stop`, suspected secrets, unsafe prompt content, Codex failure, a fresh approval requirement, or the configured iteration limit.
- Automatic prompts cannot commit, push, switch branches, deploy, emit invoices, create payments, mutate production schema/auth/fiscal state, or send external messages.
- The workspace-write executor always requires a clean initial worktree. Publication is disabled by default; when a separate explicit publication capability is enabled, only the outer runner may publish from a verified safe local feature branch.
- The runner follows this fixed lifecycle: planning review → executor → changed-file secret scan → tests/agent validation/lint/build/diff checks (including an isolated temporary-index check of all reviewed candidates) → independent read-only post-execution review → branch and reviewed-set revalidation → stage/commit/push.
- Any missing, failed, malformed, timed-out, or unsafe gate blocks publication without staging, commit, push, stash, reset, or cleanup.
- Artifacts live under `.project-agent/private/` and are ignored by Git.

## Usage

Save the completed sprint output in a repository file, then generate the next prompt only:

```powershell
node scripts/ops/run-project-continuation-agent.mjs --input path/to/output.md
```

Run a bounded automatic chain after one explicit launch decision:

```powershell
$env:PROJECT_CONTINUATION_ALLOW_EXEC="1"
node scripts/ops/run-project-continuation-agent.mjs --input path/to/output.md --execute --max-iterations 3
```

Use `PROJECT_CONTINUATION_MODEL` or `--model` to override the default `gpt-5.6-sol`. The runner prefers the current CLI bundled with Codex App, then falls back to the npm CLI. It reuses local Codex authentication through the CLI and never reads or copies auth files.

## Outputs

Each private run contains:

- structured review JSON
- generated next prompt Markdown
- execution output when automatic mode is enabled
- manifest with verdicts and artifact paths

The generated prompt follows `Objective`, `Evidence`, `Scope`, `Non-goals`, `Acceptance criteria`, `Validation`, `Stop conditions`, and `Delivery` sections.
