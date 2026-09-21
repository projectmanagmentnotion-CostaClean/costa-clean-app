# Costa Clean — V3 visual polish certification

## Scope

This sprint certifies the global visual identity and premium polish layer on exact base `a2e8a62c68c9b17d42d3827cd4c27252f96d1a72`, branch `codex/v3-ux-refinement-visual-polish`. It does not change routes, authentication, Supabase schemas, write APIs, business rules, or production deployment state.

The review closed the remaining R5 visual debts: the blue brand palette and contrast hierarchy, the executive trend visualization, the single-logo architecture, navigation/header separation, branded presentation states, invisible-but-functional scrollbars, viewport reachability, and the known `ipad-820/home` header finding.

## Independent review result

The review covered dashboard and global shell information architecture, KPI provenance, invoiced/collected/outstanding/expenses/estimated result, VAT output/input/estimate labels, growth comparison, trend chart, operational KPIs, attention queue, period selector, empty and partial data, semantic colors, dashboard depth, mobile/tablet/desktop composition, one-logo governance, header/page-context separation, accessibility, and misleading financial-label regressions.

The implementation is real-data-only for dashboard values. The trend chart remains a governed custom inline SVG implementation with responsive axes, Facturado/Cobrado/Gastos series, area treatment, EUR tooltip, keyboard-focusable points, accessible title/description, and reduced-motion compatibility. No chart dependency was introduced.

`V3BrandLockup` is the canonical brand surface. The rail owns the desktop/tablet brand; the top bar owns it only when the mobile rail is absent. The screen title remains page context, separate from the brand. The branded preloader/error presentation uses the same lockup without changing auth, routing, or loading semantics.

The `ipad-820/home` issue was traced to preserved scroll position across view changes. The shared shell now resets scroll to the top when `currentView` changes, preserving the existing responsive shell contract without a breakpoint-specific workaround.

## Authenticated visual evidence

Fresh direct authenticated Playwright coverage passed `96/96` checks across Home, Invoices, Quotes, Clients, Properties, Leads, Jobs, and Expenses at:

- Mobile: 320, 390, 430.
- iPad/tablet: 768, 800, 820, 834, 900, 1024.
- Desktop: 1280, 1440, 1920.

The matrix confirmed one visible logo per viewport, no horizontal overflow, functional final-content reachability, chart presence and semantics, responsive navigation composition, invisible scrollbar presentation, and no text overlap. The existing historical R5 runner report is not used as fresh evidence; the direct matrix is the certification evidence for this sprint.

## Quality gates

- Focused shell/design tests: 8 passed.
- Full tests: 918 passed, 4 skipped.
- Agents: 294/294 passed.
- Lint: PASS.
- Build: PASS.
- `git diff --check`: PASS.
- Production deploy: NO.
- Production business writes: 0.
- Supabase mutations: 0.
- Business logic changes: 0.

## Severity matrix

P0 = 0  
P1 = 0  
P2 = 0  
P3 = 0

No reproducible defect remains in the reviewed scope. In particular, the prior `ipad-820/home` P2 finding is resolved at the shared-shell root cause and passes the fresh authenticated matrix.

## Final certification verdict

PASS — R5.5 global visual identity and premium polish is certified on the reviewed branch. Home reads as a real business dashboard, the business state is scannable, the chart is decision-supporting rather than decorative, financial values retain their existing data provenance, VAT estimates remain honestly labeled, and no duplicate financial representation or R1 regression was found.

Visual polish closes the global identity/chart/shell debts listed in the R5 roadmap. R6 is READY but remains NOT IMPLEMENTED; the next sprint is strict monostep StepFlow architecture for long forms.
