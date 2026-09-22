# Post-V3 N2.0B — zero-cost QA readiness

## Scope and safety state

This readiness-only sprint is on `codex/post-v3-n2-atomic-business-integrity`, starting at certified N1.1B HEAD `b833563c4519838695983a2585d988a32f434b6b`. No paid Supabase branch/project was created. The only database target for this sprint is CostaClean QA (`kpvvydthlxupjjqqdpxy`); Production (`wfxnwfcdjainpojhbdri`) was not queried or modified. No N2 product workflow was changed.

The QA-only migrations `n2_zero_cost_qa_readiness`, `n2_zero_cost_qa_readiness_hardening`, and `n2_zero_cost_financial_state_snapshot` were applied to the primary QA project. They install a read-only fixture plan, extend the existing fixture cleanup to exact `QA_N2_` client markers while preserving `QA_CERT_`, and add a fixed-scenario rollback harness. All three public RPCs require an active internal owner/admin, a JWT issuer exactly matching the QA Auth endpoint, use an empty `search_path`, and have execution revoked from `PUBLIC` and `anon`. The rollback harness contains no arbitrary SQL input and calls only the existing job, invoice, and transfer-settlement RPCs. The SQL linter's authenticated `SECURITY DEFINER` warnings for these three functions are expected from the intentional authenticated-admin-only RPC boundary; the explicit issuer, role and grant checks are documented above.

The migration changes QA schema/function definitions only. It did not create, update, or delete QA business rows. Production migrations and writes remain `0`; no paid resource or external provider was used.

## Baseline and cleanup preflight

Before enabling cleanup, a read-only exact-prefix scan found zero pre-existing `QA_N2_` candidates across the business IDs/names inspected. The aggregate baseline was:

| Table | Baseline rows |
|---|---:|
| Clients | 10 |
| Properties | 3 |
| Quotes | 4 |
| Jobs | 0 |
| Invoices | 8 |
| Payments | 0 |

The preflight relationship checks found zero missing property/client relations, quote/job/invoice property-client mismatches, payments without invoices, or billing lines without parents. These are the pre-fixture figures; the authenticated post-migration runner was not able to complete, so no claim is made that a fixture was seeded, removed, or baseline-restored.

## Runner and QA_N2 namespace

`npm run qa:n2:readiness` is read-only by default. It validates the configured URL against the exact QA project before creating a Supabase client or sending authentication credentials, then verifies the Auth-issued session issuer before calling the database readiness plan. It fails closed for Production, unknown refs, issuer mismatch, missing migrations/schema/RPCs, or any existing QA_N2 residue. `npm run qa:n2:certify` is the explicit fixture mode: it creates one draft-only synthetic client → property → draft quote → job → draft invoice graph, runs the rollback-only scenarios, cleans by run ID, repeats cleanup, then compares aggregate baseline and integrity invariants.

The synthetic client matcher requires both the reserved `QA_N2_CLIENT_<run>_` name prefix and the exact `qa_n2+<run>@qa.invalid` email marker. Descendants are found only through foreign-key relationships to that synthetic client; the existing `QA_CERT_<run>_` name-prefix behavior remains available for legacy cleanup. Deletes follow payment → invoice lines → invoices → recurring plans → job lines → jobs → quote lines → quotes → properties → clients. The dry-run returns only counts, not personal/business payloads.

The rollback helper has fixed `after_job`, `after_invoice`, and `after_payment` failure points inside PL/pgSQL exception subtransactions, plus a repeated-settlement idempotency scenario. It validates that temporary job/invoice/payment rows are absent afterward, current-year fiscal invoice and global payment counts are unchanged, the next available fiscal number is unchanged, and a canonicalized hash of every fiscal invoice ID/number/display-code/status mapping for the current year matches before and after. The invoice numbering implementation inspected on QA derives sequence values from transactional invoice rows and an advisory transaction lock; no fiscal sequence table/`nextval` is used by that path. This harness is installed but has not yet been invoked; concurrent settlement is not simulated.

## Verification status

- QA migrations recorded as `20260922132814 / n2_zero_cost_qa_readiness`, `20260922134255 / n2_zero_cost_qa_readiness_hardening`, and `20260922134529 / n2_zero_cost_financial_state_snapshot`. The installed rollback helper was read back from QA and verified to include the exact mapping hash, next-number invariant, and repeat-settlement check; `anon_execute=false`, `authenticated_execute=true`.
- QA Security/Performance advisors ran. Existing unrelated portal/RLS/function/index findings remain; the only findings directly naming this migration are the intentional authenticated `SECURITY DEFINER` endpoint warnings described above.
- Authenticated readiness was retried after adding pre-client exact-URL rejection and stopped at sanitized `N2_QA_AUTHENTICATION_FAILED`. No fixture operation was attempted. No authenticated QA session was available in the browser inventory; the Production app tab was left untouched.
- Focused readiness/migration tests: 18 passed. Full suite: 535 passed. Project agents: 294/294 PASS. Lint: PASS. TypeScript/build: PASS. `git diff --check`: PASS.
- Secret scan found no indicators in changed implementation files. Fresh independent review: P0=0, P1=0, P2=1, P3=0. The runner guard and exact fiscal-state snapshot pass source review; the remaining P2 is that settlement is tested sequentially for idempotency, not concurrently. Live fixture creation, cleanup idempotency, rollback execution, and baseline restoration remain unverified because QA authentication is unavailable. QA migration/function readback was confirmed separately by read-only queries.

## Verdict

`PAID_SANDBOX_CREATED=NO`, `ADDITIONAL_INFRA_COST=0`, `PRODUCT_LOGIC_CHANGES=0`, `PRIMARY_QA_BUSINESS_ROWS_CREATED=0`, and `PRODUCTION_MUTATIONS=0`. QA schema helpers were installed; no QA business records were created or mutated.

`N2_QA_READINESS_STATUS=BLOCKED` and `N2_READY=NO` until a legitimate active QA owner/admin session is restored locally, the explicit `--certify` run proves draft cleanup/rollback/zero residue/baseline restoration, and the remaining concurrent-settlement evidence gap is resolved or formally accepted. No commit or push was made because the certification gate did not pass.

## N2.0D live concurrency addendum (2026-09-22)

This addendum supersedes the earlier statement that authenticated QA was unavailable and that concurrency had not been run. The previously recovered legitimate visible Edge session was refreshed by the app's normal session flow; no password login or auth bypass was used. All live calls were restricted to QA project `kpvvydthlxupjjqqdpxy`; Production ref `wfxnwfcdjainpojhbdri` was rejected by the runner's pre-client project guard. No Production request, migration, or mutation was made.

Read-only concurrency preflight passed before fixture creation. The live canonical settlement definition contained the invoice `SELECT FOR UPDATE` serialization primitive. The baseline had 8 invoices, 0 payments, no `QA_N2_` fixtures, sequence state `last_value=109 / is_called=true`, fiscal mapping hash `470ea6d4e5805157c8eb0626ff08a992`, and real QA business-row digest `f0983c6b19a3551bb39ae9e4c88b4844`.

The authenticated runner created one uniquely tagged synthetic client → property → job → draft invoice. The QA-only invoice helper supplied non-empty placeholders before the INSERT triggers; the canonical trigger path persisted the record as `draft` with both invoice number and display code null. The sequence remained `109 / true` after insertion. Two separately instantiated authenticated Supabase clients issued the same canonical settlement RPC concurrently against that invoice. Their measured HTTP request intervals overlapped; exactly one $100 payment was created, the second request was a no-op, and overpayment was zero. The synthetic invoice became temporarily paid and received `2026-002 / INV-0002`; this was explicitly allowed for the fixture lifecycle.

The existing exact run-id cleanup removed six synthetic QA fixture rows (client, property, job, job line, invoice, payment); no real business row matched teardown. Repeating cleanup performed zero actions. Final readiness passed. The complete invoice fiscal mapping hash, invoice/payment counts, sequence value and `is_called` state, and real QA business-row digest matched the baseline; all QA_N2 client/property/job/invoice/payment counts were zero. Thus `FISCAL_NUMBERING_POLLUTION=0`, `FINANCIAL_TEST_RESIDUE=0`, `REAL_QA_BUSINESS_ROWS_CHANGED=0`, `BUSINESS_HARD_DELETES=0`, and `PRODUCTION_MUTATIONS=0` for this run. The six deletions are synthetic fixture teardown only.

At N2 close, the legacy `trg_set_invoices_codes` INSERT-time
`nextval('public.invoices_invoice_number_seq')` behavior was recorded as
`LEGACY_SEQUENCE_TRIGGER_DEBT=RECORDED_FOR_N3`. N3 subsequently retired that
trigger from the product numbering path while retaining the legacy function
and sequence for compatibility. See [N3 fiscal-numbering hardening](POST_V3_N3_INVOICE_NUMBERING_HARDENING.md).

N2.0D verification: focused suites passed 29/29 after the failure-path fix; full suite passed 546 tests across 140 files; project agents passed 294/294; lint passed; TypeScript/build passed; `git diff --check` passed; and the changed-file secret scan found zero indicators across 14 files. The local helper migration filename is `20260922143036_n2_concurrent_settlement_qa_support.sql`; the QA migration service recorded the applied migration as `20260922144144 / n2_concurrent_settlement_qa_support` (service-assigned timestamp). The existing readiness helper migration filename and earlier service-assigned migration-history entries likewise use distinct timestamps; do not repair remote history manually.

N3 path-safety addendum: these N2 fixture/readiness SQL sources are now stored under `supabase/qa-migrations/`, outside the product `supabase/migrations/` path. The QA migration history was not edited; service-assigned version/name mappings remain as listed above. See [N3 fiscal-numbering hardening](POST_V3_N3_INVOICE_NUMBERING_HARDENING.md) for the full migration-source ledger and separation proof.

Fresh independent N2.0D review initially found P2=1 on the failure-path cleanup race. After changing the runner to await both calls using `Promise.allSettled` and adding the deterministic in-flight-peer regression test, an independent follow-up review confirmed the finding closed and reported P0=0, P1=0, P2=0, P3=0. The full authenticated QA concurrency/cleanup lifecycle was rerun on the final runner version and passed with mapping, sequence, counts, and real-row digest restored. The reviewer notes the timing evidence proves overlapping client HTTP requests plus the live `SELECT FOR UPDATE` definition, not backend lock-wait timing; that matches the requested controlled-overlap evidence, and no extra finding was raised. `N2_QA_READINESS_STATUS=PASS`, `N2_READY=YES`. All pre-existing local N2.0B/C work was preserved; nothing was discarded.
