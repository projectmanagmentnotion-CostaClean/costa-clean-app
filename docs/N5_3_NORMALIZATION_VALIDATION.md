# N5.3 Normalization and Validation Foundation

N5.3 converts an immutable N5.2 `ExtractionProposal` into a deterministic normalization proposal before supplier matching, duplicate detection or human confirmation.

## Invariants

- The N5.2 proposal is copied and preserved as `extraction`; `rawValue`, extracted values, provider confidence, source and evidence are never rewritten.
- The core is pure, provider-independent and side-effect free. It performs no network, Supabase, browser, clock or random operations.
- Provider confidence and validation status are separate. `READY_FOR_REVIEW` never means accounting truth and there is no `CONFIRMED` state.

## Policies

Decimal strings are parsed with exact `bigint` arithmetic. Locale separators are accepted only when deterministic; a single separator followed by three digits is ambiguous. Addition, subtraction, comparison and absolute difference do not use JavaScript floating point. Reconciliation uses an explicit maximum difference of `0.01`.

Dates normalize to `YYYY-MM-DD`, validate the real calendar and reject ambiguous day/month ordering. Two-digit years are unsupported. Currency is normalized to `EUR` only for explicit `EUR`, `eur` or `€`; missing and unknown currency are not defaulted.

Invoice numbers are trimmed conservatively and remain strings, preserving meaningful prefixes, suffixes, zeroes, slashes and hyphens. NIF/NIE/CIF checksums are deterministic, but tax-id validation never performs supplier matching. Foreign formats remain `UNKNOWN_FORMAT` candidates.

VAT lines remain first-class. Rates are validated as decimal strings in the `0..100` range without a Spain-only allowlist. Negative monetary values are allowed, including credit notes. Discounts and withholding produce `COMPLEX_ADJUSTMENT` rather than forcing a simple net-plus-tax identity. Insufficient values produce `INSUFFICIENT_DATA`; mismatches are never repaired by rewriting extracted totals.

## Review boundary

`READY_FOR_REVIEW`, `NEEDS_ATTENTION` and `BLOCKED` are derived from stable machine-readable issues. Human confirmation belongs to N5.5. Supplier identity, aliases, matching and duplicate detection belong to N5.4.

**N5.3 output is a normalized validation proposal, not accounting truth.**

## Handoff

N5.4 may consume normalized candidates for supplier matching and duplicate checks. N5.5 may present the proposal for explicit human confirmation. Neither phase may reinterpret the preserved N5.2 evidence as an automatic accounting write.
