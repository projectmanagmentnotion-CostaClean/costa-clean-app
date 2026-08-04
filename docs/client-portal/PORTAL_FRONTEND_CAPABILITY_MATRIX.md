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
| Profile | read-only profile summary | partial | contract pending for review workflow UI | Can render the current account context now. |
| Profile | reviewed-change request StepFlow | partial | backend contract exists as source design | Frontend can render the flow shell and safe states now. |
| Properties | property list / property detail | partial | narrow read contract expected | Only authorized client-scoped properties may appear. |
| Properties | reviewed-change request StepFlow | partial | backend contract exists as source design | Must keep IDs opaque in the visible UI. |
| Services | service history | foundation only | future gate | No service mutation in this sprint. |
| Documents | invoice/document overview | foundation only | future gate | No private document download until the signing boundary is verified. |
| Security | account security / MFA-ready messaging | implemented | real | UI only; enforcement remains outside this slice. |
| Help | help / support entry points | foundation only | future gate | Should not imply support-side admin access. |

## Frontend-only responsibilities

- render safe loading, empty, error and conflict states
- keep route isolation between `/portal` and CRM
- preserve mobile-first navigation
- share preview and production components
- avoid any direct canonical-table access from the browser

## Non-goals for this sprint

- invoice signing and private document delivery
- service request mutations
- production writes
- new Supabase schema or policy changes
- CRM navigation changes

