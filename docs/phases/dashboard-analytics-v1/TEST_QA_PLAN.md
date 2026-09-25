# Test & QA Plan — Dashboard Analytics V1

Status: future test plan only. No implementation tests are executed during strategic planning.

## 1. Unit tests — ranges

Test:

- 30-day range;
- 3/6/12-month ranges;
- current year;
- custom;
- previous-period construction;
- leap day;
- month/year rollover;
- one-day custom range;
- invalid range;
- date-only timezone stability.

## 2. Unit tests — money and comparison

Test:

- normal values;
- zero;
- negative values where accepted by the helper;
- cent rounding;
- large values;
- previous = 0;
- both periods = 0;
- null/unavailable;
- percentage direction.

## 3. Unit tests — Facturado

Fixtures:

- invoices inside/outside range;
- cancelled invoice;
- archived/deleted invoice;
- boundary dates;
- decimal totals.

Expected cancellation result must match H0 decision and be cross-checked against the approved source contract.

## 4. Unit tests — Cobrado

Fixtures:

- multiple payments for one invoice;
- payments across boundaries;
- partial and final payment;
- origin types;
- zero/decimal amounts where valid.

The sum must use payment date, not invoice issue date.

## 5. Unit tests — Pendiente

Fixtures:

- unpaid;
- partial;
- paid;
- overpaid/clamped;
- cancelled;
- payment after selected invoice period;
- tolerance around 0.009.

Reconcile with `buildInvoicePaymentSummary` and closing deterministic semantics.

## 6. Unit tests — Gastos

Fixtures:

- real canonical categories;
- fiscal year/quarter override;
- expense-date fallback;
- cancelled state according to H0;
- unknown legacy category;
- zero/negative edge values if persistence permits them.

## 7. Unit tests — invoice financial states

Exact expected states:

- pending;
- partially_paid;
- paid;
- cancelled.

No overdue state.

## 8. Unit tests — temporal series

Test:

- empty buckets are explicit zero or omitted according to chart contract;
- correct day/week/month bucket assignment;
- deterministic sort;
- period boundaries;
- multiple domains in same bucket;
- no duplicate counting.

## 9. Derivable metric tests

If M10/M11 are approved:

### New clients

- creation boundary;
- archived/deleted behavior;
- lead-converted case according to approved semantic.

### Top clients

- grouping by client_id;
- tie ordering;
- missing client label fallback;
- percentage total;
- no UUID display fallback.

## 10. Integration tests

Use local/QA fixtures, not production mutations.

Validate pipeline:

```
domain arrays
→ analytics adapter
→ metric model
→ chart series
→ visible component values
```

Cross-check sample periods against:

- `useDashboardMetrics`;
- `buildClosingSummary`;
- `buildClosingDeterministicSummary`;
- `buildInvoicePaymentSummary`.

Any intentional semantic divergence must be explicitly approved and tested.

## 11. Component tests

Cover:

- KPI;
- comparison badge/text;
- period selector;
- custom range error;
- primary chart wrapper;
- invoice state block;
- expense category block;
- ranking;
- loading;
- empty;
- error;
- partial data;
- unavailable/unverified state.

## 12. E2E / Playwright

Authenticated future flow:

1. open V3 Home;
2. confirm default period;
3. read primary KPIs;
4. change 30d/3m/6m/12m/year;
5. open custom range and apply a valid range;
6. verify comparison copy;
7. exercise chart tooltip by pointer and keyboard/touch equivalent where applicable;
8. use KPI drill-down;
9. return to Home and preserve/recover expected state;
10. verify dark/light if toggle is available;
11. verify no console/page errors.

Production E2E: read-only only.

## 13. Responsive visual QA

Capture/inspect:

- 320;
- 375;
- 390;
- 430;
- 768;
- 820;
- 1024;
- 1280;
- 1440;
- 1920.

At minimum, repository canonical anchors must have authenticated visual evidence.

Check:

- no overflow;
- chart labels;
- legend;
- tooltip;
- KPI wrapping;
- priority strip;
- safe area;
- bottom navigation clearance;
- filters;
- activity rows;
- dark/light;
- loading/empty/error.

## 14. Accessibility

Manual/automated mix:

- headings and landmarks;
- form labels;
- focus visible;
- focus order;
- Escape/focus return;
- 44px targets;
- contrast;
- color-independent status;
- reduced motion;
- chart textual equivalents.

## 15. Performance

Record:

- bundle before/after chart dependency;
- network requests on Home;
- payload volume;
- data-ready sequence;
- render/re-render count for period switch;
- chart resize stability;
- mobile main-thread behavior under representative dataset.

No arbitrary performance PASS without baseline evidence.

## 16. Security regression

Verify:

- no service role;
- no new public read;
- current auth session used;
- no RLS weakening;
- raw IDs absent from visible output;
- no private storage URL exposure through analytics.

## 17. Production-like validation

Before real production release, use authenticated QA/staging/local profile and representative data.

Do not create production invoices/payments/expenses/clients solely for dashboard tests.

## 18. Failure policy

- Do not hide failed tests.
- Do not skip a failing analytics test to close the sprint.
- Do not replace a failing semantic assertion with snapshot-only visual approval.
- A missing environment is BLOCKED/N/A with evidence, never PASS.
