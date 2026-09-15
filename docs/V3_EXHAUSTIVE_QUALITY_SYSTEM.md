# V3 exhaustive quality system

## Purpose

V3-10A establishes the local review system used before future product slices. It coordinates visual quality, UX, responsive geometry, state coverage, brand, property media, interaction motion, performance and independent review without changing production or Supabase.

## Review order

The canonical order is in `AGENTS.md` under **Exhaustive Quality Review Order**. Profiles are manually invoked; automatic model invocation is disabled. The orchestrator cannot approve its own implementation.

## Evidence model

- `PASS`: the named command or live measurement ran and passed.
- `FAIL`: a reproducible application, test or contract failure exists.
- `BLOCKED`: required infrastructure, access or evidence is unavailable.
- `WAITING_FOR_STITCH`: the visual source is missing or ambiguous.
- A skipped or unexecuted check is never a PASS.

## Audit dimensions

Every surface is reviewed for identity and hierarchy, density, action clarity, loading/empty/error/success/permission/duplicate/cancel/recovery states, keyboard/focus/contrast/touch targets, deep links/back, safe areas, geometry, reduced motion, legacy reachability, brand usage and data-loss risk.

## Boundaries

V3-10A is local-only. It does not deploy, call production, execute SQL, alter Supabase schema/policies/data, create QA writes, change auth, or certify the exhaustive application audit itself. V3-10B is the later application-wide audit and is intentionally not started here.

## Systems installed

- `.github/agents/`: 25 manually invoked project profiles.
- `.agents/skills/`: Codex-facing skills for the 15 quality specialists plus the existing continuation skill.
- `config/project-agents.json`: manifest schema v2 with truthful extensions and profile hashes.
- `config/v3-quality-audit-matrix.json`: required surface and evidence matrix.
- `src/v3/brand/brandAssets.ts`: typed official brand inventory.
- `src/v3/properties/propertyMedia.ts`: local generic property media mapping with fallback.
