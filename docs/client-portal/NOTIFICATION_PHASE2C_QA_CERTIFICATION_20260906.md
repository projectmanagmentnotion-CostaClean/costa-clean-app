# Costa Clean - Notification Phase 2C QA Certification

Date: 2026-09-06
Verdict: `OPEN - BLOCKED BEFORE REMOTE EXECUTION`

## Target

Requested QA target: `CostaClean QA` / `kpvvydthlxupjjqqdpxy`

Requested production target: `CostaClean` / `wfxnwfcdjainpojhbdri`

The current Supabase CLI session was checked with local CLI `2.109.1`.
`npx supabase projects list` returned only project `Coachai` with ref
`zlblnezbbiimapruazvc`; neither requested Costa Clean ref was listed. The
connected account therefore does not currently provide the required live
identity evidence. Per the exact QA authorization, execution stopped here.

Target confidence: `FAIL` for this session.

## Execution status

No remote command was run against either Costa Clean ref after the identity
check. Specifically, no schema inspection, migration, secret configuration,
VAPID generation, Edge deployment, scheduler, Auth user, synthetic business
row, reminder, dispatcher invocation, browser subscription or production
operation was performed.

| Gate | Status |
| --- | --- |
| Notification schema | NOT_EXECUTED |
| Claim RPC | NOT_EXECUTED |
| QA VAPID | NOT_EXECUTED |
| Producer Edge QA | NOT_EXECUTED |
| Dispatcher Edge QA | NOT_EXECUTED |
| Browser subscribe/reload | NOT_EXECUTED |
| Manual transport push | NOT_EXECUTED |
| Click/deep link | NOT_EXECUTED |
| Producer/dedupe E2E | NOT_EXECUTED |
| Preference/disable | NOT_EXECUTED |
| QA cleanup | NOT_EXECUTED |
| Production modified | NO |
| Scheduler | NOT ACTIVATED |

## Local status

- Baseline before this block: `66a15b0b353af941468622a9ba84be88a8fea201`.
- Local producer and dispatcher code are present.
- `npm ci`: PASS. npm reported existing dependency audit findings; no package manifest was changed.
- `npm test`: PASS (`590 passed`, `4 skipped`).
- `npm run lint`: PASS.
- `npm run build`: PASS.
- No credentials, VAPID keys, subscription endpoints, browser profiles or screenshots were committed.

## Resume requirement

Authenticate the Supabase CLI with an account that can list both Costa Clean
projects, then rerun `npx supabase projects list`. It must show exactly the
requested QA and production refs before any remote command. Production must
remain prohibited; the next block must use explicit
`--project-ref kpvvydthlxupjjqqdpxy` guards.

## Controlled close reconciliation - 2026-09-07

The previous blocked status is superseded by the following QA-only evidence.
Production was not modified.

- QA target confidence: `PASS`; the active subscription was joined to
  `qa.financial.runner@qa.invalid` and matched user id
  `9eb7b22d-0849-4122-b90b-5dd50b1784a4`.
- Controlled final reminder: `sent`, destination
  `/?view=jobs&filter=completed_without_invoice`, one delivery attempt with
  HTTP `201`.
- Native click/deep-link: `PASS` based on the user-confirmed click and the
  observed QA URL `http://127.0.0.1:4174/?view=jobs&filter=completed_without_invoice`.
- Duplicate dispatch: `PASS` at the dispatcher level; no second controlled
  delivery was observed.
- Preference suppression: `NOT CERTIFIED`; the controlled preference run did
  not produce sufficient evidence of suppression and is not claimed as pass.
- UI disable: `BLOCKED`; the authenticated QA tab was no longer available when
  the UI action was required, and the re-opened tab showed the login screen.
- QA cleanup: `PASS`; 16 Phase2C synthetic reminder markers were removed and
  synthetic reminder residue verified as zero. Non-synthetic reminders and the
  QA user were not modified.
- Local gates: `npm test` passed (`592 passed`, `4 skipped`), `npm run lint`
  passed, and `npm run build` passed.

Current verdict: `OPEN - BLOCKED AT PREFERENCES AND UI DISABLE`.
Product approval remains `PENDING`. This document does not authorize
extraction or production execution.

## Authenticated deep-link retest - 2026-09-07

- Root cause confirmed in the served `4174` preview: the bundle had been
  built with the production Supabase target instead of QA.
- The app was rebuilt with `vite build --mode qa`; the served bundle contains
  `kpvvydthlxupjjqqdpxy.supabase.co` and no production project ref.
- The per-tab in-memory Supabase auth lock was removed in commit
  `398525b`; transient bootstrap/network errors no longer clear persisted
  auth storage. Explicit `SIGNED_OUT` cleanup remains intact.
- Manual normal-Chrome retest: the notification destination loaded the
  authenticated invoice detail for `QA_PUSH_FINAL_INV_0907` at
  `/?view=invoices&filter=overdue&invoice=QA_PUSH_FINAL_INV_0907`.

Updated verdict: `OPEN - BLOCKED AT PREFERENCES AND UI DISABLE`.
Authenticated deep-link: `PASS`. Product approval remains `PENDING`.

## Roadmap disposition - 2026-09-07

Phase 2C is now `DEFERRED / UI REDESIGN DEPENDENCY`. The already observed
push, click, authenticated deep-link, dedupe, dispatcher, producer, 410
handling, and cross-tab auth evidence is preserved. Preferences UI,
notification disable UI, and their final certification/cleanup remain
deferred until the approved app redesign provides those interfaces.

This deferral does not close Phase 2C, does not change product approval, and
does not block the main Costa Clean roadmap. No producer, dispatcher, QA data,
or production project was modified for this disposition.
