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
