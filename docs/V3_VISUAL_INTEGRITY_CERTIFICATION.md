# Costa Clean V3 — Phase 2.2B visual integrity certification

Status: `BLOCKED — network isolation evidence and reliable full viewport matrix incomplete`.

## Candidate

- Starting SHA: `21ddc51f31308f5b217c70d9703ffe7c8dd0337f`.
- Current candidate: `5fd15f87db94b4a6156bd7a7475b862bc9715b83`.
- QA URL: `http://127.0.0.1:4178/?v3=1&view=dashboard`.
- Browser: existing persistent authenticated QA Chrome profile.
- No credentials, cookies, JWTs, tokens or screenshots with customer data were stored.

## Evidence completed

- `390x844`: PASS — V3 shell, brand, bottom navigation and usable controls visible.
- `768x1024`: PASS after correction — shell uses the available tablet width; no narrow centered canvas.
- `820x1180`: PASS after correction — full-width tablet composition.
- `834x1194`: PASS after correction — full-width tablet composition.
- `1024x1366`: PASS after correction — navigation rail and full-width content.
- `1280x800`, `1440x900`, `1920x1080`: PASS in dashboard smoke — rail, topbar, brand and wide content visible.
- `320x568`, `430x932`: PASS in dashboard smoke — mobile shell and bottom navigation visible.
- Automated visual governance: PASS (8/8).

## Certification limits

- The browser control surface did not expose a verifiable network-request ledger for this run. QA request count, QA write count and production request count are therefore `NOT VERIFIED`.
- The complete 12-surface × 10-viewport matrix was not rerun in this session. The dashboard shell smoke must not be represented as full product certification.
- Properties tabs, Leads tabs, StepFlows, long-list stress, invoice preview interaction, expense signed-document opening, Closing AI reachability and duplicate-resolution interaction remain `PENDING_REAUDIT`.
- Independent detached reviewer: `NOT RUN`.
- Latest continuation attempt: the existing authenticated QA Chrome session was
  restored successfully. Read-only smoke reached Home, Clients and client
  workspace, Properties and property tabs, Leads and lead tabs, and invoice
  detail/preview. No business write was executed.
- The Chrome channel still exposes no verifiable request ledger, and its
  viewport override did not reliably produce the required desktop CSS widths;
  the full 10-viewport certification therefore remains open.

## Visual findings

- Fixed in this phase: `.app-shell--v3` previously shrink-wrapped at tablet widths because the legacy grid container remained centered. V3 now explicitly stretches to the usable viewport width.
- No new Expenses/Vendors visual screens were introduced. `STITCH UI DESIGN PENDING` remains authoritative for those flows.
- No QA business writes, Supabase schema changes, production requests or deployments were performed.

## Verdict

`BLOCKED` until the complete authenticated matrix, environment-isolation evidence and independent reviewer are available against the final committed SHA.

The exact active blocker from the prior phase is closed by the Phase 2.3
deterministic runner below.

## Phase 2.3 deterministic certification

- Candidate under test: `fc2875079af8c96e8d65b9196dad1d4188750467`.
- Browser: stored Google Chrome executable and persistent QA profile selected
  from the ignored QA metadata; no cookies, tokens or storage contents were
  logged.
- Control method: Playwright persistent context with `executablePath` and
  profile path explicit.
- Result: `11 passed` (authentication gate plus the exact 10 viewport runs).
- Surface coverage: 13 primary surfaces per viewport, read-only workspaces,
  deep-link reload/back checks, More-sheet keyboard/focus checks and safe
  action-flow openings.
- Requested/actual viewport proof: all 10 equal exactly, including
  `window.innerWidth`, `window.innerHeight`, `documentElement.clientWidth` and
  `documentElement.clientHeight`.

| Requested | Actual | DPR | Overflow |
|---|---|---:|---|
| 320x568 | 320x568 | 1 | PASS |
| 390x844 | 390x844 | 1 | PASS |
| 430x932 | 430x932 | 1 | PASS |
| 768x1024 | 768x1024 | 1 | PASS |
| 820x1180 | 820x1180 | 1 | PASS |
| 834x1194 | 834x1194 | 1 | PASS |
| 1024x1366 | 1024x1366 | 1 | PASS |
| 1280x800 | 1280x800 | 1 | PASS |
| 1440x900 | 1440x900 | 1 | PASS |
| 1920x1080 | 1920x1080 | 1 | PASS |

- Network requests: `26,050` total across the 10 isolated runs; `3,160` QA
  Supabase requests; `0` production Supabase; `0` unknown Supabase.
- Writes: `0` QA business writes; `0` production business writes; `0`
  unknown mutations. Auth/session requests were classified separately.
- Runtime: `0` failed requests, `0` page errors, `0` console errors.
- Visual contract: full-width, spacing, buttons, status, typography,
  alignment, section contrast, grid, branding and responsive checks PASS in
  the runner; overflow and legacy runtime markers are zero.
- Pending scope remains truthful: Expenses/Vendors and genuinely new receipt,
  vendor matching/history and related screens remain `STITCH UI DESIGN PENDING`;
  settlement/expense business writes and provider-backed AI behavior were not
  executed.
