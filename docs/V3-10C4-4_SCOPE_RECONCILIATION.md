# V3-10C4.4 — Scope reconciliation

Status: `C4.4 CLOSED / CERTIFIED`

This record classifies the complete preserved worktree for the C4.4 closure.
It does not authorize C4.5, a remote action, or a payment mutation.

| Group | Files | Reason within the reviewed closure | Protected boundary |
| --- | --- | --- | --- |
| Payment presentation | `src/v3/payments/V3PaymentsPage.tsx`, `V3PaymentRow.tsx`, `V3PaymentWorkspace.tsx`, `paymentPresentation.ts` | C4.4 scan order, local origin filter, provenance wording and one invoice action | No persistence, settlement, reconciliation or generated-record edit path changed. |
| Payment regression tests | `src/v3/payments/V3PaymentRow.test.ts`, `V3PaymentWorkspace.test.ts`, `paymentPresentation.test.ts` | Assert presentation wording, relation/action uniqueness and generated-record boundary | They use local data only. |
| Responsive/quality guard | `src/v3/design/v3.css`, `scripts/quality/v3DesignGuardian.test.mjs` | The C4.4 mobile control layout fixes the 320px action-grouping finding and pins its shared contract | No global redesign or route change. |
| Independent runner companion | `scripts/ops/run-project-continuation-agent.mjs`, `scripts/ops/run-project-continuation-agent.test.mjs` | The detached reviewer uses exact process-scoped Git trust, private candidate storage and owned-process cleanup. This is tooling only and is committed separately from product presentation. | No product, Supabase, QA or production path. |
| Versioned sandbox package | `scripts/client-portal/cp2b_sandbox_compat_v6.mjs`, `run-cp2a5-sandbox-proof.mjs`, `cp2bSandboxCompatibilityV6.test.mjs`, `cp2b_qa_package_v6.manifest.json` | CP-2A.5/V6 replaces the incompatible direct frozen-child sandbox invocation with a hash-verified compatibility proof | V3/V4/V5 and their `package.json` hash remain unmodified; no remote execute/preflight exists. |
| Documentation | `docs/V3-10C4-4_PAYMENTS_REFINEMENT.md`, finance findings/plan/roadmap and client-portal roadmap/CP-2A.5 guide | Records the precise C4.4 and V6 evidence/status | Private QA and reviewer artifacts remain ignored. |

## Explicit exclusions

- `PaymentCreateFlow`, `savePaymentAndRefreshInvoice`, settlement/reconciliation
  code, `transfer_auto` data semantics, Supabase and production are unchanged.
- C4.5 Expenses and all later C4/C5 implementation remain not started.
- No QA fixture, business-data write, credential, browser profile or private
  artifact is part of this worktree.

## Commit separation

The independent-runner companion is an infrastructure commit. C4.4 Payment
presentation and CP-2A.5/V6 are committed separately after their applicable
independent gate and host validation pass, preserving reviewable history.
