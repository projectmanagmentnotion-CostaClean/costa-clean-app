# Portal Frontend Capability Matrix

Date: 2026-08-04

This matrix tracks what the portal frontend can render now, what is backed by a
verified contract, and what must remain a safe UI-only surface.

| Area | Surface | Current implementation state | Backend status | Notes |
|---|---|---:|---:|---|
| Auth | login / recovery / reset | implemented | real | Uses isolated portal auth lifecycle and neutral messages. |
| Auth | session expired / no access | implemented | real | Must remain non-enumerating. |
| Workspace | home summary | implemented | real/preview | Preview uses synthetic data; production uses narrow adapter results. |
| Account | account overview | implemented | real | Must never reveal internal membership IDs. |
| Profile | read-only profile summary | implemented | real/preview | Renders current account context and the reviewed-change form. |
| Profile | reviewed-change request StepFlow | implemented | backend contract exists as source design | Uses public receipts and no direct canonical writes. |
| Properties | property list / property detail | implemented | narrow read contract | Uses backend `publicRef` values surfaced by the property RPCs and client-scoped cards only. |
| Properties | reviewed-change request StepFlow | implemented | backend contract exists as source design | Keeps internal IDs opaque in the visible UI. |
| Services | service history / detail | implemented | real/preview | Uses public service references and read-only lists only. |
| Service requests | list / detail / StepFlow / cancel | implemented | backend contract in repo | Uses public request references, idempotent submit and optimistic cancel. |
| Documents | invoice/document overview | foundation only | future gate | No private document download until the signing boundary is verified. |
| Security | account security / MFA-ready messaging | implemented | real | UI only; enforcement remains outside this slice. |
| Help | help / support entry points | foundation only | future gate | Should not imply support-side admin access. |

## Frontend-only responsibilities

- render safe loading, empty, error and conflict states
- keep route isolation between `/portal` and CRM
- preserve mobile-first navigation
- share preview and production components
- avoid any direct canonical-table access from the browser
- keep property routes and receipts public-ref based
- preserve reviewable receipt/history surfaces for profile and property changes
- preserve public service and service-request references in the portal UI

## Non-goals for this sprint

- invoice signing and private document delivery
- production writes
- new Supabase schema or policy changes
- CRM navigation changes
