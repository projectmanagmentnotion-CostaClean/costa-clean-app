# Costa Clean — N5.1 Foundation Closeout

## Scope result

N5.1 adds a Smart Capture entry surface to the V3 Gastos module while preserving `+ Nuevo gasto`. Users can take a photo or select a PDF/image, validate it locally, create an owner-scoped QA capture session, upload to the private receipt bucket, and inspect an explicit pending-review shell. A failure offers the existing manual flow.

No OCR, AI extraction, paid provider, automatic expense creation, financial calculation, Supabase Production change, Production deployment, DNS change or N5.2 work is included.

## Safety evidence

- File contract: zero-byte, MIME, size and filename traversal checks are covered by `expenseCaptureFoundation.test.ts`.
- Identity: SHA-256 is calculated from file bytes; storage paths are deterministic and do not include the user filename.
- Idempotency: session creation accepts an idempotency key and duplicate document rows are guarded by `(capture_session_id, sha256)`.
- Private storage: QA bucket `expense-receipts` is private, limited to 10 MiB and restricted to authenticated active internal staff with owner/session path checks.
- No false extraction: the review shell labels every business field as pending manual review.
- No false creation: capture API/component contract tests assert there is no expense insert/update path.
- Cleanup: failed attach removes the deterministic object; cancel calls the QA cancellation RPC and removes returned paths.

## Verification status

The branch is based on the certified product RC and is intentionally not a Production release candidate. The QA schema was inspected read-only before implementation; the QA project already contained the N5.1 migration contract, so no duplicate DDL was applied by this work block. QA had zero capture sessions, documents and capture objects at inspection time. Production was not queried or mutated.

Focused and full quality commands must be recorded below after execution:

```text
FOCUSED_TESTS = PASS (7 tests)
FULL_TESTS = PASS (584 tests / 149 files)
AGENTS = PASS (294/294)
TYPESCRIPT = PASS (npm run build)
LINT = PASS
BUILD = PASS
SECRET_SCAN = PASS (repository scan; no new secret or service-role client path)
DIFF_CHECK = PASS
REAL_BROWSER_VISUAL_QA = BLOCKED (local preview had no configured public Supabase environment; no auth/session state copied)
```
