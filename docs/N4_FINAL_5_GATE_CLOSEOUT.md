# N4/N1 Final QA Runtime Recertification — Realtime Startup-Race Fix

Status: **PASS**  
Date: 2026-09-24  
Reviewed source start: `a1e04292faf0db66f29dd205a11d1aa969a74673`  
Runtime fix commit: `feb347fdf7198bf1eb23c98b398c47cc1ddea1ec`

## Scope and boundary

This closeout covers the authorized QA runtime recertification for project
`kpvvydthlxupjjqqdpxy` after the realtime startup-race fix. Production was not
accessed or mutated. No schema, migration history, RLS, grant, or CP51F change
was performed.

QA authentication used the private local QA environment and a guarded,
non-mutating internal-staff probe. Secrets, tokens, cookies, raw websocket
frames, and private reports are intentionally excluded from this record.

## Read-only prestate

- Obsolete recurring tables and RPCs: absent.
- Recurring plans: `0`.
- Recurring jobs: `0`.
- Final recurring generator RPC: present.
- `jobs` and `job_lines`: present in `supabase_realtime`.
- Shared root client/property fixtures: preserved.

## Runtime evidence

Test A was `NOT_OBSERVED_NATURALLY`; the deterministic local race contract
passed. Test B used two independent authenticated browser contexts. The
observer reached websocket readiness before the writer, and the writer then
generated exactly one synthetic job through the supported N4 flow.

- Job: `JOB-1979bec9-705f-47f3-ab92-5ff12a547d83`.
- Observer ready: `2026-09-24T13:45:55.152Z`.
- Writer completed: `2026-09-24T13:45:57.116Z`.
- Realtime event: `2026-09-24T13:45:57.324Z`.
- Rendered: `2026-09-24T13:45:58.588Z`.
- Subscription ready before write: `YES`.
- Trigger: `REALTIME`.
- Manual reload: `NO`.
- Database job rows: `1`; duplicate live rows: `0`.
- Writer-to-event: `208 ms`; event-to-render: `1264 ms`; writer-to-render: `1472 ms`.
- Sanitized websocket diagnostics: 2 sockets, 1 sent frame, 5 received frames,
  1 join request, 1 join acknowledgement, 0 join errors.

Exact cleanup removed the run-owned job, lines, and plan. A second read-only
verification found zero recurring plans/jobs and preserved the shared root
fixtures. Test A fixture residue: `0`; Test B fixture residue: `0`; N1 fixture
residue: `0`; second-verification cleanup actions: `0`.

## Source and validation

The realtime fix queues the existing view-domain refresh only after
`SUBSCRIBED`, preserves the existing refresh queue/debounce and lifecycle
cleanup, and does not introduce polling. The readiness harness is sanitized and
now handles text, wrapped, compact-array, and binary websocket frames without
publishing frame contents.

- Affected contract slice: `13` files, `62` tests — PASS.
- `npm run qa:agents` — PASS (`160/160`).
- `npm run lint` — PASS.
- `npx tsc -b --pretty false` — PASS.
- `npm run build` — PASS.
- `git diff --check` — PASS.
- Independent read-only review: PASS, P0/P1/P2/P3 = `0/0/0/0`.

The global suite remains separately classified as
`NOT_PROVABLE_HISTORICAL_PORTAL_INSTABILITY`: its failures are the known
unrelated portal timeout/fixture cases plus a historical zero-test CP51F file;
no affected N4/N1 or realtime test failed.

## Final status

- N4/N1 runtime recertified: `YES`.
- QA data fixture writes: authorized, synthetic, run-owned, and fully cleaned.
- Unrelated QA mutations: `0`.
- Production mutations: `0`.
- Production deployment: `NO`.
- CP51F work: deferred and untouched.
