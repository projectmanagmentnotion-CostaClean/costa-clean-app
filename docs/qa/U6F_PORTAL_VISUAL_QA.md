# COSTA CLEAN - U6F Portal Visual QA

Date: 2026-09-04

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

Static and contract verification passed after the styling changes: lint, build,
full Vitest suite and disposable CP-2A local proof. The sandbox visual harness
was attempted but stopped before navigation because its reused target identity
was `127.0.0.1` instead of the expected `CostaClean`; no screenshot or remote
authenticated session was produced. Browser screenshots are kept out of the
repository.
