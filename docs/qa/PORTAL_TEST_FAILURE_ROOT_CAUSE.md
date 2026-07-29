# Portal Test Failure Root Cause

## Scope

This report closes the 16 deterministic client-portal test failures observed
on Windows from clean commit
`f7cfcca3b1e0bd9519bae5f0b414e489108c13c0`.

The investigation did not modify portal product behavior, Supabase schema,
migrations, authentication, invoices, payments, manifests, or frozen hashes.

## Original failure inventory

| ID | Suite | Test | Failure type | Source file | Expected artifact | Preliminary cause |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | CP-2A immutable package guards | has one unique new 14-digit migration and its frozen hash matches | SHA mismatch | `20260723160000_client_portal_security_boundary.sql` | CP-2A migration SHA | CRLF checkout changed byte hash |
| 2 | CP-2A.1 QA-compatible package | verifies hashes and rejects a tampered manifest | manifest validation | `run-cp2b-qa-v2.mjs` | CP-2B V2 manifest chain | first CRLF artifact stopped verification |
| 3 | CP-2A.1 QA-compatible package | reports private inputs only as status and redacts supplied values | runner exit status | `run-cp2b-qa-v2.mjs` | successful read-only preflight | preflight stopped on the same hash mismatch |
| 4 | CP-2A.3 bootstrap contract V4 | verifies every V4, V3, V2 and original hash plus the frozen migration | manifest validation | `run-cp2b-qa-v4.mjs` | CP-2B V4 frozen chain | CRLF checkout changed chained artifact hashes |
| 5 | CP-2A.3 bootstrap contract V4 | offers only non-mutating plan/preflight and blocks an unauthorized execute | runner result | `run-cp2b-qa-v4.mjs` | successful read-only preflight | preflight stopped on the same V4 hash mismatch |
| 6 | CP-3B.0 self access context contract | produces a sanitized source-only QA plan | runner exit status | `run-cp3b0-qa.mjs` | successful source-only plan | plan stopped on manifest hash verification |
| 7 | CP-3B.0 self access context contract | freezes every declared artifact at its exact SHA-256 | SHA mismatch | `20260728120000_portal_self_access_context.sql` | CP-3B.0 manifest | CRLF checkout changed byte hash |
| 8 | CP-3B.0 self access context contract | preserves the complete frozen CP-2B V5 chain | SHA mismatch | `cp2b_qa_package_v5.manifest.json` | CP-2B V5 manifest SHA | CRLF checkout changed manifest bytes |
| 9 | CP-3B.0A QA application V2 package | preserves the complete V1 and CP-2B immutable chains | frozen-chain validation | `run-cp3b0-qa-v2.mjs` | CP-3B.0 V1 and CP-2B chain | first CRLF V1 artifact stopped verification |
| 10 | CP-3B.0A QA application V2 package | freezes every new V2 artifact without a self-hash | package validation | `cp3b0_qa_package_v2.manifest.json` | CP-3B.0 V2 artifacts | validation stopped on the same V1 mismatch |
| 11 | CP-3B.2A reviewed change contract | adds one forward-only migration without altering frozen migrations | SHA mismatch | CP-2B and CP-3B.0 migrations | frozen migration SHAs | CRLF checkout changed byte hashes |
| 12 | CP-3B.2A reviewed change contract | rejects spoofed and production database targets before transport | wrong fail-closed reason | `run-cp3b2a-qa.mjs` | exact target rejection | earlier manifest mismatch correctly failed first |
| 13 | CP-3B.2A reviewed change contract | produces a sanitized source-only plan | runner exit status | `run-cp3b2a-qa.mjs` | successful source-only plan | plan stopped on manifest hash verification |
| 14 | CP-3B.2A reviewed change contract | freezes all declared artifacts and effects in the manifest | SHA mismatch | `20260728160000_portal_reviewed_change_contract.sql` | CP-3B.2A manifest | CRLF checkout changed byte hash |
| 15 | CP-3B.2A.1 QA application V2 package | preserves the immutable CP-3B.2A, CP-3B.0 and CP-2B chains | frozen-chain validation | `run-cp3b2a-qa-v2.mjs` | three immutable package chains | first CRLF V1 artifact stopped verification |
| 16 | CP-3B.2A.1 QA application V2 package | freezes every new V2 artifact without a self-hash | package validation | `cp3b2a_qa_package_v2.manifest.json` | CP-3B.2A V2 artifacts | validation stopped on the same V1 mismatch |

## Reproducibility

Classification: `ENVIRONMENT_DEPENDENT`.

- Windows runtime: Node `v24.12.0`, npm `11.6.2`, Git
  `2.52.0.windows.1`, `core.autocrlf=true`.
- The seven affected suites produced the same 16 failures in two consecutive
  isolated executions.
- A clean checkout of the same commit with LF materialization passed all
  seven suites: 75 tests passed, 0 failed.
- Time zone, locale, timestamps, file order, cache, random identifiers, and
  environment secrets were not inputs to the failing comparisons.

## Root cause evidence

The manifests intentionally freeze byte-exact SHA-256 values. Git stores the
affected text blobs with LF, but Windows materialized legacy portal files with
CRLF because no repository attribute governed them.

Across all nine portal manifests:

- 171 artifact references were inspected.
- They resolve to 85 unique paths.
- 160 references mismatched in the Windows worktree.
- All 160 matched their declared SHA after CRLF-to-LF normalization.
- All 160 also matched the exact Git blob SHA.
- The 11 references in the newer V3 package already governed by
  `.gitattributes` had zero mismatches.

Example:

- CP-2B migration Git/LF SHA:
  `ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277`
- Windows CRLF worktree SHA:
  `1465539ee9d28c279c77e072aacffded4e1b69effa8c4194cd706e9f6de8b8d8`

Git history shows that the original frozen packages were committed without an
EOL policy. Commit `f7cfcca` later protected only the newest V3 package,
demonstrating the correct mechanism but leaving the earlier chain uncovered.

## Classification

All 16 failures share one root cause and are classified as **E. Difference of
environment**.

- Real product regressions: 0
- Obsolete expectations: 0
- Desynchronized manifests: 0
- Fragile hashes: 0
- Environment differences: 16
- Defective tests: 0
- Accepted debt: 0

The hashes remain appropriate because these are authorization and immutable
evidence packages where byte identity is a functional security property.
Normalizing inside the verifier would weaken that guarantee.

## Correction

The repository checkout contract now forces LF for every path family currently
referenced by a portal manifest. No artifact content or expected SHA changed.

A regression test discovers all versioned portal manifests, gathers every
`path` plus `sha256` record, and requires Git to report `eol=lf` for each path.
Adding a future frozen artifact without a matching checkout policy therefore
fails the normal test suite with the uncovered path.

No generated-artifact regeneration gate was added because the manifests were
not stale and the repository contains no applicable generator drift. The
failure occurred before execution solely through checkout byte conversion.

## Validation

The correction was validated from a new Windows checkout with
`core.autocrlf=true`:

```text
npm run lint                         PASS
npx tsc -b --pretty false            PASS
npm run test                         PASS - 461 passed, 4 skipped, 0 failed
npm run build                        PASS
```

The seven originally affected suites plus the EOL policy test passed twice:
76 passed, 0 failed in each run.

Read-only/source-only portal plans passed for CP-2B V2, CP-2B V4, CP-3B.0,
and CP-3B.2A V1/V2/V3. Every plan reported zero remote writes.

The focused invoice regression remained green: 22 passed, 0 failed. No invoice
file is part of this branch diff.

## Remaining debt

None is accepted for these 16 failures. Dependency audit findings reported by
`npm ci` are outside this test-baseline sprint and were not changed.
