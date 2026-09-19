# CP-5.1F — Backup / Restore Readiness

**Status:** `BLOCKED / STOP_DATABASE_CREDENTIAL_REQUIRED`

This record covers only the explicitly authorized CP-5.1F backup and
restore-readiness gate. No migration, DDL, application SQL write, deployment,
secret access, email, Auth, invitation or CP-5.2 action occurred.

## Safe release metadata

| Field | Result |
|---|---|
| Target ref | `wfxnwfcdjainpojhbdri` |
| Target project status | `ACTIVE_HEALTHY` |
| Target region | `eu-west-1` |
| Candidate | `7870ae4408ab7af0c944b149d2c75a70b8421e65` |
| Verification timestamp UTC | `2026-09-19T18:34:41.6628570Z` |
| Backup owner | `Anderson` |
| Restore owner | `Anderson` |
| Backup mechanism considered | Managed physical inventory first; logical `supabase db dump` fallback |
| Backup timestamp | `NOT_CREATED` |
| Safe backup reference | `NONE_AVAILABLE` |
| Backup integrity | `NOT_VERIFIED / MANAGED INVENTORY ACCESS BLOCKED` |
| Restore procedure | `IDENTIFIED_ONLY / NOT_EXECUTED` |
| Restore actual test | `NO` |
| Secrets exposed | `NO` |

## Target identity result

`PRODUCTION_IDENTITY_CONFIRMED`

Two independent non-secret signals matched:

1. Supabase project metadata returned ref `wfxnwfcdjainpojhbdri`, project
   `CostaClean`, status `ACTIVE_HEALTHY` and region `eu-west-1`.
2. Supabase project URL returned
   `https://wfxnwfcdjainpojhbdri.supabase.co`.

No secret, credential, token or connection string was read or recorded.

## Backup result

`BACKUP_REQUIRED_BEFORE_MUTATION / BLOCKED`

The installed Supabase CLI is version `2.109.1`. Its supported physical-backup
surface exposes `backups list` and `backups restore`; it does not expose an
on-demand physical-backup creation command. Official Supabase documentation
and organization metadata now establish that this project is on the `free`
plan, which does not provide the managed daily-backup/PITR capability required
for this gate. The authorized read-only inventory attempt was:

`supabase backups list --project-ref wfxnwfcdjainpojhbdri --output json`

The platform returned HTTP `403` because the connected account lacked the
necessary privilege for that endpoint. The demonstrated primary cause is the
free-plan capability boundary; the evidence does not distinguish the account's
secondary PAT/role limitation without inspecting credentials or private account
permissions. No backup ID, timestamp or integrity reference could therefore be
established.

No logical dump was substituted: that would create a local copy of production
data and would require a database credential/connection path outside the
approved evidence boundary. The required future fallback is tracked as
Authorization C in CP51F2. No existing backup was deleted or changed, and no
retention setting was changed.

## Restore readiness result

`RESTORE_TEST_REQUIRES_SEPARATE_AUTHORIZATION`

The platform procedure was identified from the CLI surface as PITR restore to
an explicit Unix timestamp using:

`supabase backups restore --project-ref <production-ref> --timestamp <epoch>`

This command was not executed. It is a production-affecting restore operation,
and the current authorization prohibits restoring over production. An isolated
restore target was not already approved or created within this gate.

| State | Result |
|---|---|
| `BACKUP_VERIFIED` | `NO` — no accessible backup reference/integrity proof |
| `RESTORE_PROCEDURE_VERIFIED` | `NO` — procedure identified, but no backup/isolated target proof |
| `RESTORE_ACTUALLY_TESTED` | `NO` — intentionally not executed |

## Blocker and next authorization

**Blocker:** the project is on the free plan, managed backup/PITR capability is
not available for this gate, the connected account cannot access the inventory
endpoint, and the CLI cannot create an on-demand physical backup. CP-5.1F
cannot close as `BACKUP_AND_RESTORE_READINESS_VERIFIED`.

Required future action is Authorization C for a private logical backup, or an
explicitly approved paid-plan/capability path that does not expose production
data to Git, logs or chat. The next authorization must also name the isolated
restore target and confirm whether a restore test is included. Until then:

- no CP-4.3C migration or reconciliation;
- no Edge Function deployment;
- no production schema mutation;
- no CP-5.2.

## Prohibited data statement

This document contains only non-sensitive target and release metadata. It does
not contain backup contents, dumps, credentials, connection strings, secret
values, tokens, encryption keys, worker secrets or personal data.

**Disposition:** `CP51F_BLOCKED / STOP_DATABASE_CREDENTIAL_REQUIRED`
