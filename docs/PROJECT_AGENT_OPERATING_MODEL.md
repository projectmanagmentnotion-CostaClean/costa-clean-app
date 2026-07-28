# Costa Clean Project Agent Operating Model

Date: 2026-07-28

Status: active governance model

Authority: `AGENTS.md` and the mandatory project documents remain authoritative

## Purpose and selection

Project agents are manually selected GitHub Copilot profiles that provide a
bounded role, tool set, risk level, output contract, and stop conditions. They
are guides and workers inside an approved gate; they do not create authority,
approve production, or replace repository rules.

All 15 profiles live in `.github/agents/` and are registered in
`config/project-agents.json`. Run `npm run qa:agents` after any profile or
manifest change. `disable-model-invocation: true` is permanent: choose a
profile explicitly in GitHub Copilot Agents or use its contract as a guide in
Codex. Not every agent is required in every sprint.

Start each new block with `project-continuation` to reconcile repository
evidence with the canonical roadmap. Select `implementation-planner` when the
gate still needs decomposition, then assign the narrowest specialist that can
perform the approved work.

## Roles and editing authority

| Agent | Normal mode | May edit when the gate authorizes it | Primary use |
|---|---|---:|---|
| `project-continuation` | orchestration | yes | select the next unlocked block and close it with evidence |
| `implementation-planner` | read-only | documentation only | scope, dependencies, risks, acceptance and validation plan |
| `senior-fullstack-builder` | implementation | yes | bounded application implementation |
| `bug-root-cause-investigator` | diagnostic | only a minimal approved fix | reproduce and isolate a concrete failure |
| `qa-e2e-specialist` | audit/test | tests or QA tooling when approved | journeys, authorization, cleanup and viewport evidence |
| `pr-quality-gate` | read-only independent review | no | approve, block or request changes from evidence |
| `security-privacy-auditor` | read-only independent audit | no | tenancy, Auth, documents, secrets, privacy and legal separation |
| `documentation-roadmap` | documentation | documentation only | reconcile roadmap, runbooks, debt and release evidence |
| `supabase-guardian` | read-only by default | only in a separate authorized remote gate | Auth, RLS, Storage, Edge and tenancy |
| `business-rules-test-engineer` | analysis/test | tests when approved | services, invoices, payments, tax, rounding and numbering |
| `frontend-ux-accessibility` | audit/implementation | UI only when approved | mobile-first UX, accessibility and complete states |
| `performance-gsap-motion` | audit/implementation | performance or motion scope only | Web Vitals, progressive GSAP and reduced motion |
| `seo-local-structured-data` | audit/implementation | public SEO scope only | canonical URLs, local SEO and structured data |
| `release-deployment-guardian` | release control | release artifacts; deployment only with exact approval | backups, rollback, monitoring and release evidence |
| `enterprise-agent-architect` | architecture | architecture documentation or approved adapter boundaries | integrations, email adapter and observability design |

Planning, security/privacy review, PR review, and roadmap reconciliation are
normally read-only. Implementers may edit only files inside the accepted gate.
An auditor may describe a fix but must not silently become its implementer.

## Risk and least privilege

- `R1` is read-only or documentation governance. It receives no mutation
  authority merely because it can inspect a repository or PR.
- `R2` may implement bounded local changes after the gate is ready. It receives
  only the files and commands necessary for that block.
- `R3` covers remote data, Supabase, release, or deployment risk. It is
  read-only until a separate gate identifies the exact target, operations,
  backup, rollback, human authorization, and stop conditions.

No level authorizes production by default. Remote Supabase requires a separate
human-approved gate; `db push`, `db pull`, migration repair, destructive
commands, and implicit project selection remain prohibited. WordPress changes
require an export, backup, staging/deployment owner, and tested rollback.

Use synthetic data only. Never place real PII in fixtures, expose
`service_role` in frontend code, print secrets, pass credentials in arguments,
or commit private QA artifacts. `NOT_EXECUTED` never means `PASS`.

## Separation of duties

The implementer cannot approve its own work. The normal independent reviewer is
`pr-quality-gate`; security-sensitive gates also require
`security-privacy-auditor`, and Supabase/release gates use their specialist
without granting implicit writes.

Recommended flow:

```text
implementation-planner
  -> senior-fullstack-builder
  -> qa-e2e-specialist
  -> frontend-ux-accessibility or the relevant specialist
  -> security-privacy-auditor
  -> pr-quality-gate
  -> documentation-roadmap
  -> release-deployment-guardian
```

This is a routing pattern, not a requirement to run all agents. A documentation
gate may need only planning, independent review, and roadmap reconciliation. A
reproducible failure may insert `bug-root-cause-investigator` before any fix.

## Operating flow

1. Select `project-continuation`; verify HEAD, branch, worktree, mandatory
   documents, canonical roadmap, recent evidence, and unresolved P0/P1 risks.
2. Confirm Definition of Ready, exact in/out scope, permissions, prohibited
   operations, rollback, validations, and the independent reviewer.
3. Plan the smallest reviewable change. Stop if the request needs new authority
   or conflicts with an upstream security boundary.
4. Implement locally with minimum privilege. Never expand a UI gate into Auth,
   schema, financial, WordPress, or deployment work.
5. Run the gate-specific checks plus tests, lint, build, diff and private-file
   checks. Record failures honestly.
6. Obtain specialist audits and an independent PR gate. The implementer does
   not self-approve.
7. Reconcile documentation only with verified evidence. Preserve open debt and
   professional legal review markers.
8. End each approved work block with a reviewable commit and immediate push of
   the current branch, unless a real stop condition blocks closure.

## Stop conditions

Stop and report `BLOCKED` when identity or target cannot be proven; required
authorization, backup or rollback is absent; a secret or real PII may be
exposed; the worktree contains conflicting user changes; an upstream gate
failed; cross-client isolation regresses; financial/fiscal behavior would
change outside scope; production or WordPress is reached without its separate
gate; tests reveal an unexplained P0/P1; or required evidence is unavailable.

Do not hide a failed check, weaken a policy, alter a frozen CP-2 artifact, or
mark a phase complete to bypass a stop condition.

## GitHub Copilot Agents

After the agent-pack commit is available on the working branch:

1. Open the repository in a Copilot Agents-compatible surface.
2. Manually choose the profile whose name matches the approved task.
3. Paste the gate prompt with branch, allowed files, forbidden operations,
   validations, evidence, commit expectation, and stop conditions.
4. Review the proposed plan before permitting edits.
5. Assign a different profile for independent review.

The profile's tool declaration is a ceiling, not permission to use every tool.
Repository and human restrictions always take precedence.

## Codex use

In Codex, name the desired project agent and ask Codex to follow its contract,
then provide the exact gate. Codex must still read `AGENTS.md` and the mandatory
documents, inspect the real implementation, announce a plan, honor approval
boundaries, validate the result, and use an independent reviewer where
required. Selecting an R3 guide does not authorize a remote command.

## Continuing from another computer

1. Clone the official Costa Clean repository and check out the intended branch.
2. Fetch and verify the expected remote commit; do not continue from a dirty or
   divergent worktree without reconciling ownership.
3. Install dependencies from the lockfile, without changing dependency
   versions.
4. Read `AGENTS.md`, its mandatory documents, this model, the canonical
   implementation roadmap, and the execution matrix.
5. Run `npm run qa:agents`, baseline tests, lint, and build.
6. Start with `project-continuation` and continue only the next unlocked gate.

Credentials and `.env` files are transferred through the approved private
channel, never Git. A different computer does not inherit remote authority from
a previous session.

## Reusable prompts

### Continue the next gate

```text
Use project-continuation. Reconstruct repository truth and compare it with the
canonical roadmap. Select only the next unlocked gate, state DoR, risks,
permissions, validations and stop conditions, then continue only if authorized.
```

### Plan a phase

```text
Use implementation-planner in read-only mode. Plan <gate> with dependencies,
in/out scope, likely files, acceptance, security, rollback and evidence. Do not
edit functional code or perform remote operations.
```

### Implement a sprint

```text
Use senior-fullstack-builder for approved gate <gate>. Modify only <files>,
preserve business/Auth/Supabase contracts, run the named validations and stop
if the scope needs new authority. Do not self-approve.
```

### Investigate a bug

```text
Use bug-root-cause-investigator for <reproducible symptom>. Reproduce it,
separate observations from hypotheses, identify the smallest root cause and
propose a bounded fix. Do not become a generic implementer.
```

### Execute QA

```text
Use qa-e2e-specialist for <gate>. Exercise positive, negative and forbidden
states with synthetic data, record cleanup and distinguish PASS, FAIL,
NOT_AVAILABLE and NOT_EXECUTED. Do not touch production.
```

### Audit security

```text
Use security-privacy-auditor read-only on <gate>. Review tenancy, Auth,
anti-enumeration, documents, secrets, data minimization and legal-purpose
separation. Rank evidence-backed findings and do not implement fixes.
```

### Review UX

```text
Use frontend-ux-accessibility to audit <route> at 390x844, 768x1024 and desktop,
including keyboard, screen reader semantics, reduced motion and all UI states.
Do not alter business or authorization behavior.
```

### Audit a PR

```text
Use pr-quality-gate as independent reviewer for <PR/commit>. Verify scope,
tests, security, private-file hygiene, roadmap claims and unresolved risks.
Return approve, request changes or blocked with concrete evidence.
```

### Reconcile the roadmap

```text
Use documentation-roadmap. Compare the canonical roadmap with commits and test
evidence, update only verified status, retain debt and identify the exact next
gate. Do not overdeclare completion.
```

### Prepare a release

```text
Use release-deployment-guardian. Prepare a read-only release plan for <target>
with exact artifact, authorization, backup, rollback, smoke checks, monitoring
and stop conditions. Do not deploy until a separate human gate authorizes it.
```
