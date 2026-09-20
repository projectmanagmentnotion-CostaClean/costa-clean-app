# Costa Clean V3 — Recovery requirement ledger

Status: Phase 2.1 candidate ledger. Items remain explicit; no unimplemented work is silently marked complete.

| Requirement | State | Evidence / next gate |
|---|---|---|
| Full iPhone viewport | FIXED | 320x568, 390x844 and 430x932 included in authenticated audit; no overflow. |
| iPad/tablet layout | IMPLEMENTED_PENDING_CERT | 768x1024, 820x1180, 834x1194 and 1024x1366 audited; fresh independent review required. |
| Canonical Costa Clean branding | IMPLEMENTED_PENDING_CERT | Existing V3 shell uses canonical logo and visible name. |
| Large/prominent desktop/tablet identity | IMPLEMENTED_PENDING_CERT | Rail and topbar identity present at audited desktop/tablet widths. |
| Real logo | FIXED | Existing `brandAssets.logoPrimary` asset reused. |
| Visual hierarchy / Figma-level separation | PENDING | Existing shell refinement only; broader Stitch evidence is not available. |
| Properties tab strip | IMPLEMENTED_PENDING_CERT | Existing route/surface audited; deeper interaction certification remains separate. |
| Leads tab strip | IMPLEMENTED_PENDING_CERT | Existing route/surface audited; deeper interaction certification remains separate. |
| Status pills | IMPLEMENTED_PENDING_CERT | Existing V3 surfaces audited; no new business-state changes. |
| StepFlows | IMPLEMENTED_PENDING_CERT | Existing flows preserved; no new flow invented in this phase. |
| StepFlow progress | IMPLEMENTED_PENDING_CERT | Existing flow contract preserved; dedicated interaction certification remains separate. |
| Field reachability | IMPLEMENTED_PENDING_CERT | Keyboard/focus assertions pass; write-flow certification remains separate. |
| Long-list containment | IMPLEMENTED_PENDING_CERT | Responsive audit passes without overflow; data-volume stress remains separate. |
| Simplified alerts | IMPLEMENTED_PENDING_CERT | Alerts surface navigated read-only. |
| Duplicate resolution | PENDING | Requires dedicated business-flow QA. |
| Invoice settlement correctness | REQUIRES_QA_WRITE | Settlement QA write not executed. |
| Expense document functionality | REQUIRES_QA_WRITE | Expense document write certification not executed. |
| Invoice preview | IMPLEMENTED_PENDING_CERT | Existing invoice surface navigated; dedicated preview interaction remains separate. |
| Closings AI | REQUIRES_AI_PROVIDER | Provider-backed behavior not executed. |
| Home financial KPIs/charts | IMPLEMENTED_PENDING_CERT | Dashboard surface navigated read-only. |
| Expenses/Vendors | BLOCKED_BY_STITCH | New visual screens must wait for approved Stitch evidence. |
| Receipt/photo AI extraction | BLOCKED_BY_STITCH | New visual flow and provider behavior pending Stitch/provider gates. |
| Vendor matching | BLOCKED_BY_STITCH | New visual flow pending Stitch evidence. |
| Vendor history | BLOCKED_BY_STITCH | New visual workspace pending Stitch evidence. |
| Expense duplicate prevention | REQUIRES_QA_SCHEMA | Requires approved QA data/schema certification. |
| Stitch requirement | BLOCKED_BY_STITCH | Current status: `STITCH UI DESIGN PENDING`. |

Production and Production Supabase remain untouched. QA business writes and schema changes remain unexecuted.

## Phase 2.2B update

| Requirement | State | Evidence / next gate |
|---|---|---|
| Tablet full-width shell correction | FIXED_PENDING_CERT | Corrected `.app-shell--v3` stretch behavior; dashboard smoke rechecked at 768, 820, 834 and 1024 widths. |
| Complete authenticated 10-viewport matrix | PENDING_REAUDIT | This session did not rerun all major surfaces at every viewport. |
| QA/Production network isolation proof | NOT_VERIFIED | Browser channel did not expose a verifiable request ledger. |
| Independent reviewer | NOT_RUN | Must inspect the final committed SHA before certification. |

Current continuation blocker: `Network provenance unavailable and full viewport
matrix not reliably observable through the current Chrome control channel`.
The authenticated QA profile is restored and read-only smoke is complete for
Home, Clients, Properties, Leads and invoice detail/preview; this does not close
the full certification gate.

## Phase 2.3 deterministic harness update

| Requirement | State | Evidence / next gate |
|---|---|---|
| Exact 10 viewport proof | FIXED | Playwright page metrics matched requested width/height and client width/height for all 10 viewports. |
| Sanitized network ledger | FIXED | 26,050 request entries captured privately; query strings and sensitive headers/bodies are excluded. |
| QA-only Supabase routing | CERTIFIED | 3,160 QA requests; 0 production and 0 unknown Supabase requests. |
| QA business writes | CERTIFIED | 0 business writes; auth/session POSTs classified separately; 0 unknown mutations. |
| Runtime error ledger | CERTIFIED | 0 failed requests, 0 page errors and 0 console errors. |
| Full authenticated read-only matrix | CERTIFIED_PENDING_REVIEW | 11/11 runner tests PASS across the 10 viewports and existing surface scope; Phase 2.5 remediation now requires a fresh independent review. |

## Phase 2.5 P1 remediation update

| Requirement | State | Evidence / next gate |
|---|---|---|
| Job/quote to invoice prefill | FIXED_PENDING_INDEPENDENT_CERTIFICATION | Explicit job/quote selection handlers restore client, property, notes and editable lines; focused prefill tests pass. Source review found no P0/P1. |
| Client workspace editing | FIXED_PENDING_INDEPENDENT_CERTIFICATION | Request-token keyed canonical detail card opens the persisted client edit flow. Source review found no P0/P1. |
| Property workspace editing | FIXED_PENDING_INDEPENDENT_CERTIFICATION | Request-token keyed canonical detail card opens the persisted property edit flow. Source review found no P0/P1. |
| Fiscal-period note synchronization | FIXED_PENDING_INDEPENDENT_CERTIFICATION | Period-keyed draft lookup isolates persisted notes across period switches; focused note tests pass. Source review found no P0/P1. |
| Payment over-collection and outstanding synchronization | FIXED_PENDING_INDEPENDENT_CERTIFICATION | Shared guard covers create/edit/duplicate-override paths; legacy sync uses outstanding amount; focused tests and exact-HEAD QA pass. Independent authenticated replay remains blocked by profile isolation. |
| Focused regression coverage breadth | OPEN_P2 | Source/focused coverage is present, but live interaction coverage and independent exact-HEAD replay remain incomplete. |

Phase 2.4 review result was `PHASE 2.3 BLOCKED — P1 protected-contract
regressions found by independent reviewer`. Phase 2.5 remediation is
implemented at exact HEAD `7b80795fa2cdad6dde4fb50cd86e523457dca3d0`. The
independent review path found and closed the payment duplicate-override P2, with
P0/P1 remaining at zero. Final certification still returns
`BLOCKED` because the final detached authenticated replay now passes, but the
isolated dependency installation has an incomplete `core-js@3.50.0` tree and
Vite reports 84 unresolved imports during build. Two non-blocking P2
interaction-coverage gaps also remain. The persistent QA profile was not
mutated, auth was not bypassed, and no QA or production business write or
Supabase schema mutation was performed.

Final detached evidence at exact HEAD `782d7c5` is 11/11 replay tests across
all 10 viewports, 26,398 requests, 3,158 QA Supabase requests, zero
production/unknown Supabase requests, zero QA business writes, zero production
writes, zero unknown mutations, zero failed requests, zero page errors and zero
console errors. Focused tests pass 32/32, agents pass 294/294, lint passes and
the diff check is clean.
