# V3-8 — GLOBAL E2E / RELEASE CERTIFICATION

Status: `OPEN — V3-8_AUTH_REQUIRED`

## Run identity

- Commit tested: `2dac426`
- Branch: `codex/app-v3-mobile-first-redesign`
- QA project: `kpvvydthlxupjjqqdpxy`
- Production project: `wfxnwfcdjainpojhbdri` — prohibited
- Test timestamp: `2026-09-14 16:47 Europe/Madrid` (unit/integration run)
- Harness: `playwright.v3-release.config.mjs` + `tests/e2e/v3-release.spec.mjs`
- Browser: Playwright managed Chromium, executable present locally
- QA writes: `NONE`

## Concrete blocker

The Playwright authentication gate launched the existing ignored QA profile
from `.auth/costaclean-v3/costa-clean-storage-state.json` and reached the V3
login surface instead of an authenticated shell. The reproducible result was:

`V3-8_AUTH_REQUIRED: manual authenticated QA login is required in the ignored QA profile`

No password, token, cookie, storage secret or credential was requested,
printed, copied or added to the repository. The release matrix stops at this
gate until the user completes manual QA login in the existing QA profile.

## Exact viewport matrix

The cases are implemented but were not executed after the auth gate stopped:

| Requested viewport | innerWidth | innerHeight | clientWidth | clientHeight | scrollWidth | scrollHeight | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| 390x844 | N/A | N/A | N/A | N/A | N/A | N/A | NOT RUN — auth gate |
| 768x1024 | N/A | N/A | N/A | N/A | N/A | N/A | NOT RUN — auth gate |
| 1280x800 | N/A | N/A | N/A | N/A | N/A | N/A | NOT RUN — auth gate |
| 1920x1080 | N/A | N/A | N/A | N/A | N/A | N/A | NOT RUN — auth gate |

No viewport is classified as PASS without measurements.

## Release matrix

| Area | Result | Evidence/status |
|---|---|---|
| QA backend | NOT CERTIFIED | Authenticated release run did not start |
| Production request guard | PASS | Executable guard rejects `wfxnwfcdjainpojhbdri` |
| Home, Alerts, Closings | NOT RUN | Auth gate |
| Leads, Clients, Properties | NOT RUN | Auth gate |
| Quotes, Services, Invoices | NOT RUN | Auth gate |
| Payments, Expenses | NOT RUN | Auth gate |
| Client media | NOT RUN | Read-only release smoke pending auth |
| Recurring plans | NOT RUN | Read-only client-workspace smoke pending auth |
| More/navigation | NOT RUN | Auth gate |
| Deep links/back/relations | NOT RUN | Auth gate |
| Auth/reload/loading/recovery | BLOCKED | Manual QA login required |
| PWA/service worker | NOT RUN | Auth gate |
| Accessibility/keyboard | NOT RUN | Auth gate |
| Reduced motion | NOT RUN | Auth gate |
| Console/page errors | NOT CERTIFIED | Auth gate; no release claim |
| Unexpected failed requests | NOT CERTIFIED | Auth gate; no release claim |
| Legacy runtime / UUID / Unicode / `window.confirm` | NOT RUN | Auth gate |

The harness is read-only by design. It does not create, edit, settle, upload,
change status, save closings or acknowledge alerts. Existing write
certifications from V3-3B through V3-7B are intentionally reused rather than
repeated without new QA-write authorization.

## Quality gates

Repository quality gates for this block passed:

- Unit/integration tests: `702 passed | 4 skipped`
- Release E2E: `1 failed at authentication gate; 4 viewport cases did not run`
- Lint: `PASS`
- Build: `PASS`
- Diff: `PASS`
- Worktree: `CLEAN` after the harness/docs commit and push

## Re-entry condition

After manual login in the ignored QA profile, rerun:

```text
npx playwright test --config playwright.v3-release.config.mjs
```

Only a fresh run with measured `390x844`, `768x1024`, `1280x800` and
`1920x1080` results may move this document to `CLOSED / CERTIFIED`. V3-9 is not
started. Production deployment, migration, storage, auth mutation, DNS and
feature-flag activation remain prohibited.

## Verdict

`V3-8 OPEN — manual authenticated QA login required in the existing ignored QA profile.`
