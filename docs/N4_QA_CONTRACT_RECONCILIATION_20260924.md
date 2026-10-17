# N4 QA contract reconciliation — 2026-09-24

## Scope

This record covers the explicitly authorized QA-only reconciliation on project
`kpvvydthlxupjjqqdpxy`, from certified source head
`be00b0adb27041233774b0e60c9ce193239ab3c5`. Production was not queried or
modified. Migration history was not written and `db push` was not used.

## Prestate

The exact stale fixture was present: one plan, one slot, one occurrence on
`2026-09-28`, one recurring job and one job line. It had no team assignment,
time entry, material requirement, material movement, expense allocation, team
template or material template. The shared UI-root client and property were
present and were not modified.

QA also contained the obsolete slot/occurrence tables, the two obsolete RPCs,
and the four non-canonical plan columns (`timezone`,
`default_start_time`, `default_duration_minutes`, and
`default_workers_required`). No view, rule or trigger referenced those
objects. The deployed generator was the drifted implementation that depended
on the obsolete tables.

## Reconciliation

One committed QA transaction, using the generator body verbatim from
`20260923230000_n9_recurring_operational_templates_v2.sql`, performed the
following bounded changes:

- deleted only the exact stale job line, occurrence, job, slot and plan;
- replaced `generate_recurring_service_occurrences` with the N9 V2
  implementation, including team-template and material-template expansion;
- removed only `save_recurring_service_plan_schedule(text,jsonb)` and
  `set_recurring_service_occurrence(text,date,text,jsonb)`;
- removed the two obsolete tables without `CASCADE`;
- removed the four obsolete plan columns individually without `CASCADE`;
- revoked direct DML/DDL-adjacent table privileges on `jobs` and `job_lines`
  from `anon` and `authenticated`, preserving RPC execution and read access.

No RLS policy was weakened and no grant was added.

## Poststate

- stale plan/job/job-line residue: `0/0/0`;
- obsolete tables: absent;
- obsolete RPCs: absent;
- obsolete columns: absent;
- final generator contains team templates, material templates,
  `job_team_assignments` and `job_material_requirements`;
- final generator references obsolete tables: `0`;
- shared root client/property: preserved;
- anonymous generator execution: denied;
- authenticated generator execution: allowed;
- direct authenticated/anonymous INSERT and UPDATE on `jobs`/`job_lines`:
  denied;
- migration-history writes: `0`;
- production queries/mutations/deployment: `0`.

Legacy QA-only teardown routines remain outside the RC3/N9 runtime contract and
were not altered by this scoped reconciliation. They must not be reused as a
future cleanup mechanism without a separate repair review.

## Local verification

Focused N2–N9, RC3 manifest, QA auth-helper and private-env tests passed:
`37 tests passed in 9 files`. Repository changes are documentation-only.
