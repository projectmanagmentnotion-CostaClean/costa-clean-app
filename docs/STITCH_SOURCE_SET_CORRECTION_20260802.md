# Stitch definitive source-set correction

**Status:** authoritative correction for the prototype branch  
**Date:** 2026-08-02

## Definitive package set

The user confirmed that the definitive Google Stitch handoff consists of four ZIP packages:

1. `stitch_costa_clean_crm_system.zip`
2. `stitch_costa_clean_crm_system (1).zip`
3. `stitch_costa_clean_crm_system (2).zip`
4. `stitch_costa_clean_crm_system (3).zip`

Do not wait for packages `(4)` or `(5)`. Their expected existence came from an earlier incorrect assumption.

## Canonical validation

The package count is accepted only when the combined archive inventory contains exactly:

- 58 `code.html`
- 59 `screen.png`
- 5 `DESIGN.md`

The preparation script generates `stitch-source-report.json` automatically. The report is not an additional source file and must not be requested from the user.

## Priority rule

Where any earlier prototype document says “six ZIP packages,” this correction supersedes only that package-count statement. All other visual, functional-invariance, QA and implementation requirements remain valid.

## Safety

The four ZIP packages, extracted source and generated report remain local under `.project-agent/private/` and must never be committed or uploaded.
