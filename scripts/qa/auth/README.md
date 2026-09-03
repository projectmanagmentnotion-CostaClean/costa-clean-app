# Authenticated Visual QA Harness

The local authenticated QA harness uses Playwright with an ephemeral browser context and a real Supabase Auth session. The legacy CDP harness remains available for older flows, but is not required by the Playwright certification runner.

The harness is designed to stay safe:

- no auth product changes
- no route changes
- no persisted business writes
- no token or cookie contents printed to terminal
- no private screenshots committed to git

## Files

- `scripts/qa/setup-auth-state.mjs`
- `scripts/qa/run-authenticated-visual-qa.mjs`
- `scripts/qa/auth/cdpHarness.mjs` (legacy)
- `scripts/qa/playwright-financial-cert.mjs`

## Local ignored artifacts

- `.auth/costa-clean-storage-state.json` (legacy)
- `.auth/qa-browser-profile/` (legacy)
- `qa-screenshots/private/`
- `qa-reports/private/`

## Setup flow

1. Provision the public QA config in `.env.qa.local` and expose the QA Auth credentials through the runner secret store.
2. Run `npm run qa:playwright:financial`.
3. The runner authenticates through Supabase Auth, keeps session state in memory, and creates a fresh temporary context per viewport.

Important:

- the saved JSON file contains only metadata about the local harness
- real auth state remains inside the ignored browser profile directory

## QA flow

1. Run `npm run qa:playwright:financial` for the stable headless certification harness.
2. It audits the supported `?view=` surfaces across mobile, tablet, and desktop.
3. It saves local screenshots only on failure and JSON reports under ignored paths.

## Limitations

- If the local app is not reachable on `127.0.0.1:4173` or `127.0.0.1:5173`, the harness stops with an explicit error.
- QA credentials are read from process environment only and are never written to reports, code, or browser profiles.
