# Costa Clean — UX Operativo + Mobile V2 Roadmap

## Phase 0 — audit and design contract

- [x] Audit invoice/quote lists, shared row actions, toolbars, PDF outputs, shell and navigation.
- [x] Record preserved contracts, risks and non-goals.
- [ ] Audit leads and review persistence before Block A4.
- [ ] Define SelectionController/eligibility contracts before Block B.
- [ ] Produce the complete mobile architecture and module wireframes before Block C/D.

## Block A — quick operational actions

- [x] A1: direct invoice PDF download from list.
- [x] A2: direct quote PDF download from list.
- [x] A3: one-click invoice settlement through the existing financial contract (implementation, authenticated partial-settlement QA, reload persistence and cleanup PASS).
- [ ] A4: persistent lead review state, separate from commercial status.
- [ ] A5: reusable quick-action pattern after A1/A2 evidence.

## Later blocks

- Block B: selection engine, eligibility-aware bulk actions and module adoption.
- Block C: dedicated mobile shell, back stack and deep-link behavior.
- Block D: mobile screens with wireframes, implementation and viewport QA.
- Block E: final regression matrix across real flows and protected domains.

## Exit gates per block

Implementation, persistence/reload where applicable, tests, lint, build, responsive QA, regression review, commit, push and clean working tree. Existing unrelated user changes must remain excluded from the block commit.
