# COSTA CLEAN APP — POST-V3 N4 GLOBAL RELEASE CERTIFICATION

## Scope and immutable product state

- Branch: `codex/post-v3-n4-recurring-services`
- Production product baseline: `d96e1426d85dee4bb93537a9d4e6bdf6318b5509`
- Post-release documentation baseline: `1da17e0a0edca8b874fee84e668f22d0263b5e01`
- Certified N4 product SHA: `d31a8535cbdd89f12b990b9274b06444b54d86ae`
- QA project: `kpvvydthlxupjjqqdpxy`
- Production project: `wfxnwfcdjainpojhbdri`

The certified product SHA was not changed by this document. The final
documentation commit is separate and contains no product implementation.

## Git lineage and migration separation

The pre-N4 baseline is an ancestor of the certified N4 product. The N4 delta
contains exactly two commits (`42fdba5` and `d31a853`) and 22 changed files.
The production baseline is four commits behind and differs by 23 files,
including one prior release-certification document. `PR18_CONTAMINATION = 0`;
the unrelated CP51 workstream was not merged or cherry-picked. `UNRELATED_PRODUCT_FILES = 0`.

Product migrations included in the N4 release:

| Migration | SHA-256 |
|---|---|
| `20260923150000_n4_recurring_service_plans.sql` | `758BE3560298E5BF2E4B2DDF1F9C34FD6C43EDBD5D2C8F5FF79944918AAFB465` |
| `20260923153000_n4_correct_internal_staff_read_policies.sql` | `333E289522928F102659F8A5F453AACCB6A62142C805D89B3B84EDADAF180620` |
| `20260923154500_n4_grant_internal_staff_read_access.sql` | `FEE55C08ED2F2EB6FEACCF9EA177EF7017C368052DFAB992B01519EDA69382C4` |
| `20260923160000_n4_grant_authenticated_rls_helper_execute.sql` | `4870B71AFB75D567A2D97AE450356BDF182E5A4E64CA34AA30CD146444096527` |

QA-only migrations deliberately excluded from a release migration manifest:

- `20260923170000_n4_func_teardown_qa.sql`
- `20260923172000_n4_func_teardown_root_pattern_correction_qa.sql`

`QA_ONLY_MIGRATIONS_INCLUDED = 0`. The original product migration is
immutable. Any future database correction must be additive and forward-only;
the final policy namespace is `app_private`.

## Evidence ledger

- `QA_PRODUCT_LEDGER = RECONCILED`
- `QA_ONLY_LEDGER = RECONCILED`
- `N4_SCHEMA_CONTRACT = PASS`
- `N4_RELATIONAL_INTEGRITY = PASS`
- `N4_ACL_CONTRACT = PASS`
- `N4_FUNCTIONAL_EVIDENCE = PASS`
- `N1_DIFFERENTIAL_REGRESSION = PASS`
- `NO_FALSE_LIVE_CLAIMS = YES`

N1 owner paths were unchanged by the complete N4 delta and working tree:
`src/app/useAppData.ts`, `src/app/refreshInvalidation.ts`, and
`src/app/AppShell.tsx`. No parallel refresh architecture or bypass was added.
The focus, visibility, and reconnect results are therefore explicitly
`UNCHANGED_FROM_CERTIFIED_N1`, not freshly observed physical browser events.
Fresh N4 evidence did verify two-context Realtime invalidation and canonical
refetch for `recurring_service_occurrences/jobs`, with 173 ms observed
latency, visible polling at 60 seconds, and zero duplicate/stale subscriptions.

The authoritative live fixture evidence is:

- job UUID: `JOB-a7502983-69c7-49d2-8e71-7b0f347a7dd5`
- display code: `JOB-0138`
- plan: `PLAN-QA_N4_FUNC_0d6faf5dcc94c1284e102ae5be2a8e44-ROOT`
- occurrence date: `2026-09-28`

The exact job was present in the canonical refetch, normalized client state,
and `Próximos` DOM without manual reload. The prior `Hoy` view excluded it
because the occurrence date was future-dated. `DOCUMENTATION_EVIDENCE_CONSISTENT = PASS`.

## Quality and safety gates

- Focused N4/N1 contract tests: 45 passed
- Full tests: 574 passed, 0 skipped
- Agents: 294/294 PASS
- Lint: PASS
- TypeScript: PASS
- Build: PASS
- Diff check: PASS
- Secret scan: PASS; only expected static identifiers were found, no secret material
- QA N4 residue: 0
- QA N4 provenance residue: 0
- Production mutations: 0
- Production N4 migration: NO
- Production deployment: NO

## Production prestate gate

This certification is fail-closed. No authorized read-only Production
credential/channel was available in the execution environment; the available
Supabase configuration was QA-only. Production was not queried, and QA
credentials were not used against Production.

- `PRODUCTION_READ_ONLY = NOT_EXECUTED`
- `PRODUCTION_PRESTATE = BLOCKED_CREDENTIALS_NOT_AVAILABLE`
- `UNEXPECTED_N4_PRODUCTION_OBJECTS = NOT_VERIFIED`
- `PRODUCTION_MUTATIONS = 0`
- `GLOBAL_CERT_STATUS = BLOCKED`
- `POST_V3_N4_RELEASE_CERTIFIED = NO`

The product remains release-candidate material, but global release
certification cannot be declared until the authorized read-only Production
prestate reconciliation is completed.
