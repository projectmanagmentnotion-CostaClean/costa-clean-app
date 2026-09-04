# AGENTS.md

## Mandatory Read Order Before Any Code Change

Every AI agent, Codex session, or automated coding assistant working in this repository must read these documents before modifying any file:

1. `docs/stitch/DESIGN_SYSTEM_CONSTITUTION.md`
2. `docs/stitch/DESIGN.md`
3. `docs/FRONTEND_GLOBAL_BLUEPRINT.md`
4. `docs/STITCH_FRONTEND_REALITY_ROADMAP_20260731.md`
5. `docs/UX_APP_MANUAL.md`
6. `docs/CODEX_WORKFLOW.md`
7. `docs/APP_QUALITY_GATES.md`
8. `docs/APP_TRANSFORMATION_ROADMAP.md`

No code change starts before those eight documents are read and understood.

## Mandatory Working Rules

- Codex must diagnose the real current implementation before touching code.
- Codex must propose a plan before modifying files.
- Codex must work in small, safe, reviewable changes.
- Codex must validate visual mobile changes against the running app whenever the prompt requires visual QA or real iPhone behavior.
- Live QA requests must stay visible by default so the user can watch the flow; headless execution is opt-in only.
- Codex must preserve routes, Supabase, auth, invoices, quotes, clients, services, and critical logic unless the prompt explicitly requires changing them.
- Codex must avoid blind coding, speculative rewrites, and unrelated refactors.
- Codex must document risks found during the diagnosis phase when they are outside the sprint scope.
- Codex must execute `npm run lint` and `npm run build` before closing each work block.
- Codex must create a commit and push the current branch after closing each approved work block.
- Codex must never commit `.auth/`, QA browser profiles, tokens/cookies, or private QA reports/screenshots.

## Product Direction

The app/platform must follow a modern, minimalist, mobile-first, intuitive UX with StepFlow for important flows.

Core principles:

- One screen equals one decision.
- One block equals one intent.
- One primary button equals one clear consequence.
- Mobile-first is a real constraint and the primary implementation/QA contract, not a responsive afterthought.
- Minimalism is functional, not decorative.
- StepFlow is required for complex or high-friction flows.
- **Approved Google Stitch references are the visual source of truth.** The repository architecture, business contracts and Supabase/security boundaries remain authoritative for behavior, data and security.
- `docs/stitch/DESIGN_SYSTEM_CONSTITUTION.md` governs every button, hero, card, spacing decision, typography treatment, form control, navigation pattern, overlay, state, media treatment and responsive rule. Agents may not invent private visual systems.
- `docs/stitch/DESIGN.md` is populated only from approved Stitch evidence. Missing visual evidence remains `WAITING_FOR_STITCH` rather than being designed by Codex.
- “Maritime Professional” describes Costa Clean's visual atmosphere, never maritime logistics, fleet operations or property-investment functionality.

## Stitch Fidelity And Mobile-First Guardrails

These rules are permanent for all public web, client portal and shared UI work:

- Stitch is not inspiration; approved Stitch frames must be implemented with material visual fidelity.
- Mobile Stitch is implemented and validated before tablet/desktop for each new visual screen.
- Mandatory visual QA anchors are `390x844`, `768x1024`, and `1440x900`; critical mobile surfaces should also fail safely at `320px` width.
- A desktop `PASS` can never compensate for a mobile `PARTIAL` or `FAIL`.
- All reusable visual values must use approved design tokens once extracted; arbitrary spacing, colors, radii, shadows, font sizes, button heights, icon sizes and motion values are prohibited outside documented exceptions.
- A shared token/component that is already Stitch-approved is locked. Global visual values cannot be changed to fix a single page without design evidence and regression QA.
- If a component or layout cannot be derived unambiguously from approved Stitch references and the design constitution, mark it `WAITING_FOR_STITCH` instead of inventing it.
- Accessibility/security exceptions must be documented and use the least visually divergent compliant implementation.
- Marketing surfaces may use expressive GSAP only when Stitch justifies it; portal surfaces use restrained functional motion.
- `prefers-reduced-motion` is mandatory.

## Density Preservation Rules

When scaling any existing module, agents must preserve operational density and avoid UI inflation.

- Shared filters must stay compact, subtle, and secondary to search.
- Advanced filters must open in sheet/popover, never as a long permanent block under the search bar on mobile.
- List cards for clients, invoices, payments, properties, jobs, and similar entities must remain compact and scannable.
- Agents must not increase padding, nested wrappers, or stacked surfaces unless the extra layer creates a clearly different user decision or Stitch explicitly requires it.
- Detail screens must use the screen width efficiently and avoid `div inside div inside div` composition that creates box-heavy reading.
- Secondary sections such as document/context/admin blocks must be visually quieter than the primary operational action.
- Debug panels must suppress or replace the equivalent operational card instead of duplicating the same information twice.
- New UI work must prefer flattening and simplification over adding another card, banner, shell, or wrapper unless Stitch specifically defines that surface.

## Cross-Module Mobile/iPad Guardrails

These rules are permanent and apply to all future authenticated app scaling:

- In mobile and iPad, one block should resolve with one visual surface, not card-inside-card composition.
- If a detail view needs identity, status, next action, facts, and support context, agents must flatten it before adding another wrapper.
- Shared shell headers and top navigation must be checked for real viewport overflow at `390x844` and `768x1024` in visual sprints.
- Any create or edit action in mobile/iPad must expose the first actionable field immediately after opening, preferably in overlay or StepFlow when that matches Stitch/product flow.
- If a debug or audit card exists for the same concept, the operational card must be hidden, replaced, or collapsed by default.
- Secondary actions should collapse into `Mas` before the layout grows extra rows of large buttons.
- Tablet is not desktop shrunk down: the shell and module header must respect viewport width and avoid inherited horizontal overflow.
- Interactive targets should be at least `44x44 CSS px` unless a documented semantic/native exception applies.
- No essential action may depend on hover.
- Sticky/fixed controls must respect safe areas and cannot cover forms, cookie/legal controls or primary actions.

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
- when visual implementation is in scope, the required Stitch reference exists or the work is explicitly limited to non-visual foundation

## Definition Of Done For Any Implementation Sprint

Before closing, the agent must confirm:

- changes stay inside the requested scope
- critical logic remains protected unless explicitly targeted
- Stitch-backed UI has visual QA evidence at required viewports
- mobile is not left partial when visual work is declared complete
- no arbitrary visual values bypass the design system without a documented exception
- `npm run lint` passes
- `npm run build` passes
- git diff is reviewable
- commit is created
- push is completed

## Project Agent Routing

Project agents are selected manually. They remain subordinate to this file and
must read the mandatory documents above before acting.

| Need | Project agent |
|---|---|
| continue the project | `project-continuation` |
| plan a gate | `implementation-planner` |
| implement an approved slice | `senior-fullstack-builder` |
| diagnose a reproducible bug | `bug-root-cause-investigator` |
| QA or E2E | `qa-e2e-specialist` |
| independent PR gate | `pr-quality-gate` |
| security and privacy | `security-privacy-auditor` |
| documentation and roadmap | `documentation-roadmap` |
| Supabase | `supabase-guardian` |
| economic and fiscal rules | `business-rules-test-engineer` |
| UX and accessibility | `frontend-ux-accessibility` |
| GSAP and performance | `performance-gsap-motion` |
| public SEO | `seo-local-structured-data` |
| release and deployment | `release-deployment-guardian` |
| enterprise agent architecture | `enterprise-agent-architect` |

- No agent replaces or weakens `AGENTS.md`.
- Invocation remains manual; automatic model invocation is disabled.
- The implementer never approves its own work.
- Production access is prohibited by default.
- Remote Supabase work requires a separate exact human authorization gate.
