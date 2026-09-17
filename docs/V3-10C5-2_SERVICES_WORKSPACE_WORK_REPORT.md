# V3-10C5.2 — Services, Service Workspace and Work Report

Status: `CLOSED / CERTIFIED`

Starting HEAD: `d2b199ae176c05832c92f9cdbd32299a2cc8994b`

## Authoritative scope

C5.2 applies the C5.1 operational hierarchy to Services/Jobs, the full-screen
Service Workspace and the existing Work Report. It improves scan order, makes
the invoice-eligibility branch legible, preserves relationship navigation and
keeps the Work Report an operational summary rather than accounting truth.
C5.3 Alerts, C5.4 Closings and C5.5 Recurring Plans were not started.

## Findings and implementation

- `O-C5-P2` Services hierarchy: `FIXED` for the authorized presentation
  surface. Search and filters precede supporting KPIs; the create action is
  singular; rows remain compact and the supporting summary is visually quiet.
- `O-C5-P2` workspace primary branch: `FIXED`. The existing
  `canCreateInvoiceFromJob` decision remains authoritative and the workspace
  explains whether the next action is `Crear factura`, `Ver factura` or
  `Editar servicio` without adding an invoice shortcut.
- `O-C5-P3` technical identifiers: `FIXED`. Service relation fallbacks,
  accessible row names and Work Report filename/content fall back to human
  wording rather than job/client/property identifiers.
- `O-C5-P3` Work Report actions: `FIXED`. Download/share actions have a clear
  operational section, independent busy state and non-blocking status/error
  feedback. The report explicitly says it is not an execution certificate.

## Protected contracts

Unchanged: `saveJobWithLines`, `operationalWriteRpcPaths.updateJobStatus`,
`canCreateInvoiceFromJob`, service status values/transitions, client/property/
quote/invoice/payment navigation, duplicate invoice protection, Work Report
PDF generation, share/download delivery and all Supabase/auth/route contracts.
No business mutation was executed during QA.

## Static evidence

- Focused C5.2 tests cover report filename/status presentation, Services list
  hierarchy, invoice-eligible workspace wording, human-safe row fallback and
  existing invoice eligibility.
- C1/C2 and existing job contract tests remain green.

## Authenticated read-only QA

QA URL: `http://127.0.0.1:4178/?v3=1`
QA namespace: `costaclean-v3`

| Viewport | Services list | Service workspace | Overflow | UUID | Unicode | Legacy | Broken assets |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 320x568 | PASS — empty | N/A — no QA service row | 0 | 0 | 0 | 0 | 0 |
| 390x844 | PASS — empty | N/A — no QA service row | 0 | 0 | 0 | 0 | 0 |
| 768x1024 | PASS — empty | N/A — no QA service row | 0 | 0 | 0 | 0 | 0 |
| 1440x900 | PASS — empty | N/A — no QA service row | 0 | 0 | 0 | 0 | 0 |

The authenticated shell was confirmed. The replay recorded zero console
errors, page errors, failed critical requests, production requests,
production mutations and QA business mutations. No fixture or remote write
was introduced to manufacture a populated workspace.

## Remaining scope

C5 remains open. C5.3 Alerts, C5.4 Closings, C5.5 Recurring Plans and C5.6
cross-module certification remain not started.

## Independent review

A fresh detached Windows reviewer inspected the current C5.2 diff, protected
contracts, tests, documentation and sanitized runtime evidence and returned
`PASS`. Its artifact is `docs/V3-10C5-2_INDEPENDENT_REVIEW.md`. There are no
P0/P1 findings and no unresolved C5.2-blocking P2/P3 findings.
