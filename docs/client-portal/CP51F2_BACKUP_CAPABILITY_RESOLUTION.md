# CP-5.1F2 — Backup Capability Resolution

**Status:** `INVESTIGATING / ZERO PRODUCTION MUTATIONS`

This document resolves the CP-5.1F backup-capability uncertainty only. It does
not authorize a logical dump, project creation, restore, plan change, PITR
enablement, migration, deployment or CP-5.2.

## Fixed evidence

| Item | Result |
|---|---|
| Production ref | `wfxnwfcdjainpojhbdri` |
| Project | `CostaClean` |
| Project status | `ACTIVE_HEALTHY` |
| Organization | `nplaqggqtqymziwihaay` |
| Organization plan | `free` |
| Candidate | `7870ae4408ab7af0c944b149d2c75a70b8421e65` |
| Current repository HEAD | `24ac569f4487a16a8d965885ee809c396474fad5` |
| Production mutations in this investigation | `0` |
| Credentials/tokens read | `NO` |
| Secrets exposed | `NO` |

## 1. Official capability findings

Current official Supabase documentation states:

- Daily database backups are automatic for Pro, Team and Enterprise projects;
  free projects are not included in that managed daily-backup offering.
- Physical backups are the underlying backup process for eligible Postgres
  versions, but access to an actual project's backup inventory still depends on
  plan/capability and permissions.
- PITR is a paid-plan add-on and requires physical backups; it is not available
  as a free-plan capability.
- Restore to a New Project is available to paid-plan users with physical
  backups enabled, creates a new database-only project, and requires manual
  reconfiguration of Storage, Edge Functions, Auth settings/API keys,
  Realtime, extensions/settings and read replicas.
- `supabase db dump` is a logical backup path. It requires a linked project or
  a database connection string/password and writes dump files; it is not the
  managed physical-backup inventory.

Sources: [Database Backups](https://supabase.com/docs/guides/platform/backups),
[Access Control](https://supabase.com/docs/guides/platform/access-control),
[Restore to a new project](https://supabase.com/docs/guides/platform/clone-project),
and [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## 2. HTTP 403 diagnosis

The prior command was:

`supabase backups list --project-ref wfxnwfcdjainpojhbdri --output json`

The response was HTTP `403` with the platform message that the account did not
have the necessary privileges for the endpoint.

The following cause is demonstrated by independent project metadata:

**The project belongs to a `free` organization, which does not provide the
managed Daily Backups/Restore to New Project/PITR capability described in the
official documentation.**

The endpoint also requires the account to have physical-backup view permission.
The available evidence does not distinguish whether the connected account's
secondary denial is a scoped PAT limitation, user/project role limitation or
the plan gate. No token, role credential or secret was inspected to make that
distinction. It is unnecessary for the release decision because the free-plan
capability gate is already conclusive.

Classification:

`NO_MANAGED_BACKUP / LOGICAL_BACKUP_REQUIRED`

This is not classified as “backup nonexistent” at the byte level: the exact
physical-backup inventory remains unobservable through the current account.
It means no managed backup capability usable for this CP-5.1 gate was
demonstrated, and the platform-supported fallback is a separately authorized
private logical backup.

## 3. Managed backup status matrix

| Capability | Result | Evidence boundary |
|---|---|---|
| Managed Daily Backups | `NO / NOT AVAILABLE ON CURRENT FREE PLAN` | Official plan rule plus project organization metadata |
| Physical backup inventory | `UNKNOWN / ACCESS BLOCKED` | CLI inventory endpoint returned 403 |
| PITR | `DISABLED / UNAVAILABLE ON CURRENT FREE PLAN` | Official paid-plan add-on rule; setting itself not queried |
| Recovery window/latest recovery point | `UNKNOWN` | No permitted inventory access |
| Restore eligibility for this project | `NO / NOT AVAILABLE ON CURRENT FREE PLAN` | Restore requires paid plan and physical backups |
| Backup reference | `NONE_AVAILABLE` | No list result was returned |

No “YES” is inferred from the existence of an API endpoint or from the
PostgreSQL version alone.

## 4. Restore to a New Project

The feature is **not available for the current free-plan project** under the
documented requirements. If the owner later moves the project to an eligible
paid plan and enables the required capability, Restore to a New Project would:

- create a separate new Supabase project;
- restore database schema, data, indexes, roles/permissions/users, Auth data
  and the encryption root key from a physical backup or PITR point;
- not copy Storage objects/settings, Edge Functions, Auth settings/API keys,
  Realtime settings, database extensions/settings or read replicas;
- start external extension jobs such as `pg_cron`/`pg_net` after restore, so it
  is not automatically a safe CP-4.3C synthetic environment without an
  explicit inspection plan;
- incur a new project/compute/disk cost shown before creation.

Therefore:

`RESTORE_TO_NEW_PROJECT_RECOMMENDED / COST_AUTHORIZATION_REQUIRED`

This recommendation is conditional and is not an instruction to create a
project. Any future project creation requires first obtaining the actual cost,
presenting it to the owner and receiving explicit cost authorization. No cost
lookup or project creation was performed here.

## 5. Logical backup fallback

Under the current plan, the practical private backup path is a separately
authorized logical backup using `supabase db dump` or the documented equivalent.
The official procedure requires a database connection string/password and
produces one or more dump files (roles, schema and data as applicable). The
dump is production data and must remain private, encrypted at rest, outside
Git, outside logs/chat, and subject to explicit retention/destruction rules.

No logical dump was run. No database password, connection string or temporary
credential was read. No production data was exported.

### Authorization C — Logical production backup

Future authorization must separately and exactly name:

- project ref `wfxnwfcdjainpojhbdri`;
- the permitted `supabase db dump` operation and schema/data scope;
- private encrypted destination and integrity method;
- retention/lifetime and destruction owner;
- prohibition on Git, logs, chat and screenshots containing dump content;
- prohibition on displaying credentials, connection strings or secret values;
- no restore, project creation, migration, DDL, deployment or CP-5.2.

Authorization C is **not granted** by this document and was not executed.

## 6. Capability distinction

| Category | Current result |
|---|---|
| `MANAGED_BACKUP_AVAILABLE` | `NO / NOT DEMONSTRATED ON FREE PLAN` |
| `MANAGED_BACKUP_RESTORABLE` | `NO / NOT AVAILABLE ON CURRENT PLAN` |
| `LOGICAL_BACKUP_CREATED` | `NO` |
| `RESTORE_PROCEDURE_KNOWN` | `YES — documented platform procedures identified` |
| `RESTORE_ACTUALLY_TESTED` | `NO` |

No category is marked PASS using evidence from another category.

## 7. Decision and next gate

**Decision:** `NO_MANAGED_BACKUP / LOGICAL_BACKUP_REQUIRED`

**Required next human authorization:** Authorization C for one private logical
production backup, or a separately approved paid-plan/capability change and
backup inventory access. The smallest path is Authorization C; it still must
not be executed automatically.

CP-5.1 remains blocked until backup integrity and restore readiness are proven.
Authorization B remains unapproved. CP-5.2 remains `NOT STARTED`.

## 8. Owner matrix

- `BACKUP_OWNER = Anderson`
- `RESTORE_OWNER = Anderson`
- `RELEASE_OWNER = HUMAN_INPUT_REQUIRED`
- `ROLLBACK_OWNER = HUMAN_INPUT_REQUIRED`
- `INCIDENT_OWNER = HUMAN_INPUT_REQUIRED`
- `OBSERVABILITY_OWNER = HUMAN_INPUT_REQUIRED`

**Disposition:** `CP51F2_BLOCKED / STOP_BACKUP_PERMISSION_REQUIRED / ZERO_PRODUCTION_MUTATIONS`
