# AGENTS.md

## Mandatory Read Order Before Any Code Change

Every AI agent, Codex session, or automated coding assistant working in this repository must read these documents before modifying any file:

1. `docs/UX_APP_MANUAL.md`
2. `docs/CODEX_WORKFLOW.md`
3. `docs/APP_QUALITY_GATES.md`
4. `docs/APP_TRANSFORMATION_ROADMAP.md`

No code change starts before those four documents are read and understood.

## Mandatory Working Rules

- Codex must diagnose the real current implementation before touching code.
- Codex must propose a plan before modifying files.
- Codex must work in small, safe, reviewable changes.
- Codex must preserve routes, Supabase, auth, invoices, quotes, clients, services, and critical logic unless the prompt explicitly requires changing them.
- Codex must avoid blind coding, speculative rewrites, and unrelated refactors.
- Codex must document risks found during the diagnosis phase when they are outside the sprint scope.
- Codex must execute `npm run lint` and `npm run build` before closing each work block.
- Codex must create a commit and push the current branch after closing each approved work block.

## Product Direction

The app must follow a modern, minimalist, mobile-first, intuitive UX with StepFlow for important flows.

Core principles:

- One screen equals one decision.
- One block equals one intent.
- One primary button equals one clear consequence.
- Mobile-first is a real constraint, not a responsive afterthought.
- Minimalism is functional, not decorative.
- StepFlow is required for complex or high-friction flows.

## Scope Preservation

Unless explicitly requested in the prompt, agents must not:

- modify Supabase schema, policies, queries, or integration contracts
- change routes or navigation contracts
- alter authentication behavior
- rewrite invoice, quote, client, or service business logic
- introduce new dependencies
- refactor unrelated files

## Definition Of Ready For Any Implementation Sprint

Before editing functional code, the agent must confirm:

- mandatory documents were read
- current repo state was inspected
- the target behavior was diagnosed from real code
- the intended change is scoped
- risks and non-goals are explicit

## Definition Of Done For Any Implementation Sprint

Before closing, the agent must confirm:

- changes stay inside the requested scope
- critical logic remains protected unless explicitly targeted
- `npm run lint` passes
- `npm run build` passes
- git diff is reviewable
- commit is created
- push is completed
