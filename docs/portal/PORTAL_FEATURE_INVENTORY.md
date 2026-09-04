# Portal Feature Inventory

Audit date: 2026-09-04

Status vocabulary: `DONE` means present in current source; `PARTIAL` means present but not fully evidenced end-to-end; `MISSING` means not found in the audited source.

| Feature | Designed | Implemented | Connected | Tested | QA verified | Production claim | Evidence / next action |
|---|---|---|---|---|---|---|---|
| Auth login/logout/session | yes | yes | Supabase Auth adapter | yes | local contract coverage | not claimed | `src/portal/auth/*`, `PortalAuthScreen.tsx`; run authenticated browser QA against the intended deployment |
| Recovery and MFA | yes | partial | partial | partial | not complete | not claimed | lifecycle contracts exist, but full recovery/MFA production journey is not evidenced |
| Invitation, pending, suspended, revoked, roles | yes | partial | Edge/member contracts | yes | contract-focused | not claimed | `portal-member-actions`, access machine, membership contracts; complete real invite lifecycle QA in a disposable target |
| Client home/dashboard | yes | yes | portal read adapter | yes | local UI tests | not claimed | `PortalWorkspaceView.tsx`, `portalWorkspaceData.ts` |
| Profile and account context | yes | yes | portal read adapter | yes | local tests | not claimed | profile sections and `selfAccessContext` tests |
| Properties list/detail/change request | yes | yes | scoped portal reads and reviewed changes | yes | local/contract evidence | not claimed | `PortalPages.tsx`, reviewed-change helpers; verify real boundary with two synthetic clients |
| Services list/detail/history | yes | yes | portal read adapter | yes | CP-3B.3 closeout docs | not claimed | `PortalServiceArea.tsx`, service contract docs |
| Requests / StepFlow / `pending_review` | yes | yes | service Edge Function and narrow contract | yes | contract and idempotency tests | not claimed | `portal-service-actions`, request migrations; repeat cross-client and idempotency proof in QA |
| Invoices list/detail | yes | yes | read-only portal projection | yes | local tests | not claimed | `portalReadApi.ts`, workspace data |
| Private invoice PDFs / signed access | yes | partial | invoice download Edge Function | yes | contract docs | not claimed | `portal-invoice-download`; verify expiry and private bucket behavior in isolated QA |
| Members/admin/member/revoke | yes | partial | member Edge Function | yes | contract coverage | not claimed | `portal-member-actions`; real invitation delivery remains a separate gate |
| Security/session/access | yes | yes | Supabase Auth plus membership predicates | yes | security packages | not claimed | `accessMachine.ts`, `RLS_SECURITY_SPEC.md`, manifest suites |
| Legal/terms/consent/versioning | yes | partial | portal legal copy/contracts | yes | documentation-level | not claimed | `LEGAL_CONTENT_SPEC.md`, `LEGAL_COMPLIANCE_MATRIX.md`; product/legal review still required |
| Portal route isolation | yes | yes | separate portal bootstrap/surface | yes | boundary tests | not claimed | `bootstrapPortal.tsx`, `portalBoundary.test.ts`; deployment route/domain certification pending |
| E2E browser journey | yes | partial | local QA harnesses | yes | partial | not claimed | current repo has unit/contract and local proof runners; authenticated deployment E2E is not certified here |

## Overall state

The portal is a real implemented surface, not a scaffold and not a missing project. The strongest evidence is the current source plus 91-suite baseline. The weak points are deployment-level certification, real invitation delivery, recovery/MFA journey coverage, and isolated two-client end-to-end proof.

