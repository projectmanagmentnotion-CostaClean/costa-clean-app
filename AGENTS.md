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
- Codex must validate visual mobile changes against the running app whenever the prompt requires visual QA or real iPhone behavior.
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

## Density Preservation Rules

When scaling any existing module, agents must preserve operational density and avoid UI inflation.

- Shared filters must stay compact, subtle, and secondary to search.
- Advanced filters must open in sheet/popover, never as a long permanent block under the search bar on mobile.
- List cards for clients, invoices, payments, properties, jobs, and similar entities must remain compact and scannable.
- Agents must not increase padding, nested wrappers, or stacked surfaces unless the extra layer creates a clearly different user decision.
- Detail screens must use the screen width efficiently and avoid `div inside div inside div` composition that creates box-heavy reading.
- Secondary sections such as document/context/admin blocks must be visually quieter than the primary operational action.
- Debug panels must suppress or replace the equivalent operational card instead of duplicating the same information twice.
- New UI work must prefer flattening and simplification over adding another card, banner, shell, or wrapper.

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
