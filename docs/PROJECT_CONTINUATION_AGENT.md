# Project Continuation Agent

## Purpose

The agent audits a completed sprint output, verifies its claims against the repository, and creates the next bounded engineering prompt. In automatic mode it passes that prompt directly to a local non-interactive Codex run without using ChatGPT or browser UI.

## Safety Model

- Review runs are read-only.
- Execution runs use `workspace-write`; approval and sandbox bypass flags are never used.
- One launch gate enables the bounded loop: `PROJECT_CONTINUATION_ALLOW_EXEC=1`.
- The loop stops on `complete`, `blocked`, `stop`, suspected secrets, unsafe prompt content, Codex failure, a fresh approval requirement, or the configured iteration limit.
- Automatic prompts cannot commit, push, deploy, emit invoices, create payments, mutate production schema/auth/fiscal state, or send external messages.
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
