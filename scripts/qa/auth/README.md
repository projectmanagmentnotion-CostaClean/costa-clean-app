# Authenticated Visual QA Harness

This repo does not currently ship with `playwright` as a direct dependency, so the local authenticated QA harness uses a dedicated Edge/Chrome profile plus Chrome DevTools Protocol.

The harness is designed to stay safe:

- no auth product changes
- no route changes
- no persisted business writes
- no token or cookie contents printed to terminal
- no private screenshots committed to git

## Files

- `scripts/qa/setup-auth-state.mjs`
- `scripts/qa/run-authenticated-visual-qa.mjs`
- `scripts/qa/auth/cdpHarness.mjs`

## Local ignored artifacts

- `.auth/costa-clean-storage-state.json`
- `.auth/qa-browser-profile/`
- `qa-screenshots/private/`
- `qa-reports/private/`

## Setup flow

1. Run `npm run qa:auth:setup`
2. A dedicated QA browser window opens against the local app URL
3. Log in manually
4. The script detects the authenticated shell and saves local metadata

Important:

- the saved JSON file contains only metadata about the local harness
- real auth state remains inside the ignored browser profile directory

## QA flow

1. Run `npm run qa:visual:auth`
2. The script reuses the ignored QA profile
3. It audits the supported `?view=` surfaces across mobile, tablet, and desktop
4. It saves local screenshots and JSON/Markdown reports under ignored paths

## Limitations

- This harness depends on a local Edge/Chrome installation with CDP support.
- Manual login is still required the first time a QA profile is created.
- If the local app is not reachable on `127.0.0.1:4173` or `127.0.0.1:5173`, the harness will stop with an explicit error.
