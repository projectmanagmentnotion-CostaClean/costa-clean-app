# Costa Clean — UX Refinement R3 document preview parity

Status: R3 independently certified locally; Production deployment intentionally not performed.

## Scope and source-of-truth review

R3 was implemented from exact certified HEAD `6e62a029a25e2ec8c54ed30b72017cce5a66f19a` on branch `codex/v3-ux-refinement-r3-document-preview`.

The invoice and quote previews use the existing canonical A4 renderers:

- Invoice preview: `InvoiceDocumentA4`.
- Quote preview: `QuoteDocumentA4`.
- Invoice PDF output: `renderInvoiceDocumentPdf`.
- Quote PDF output: `renderQuoteDocumentPdf`.

`V3DocumentPreview` is the shared V3 shell for status, loading, error, A4 thumbnail and the existing open-document action. The invoice and quote adapters only hydrate their canonical lines and select the corresponding canonical renderer. No parallel `InvoicePreviewCard`, `QuotePreviewCard` or second financial HTML layout was introduced.

## Behavior and contracts

- Invoice and quote previews show real Costa Clean branding, document identity, client context, lines and totals from current application data.
- Invoice and quote workspaces keep their existing download and share actions. The quote workspace now also exposes the existing full document screen through the same open-document contract already used by invoices.
- Loading and line-fetch errors stay inside the shared preview surface and do not remove the open-document action.
- Empty line data remains an honest empty document state; it is not replaced with invented content.
- The full document screens remain scrollable and expose the complete canonical document. PDF capture now slices the canonical A4 canvas into as many A4 pages as required, so long documents are not clipped to page one.
- PDF dependencies remain lazy (`html2canvas` and `jspdf`). No dependency was added. The shared preview chunk is approximately 9.49 kB raw / 3.70 kB gzip in the production build.

## Responsive and accessibility review

The authenticated visual matrix passed at 320x568, 390x844, 430x932, 768x1024, 820x1180, 834x1194, 1024x1366, 1280x800, 1440x900 and 1920x1080. The preview uses the existing document-thumbnail primitive, A4 ratio, semantic V3 tokens, visible status, an explicit open action and no hover-only behavior.

Fresh isolated Edge QA result: 1320 checks passed, 0 failed. No text overlap, horizontal overflow, duplicate logo or shell/page-context regression was reported. No authenticated QA flow submitted a business write.

## Deterministic verification

- Focused R3/document tests: 29 passed.
- Full test suite: 903 passed, 4 skipped.
- Agent validator: 294/294 PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS.
- Supabase schema, policy, auth and business data contracts: unchanged.

## Independent review result

1. Home/document presentation is consistent with a real business application: PASS.
2. A user can understand document identity, client, lines and totals quickly: PASS.
3. The preview is useful rather than decorative because it is the canonical document surface: PASS.
4. Metrics and document values come from current application data and canonical models: PASS.
5. VAT and totals retain the existing business presentation and are not re-derived by the preview: PASS.
6. No duplicate or double-counted financial data was introduced: PASS.
7. Mobile preview remains usable at 320px without a permanently expanded report: PASS.
8. Tablet and desktop use the available width while preserving A4 composition: PASS.
9. No R1 design-system violation was found: PASS.
10. No regression to existing invoice/quote open, download or share behavior was found: PASS.

### Severity matrix

`P0 = 0`  
`P1 = 0`  
`P2 = 0 known reproducible product defects`  
`P3 = 0`

## Final certification verdict

`R3_STATUS = PASS`  
`R3 = CLOSED / CERTIFIED`  
`R4 = READY`  
`PRODUCTION_DEPLOY = NO`  
`PRODUCTION_BUSINESS_WRITES = 0`  
`SUPABASE_PRODUCTION_MUTATIONS = 0`

## Next sprint

R4 — Leads KPI layout and responsive information cards. R4 is ready only; it is not implemented by this certification.
