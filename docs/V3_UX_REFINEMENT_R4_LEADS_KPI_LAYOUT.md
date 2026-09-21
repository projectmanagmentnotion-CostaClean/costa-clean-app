# Costa Clean — UX Refinement R4 Leads KPI layout

Status: R4 independently certified locally; Production deployment intentionally not performed.

## Original visual problem

The Leads page exposed the commercial summary as loose vertically stacked text. The values were correct, but `Activos`, `Nuevos` and `Presupuestados` did not read as a compact business-information block and wasted available width.

R4 stays limited to the Leads commercial summary and its composition with the existing search, tabs and list. It does not redesign CRM, lead lifecycle, creation/edit flows or list architecture.

## Lead KPI source audit

All counts are derived from the already loaded `LeadListItem[]` array through `buildLeadKpiCounts`. No new Supabase query, schema, RLS, mutation or lifecycle rule was added.

| KPI | Source | Status/filter | Current QA count | UI location |
| --- | --- | --- | ---: | --- |
| Activos | `LeadListItem[]` | not archived and status is not `won` or `lost` | 2 | Leads KPI summary |
| Nuevos | `LeadListItem[]` | not archived and `status === 'new'` | 1 | Leads KPI summary |
| Contactados | `LeadListItem[]` | not archived and `status === 'contacted'` | 1 | Leads KPI summary |
| Presupuestados | `LeadListItem[]` | not archived and `status === 'quoted'` | 0 | Leads KPI summary |

Counts are data-dependent; the QA environment had two active/open leads, one new, one contacted and zero quoted. Archived leads are excluded exactly as the existing Leads page semantics required. Won and lost leads remain valid lifecycle states but are not active opportunities.

The `visibles` value remains the filtered result count after search and selected tab. It is placed with search/list context and is not treated as a commercial KPI.

## Shared KPI and visual system

R4 extends the existing governed `V3Kpi` primitive with semantic tone classes and `V3KpiGroup` with a layout class hook. Leads uses one shared four-card summary:

- Active/open: deeper financial/brand-blue treatment.
- New: primary cyan accent treatment.
- Contacted: restrained information tint.
- Quoted: financial/brand-blue tint.

All values use V3 tokens and existing semantic palette roles. No module-private hex colors, decorative icon layer, random warning/success colors or new data semantics were added. Values remain readable without relying on color alone.

## Responsive rules

- Desktop 1280/1440/1920: four equal cards in one row using the available content width.
- Tablet 768/820/834/1024: four equal cards in one row; cards remain at least 164px wide in the authenticated QA data.
- Mobile 320/390/430: compact two-column grid; card widths were 131px, 166px and 186px respectively in authenticated QA.
- Page order is deliberate: header and primary action, commercial KPI summary, search plus filtered visible count, status tabs, then the existing list.
- Tabs remain filters and retain keyboard arrow/Home/End behavior. KPI cards are informational and do not duplicate filter interaction.
- The existing list architecture is unchanged; R5 remains responsible for long-list containment.

## QA matrix

Specific authenticated Edge Leads QA: 10/10 PASS at 320x568, 390x844, 430x932, 768x1024, 820x1180, 834x1194, 1024x1366, 1280x800, 1440x900 and 1920x1080.

Validated: KPI alignment and hierarchy, brand differentiation, search placement, visible-count semantics, tab layout, list start position, touch-safe controls, text wrapping, contrast and horizontal overflow. No business write was submitted.

The existing authenticated matrix also passed 1320/1320 checks across the same required viewport set for the supported global/module views.

## Independent review

1. Leads KPIs are materially easier to scan: PASS.
2. Horizontal space is used better: PASS.
3. Mobile density is appropriate: PASS.
4. Brand color meaning is visible and tokenized: PASS.
5. Colors are differentiated without decorative noise: PASS.
6. KPI values match current lead-state semantics: PASS.
7. Search, visible count and tabs have clear separate roles: PASS.
8. No lead functionality regressed: PASS.
9. R1–R3 contracts remain preserved: PASS.
10. Leads no longer reads like a plain document: PASS.

### Severity matrix

`P0 = 0`  
`P1 = 0`  
`P2 = 0`  
`P3 = 0`

## Quality gates

- Focused R4 tests: 15 passed.
- Full test suite: 907 passed, 4 skipped.
- Agent validator: 294/294 PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS.

## Explicit pending backlog

R4 does not certify these global debts:

- `UX-01A` — stronger global contrast/color governance.
- `UX-02A` — premium dashboard chart polish.
- `UX-03B` — single global brand lockup; the existing sidebar-plus-header lockup remains outside R4 scope.
- `UX-03C` — global header/navbar differentiation.
- `UX-07A` — strict no-scroll monostep StepFlows.

## Final certification verdict

`R4_STATUS = PASS`  
`R4 = CLOSED / CERTIFIED`  
`R5 = READY`  
`PRODUCTION_DEPLOY = NO`  
`PRODUCTION_BUSINESS_WRITES = 0`  
`SUPABASE_PRODUCTION_MUTATIONS = 0`

## Next sprint

R5 — Contained and large-list architecture. R5 is ready only; it is not implemented by this certification.
