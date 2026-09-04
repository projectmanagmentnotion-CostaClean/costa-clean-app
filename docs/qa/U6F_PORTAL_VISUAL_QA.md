# COSTA CLEAN - U6F Portal Visual QA

Date: 2026-09-04

## Execution Evidence

- Target: Vite dev server `http://127.0.0.1:5173/`
- Runner: `node scripts/qa/run-u6fc-synthetic-visual.mjs`
- Preview adapter: existing `src/portal/adapters/portalPreviewAdapter.ts`
- Scenarios: `login`, `recovery`, `reset`, `session_expired`, `without_access`,
  `pending_review`, `suspended`, `revoked`, `offline`, `active_admin` and
  `empty`, plus existing property, service and request route states.
- Evidence: `qa-reports/private/u6fc-synthetic-visual/latest.json` and private PNG captures.

| Viewport | Surface | Checks |
|---|---|---|
| 390x844 | login, home, property, documents | hierarchy, no overflow, 44px controls, bottom nav |
| 768x1024 | authenticated workspace | compact rail, content width, header alignment |
| 1440x900 | authenticated workspace | full rail, bounded content, readable density |
| 320x568 | auth and error states | no overflow, safe-area and focus behavior |

## Required state coverage

Login, recovery, reset password, session expired, no access, pending review,
suspended, revoked, loading, empty, recoverable error, services, requests,
properties, profile, security and read-only documents.

## Result

The official synthetic preview uses the real `portalPreviewAdapter` in the Vite
dev server at `http://127.0.0.1:5173/`. It verifies the title
`Área de clientes | Costa Clean`, the `CostaClean` target identity, portal root,
viewport overflow and control sizing across 100 route/state visits and private
screenshots. The final run passed all 100 visits at 320x568, 390x844, 768x1024
and 1440x900. Unexpected console errors: 0. Page errors: 0. Material visual
differences against the frozen portal masters: 0. Authentication is synthetic
and remote authenticated QA is intentionally not executed until U6G.

The external Google Fonts runtime import was removed. The approved Epilogue and
Manrope family declarations remain in the portal stylesheet with local/system
fallbacks, so third-party font requests during QA: 0.
