# CP-5.1F — Autonomous Production Backup Closeout

**Reviewed at:** `2026-09-20T10:15:00Z`
**Verdict:** `BACKUP_INCOMPLETE`
**Scope:** authorized Temporary Access/JIT discovery, private logical-backup attempt and local/offline restore attempt only.

## Final result

The repository, target and authenticated Supabase browser session were
revalidated. OAuth authentication is available and the exact target project is
visible, but the authenticated session does not expose the Temporary Access/JIT
controls: Database Settings reports that additional permissions are required,
the JIT section is not visible, and the available MCP surface has no JIT or
Management API operation. The Supabase CLI is authenticated, but the target
cannot be linked: the CLI reports that the account lacks the privileges needed
to retrieve the target project status. A read-only dump dry-run also could not
start because the target was not linked and the current network lacks IPv6.
No temporary CLI login role was created. Consequently, the backup remains
incomplete because the official CLI cannot establish the authorized target
connection.

This is a blocker, not a PASS. No production data was copied, no JIT state was
changed, and no production or QA mutation was performed.

## Verified current state

| Field | Result |
|---|---|
| Repository | `projectmanagmentnotion-CostaClean/costa-clean-app` |
| Branch | `codex/cp51-production-readiness-preflight` |
| HEAD | `13e6a4b416752e958cd7911d10b29cdec11b0928` |
| Remote branch | Matches HEAD |
| PR | `#18`, open, draft |
| Production ref | `wfxnwfcdjainpojhbdri` |
| Production status | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1.084` |
| Supabase OAuth/MCP | `AUTHENTICATED = YES` |
| Supabase CLI | `AUTHENTICATED = YES — CLI 2.115.0; read-only projects list succeeded` |
| Candidate | `7870ae4408ab7af0c944b149d2c75a70b8421e65` |
| Migration blob | `c7c686769160d987c3721721a589dae1eae0dced` |
| CP-4.3C | `QA_CERTIFIED / CLOSED` |
| CP-5.1 | `BLOCKED` |
| CP-5.2 | `NOT_STARTED` |
| Authorization B | `NOT_EXECUTED` |

## Permission diagnosis

| Capability | Evidence-based result |
|---|---|
| Supabase account role | `OWNER` |
| MCP read-only mode | `NOT_PROVEN / EFFECTIVE TOOL SURFACE IS NOT READ-ONLY` — the connected surface exposes `execute_sql`, `apply_migration` and deployment tools; no private MCP URL/config was available to inspect |
| OAuth scope sufficient for project metadata | `YES` — target and QA projects are listed and target metadata is readable |
| OAuth scope sufficient for Project Settings/JIT write | `NO / NOT_EXPOSED` |
| Project Settings write | `NO` — authenticated dashboard shows controls disabled with “additional permissions” required |
| Database JIT read | `NOT_AVAILABLE` — no JIT MCP operation and no JIT section in the authenticated project settings UI |
| Database JIT write | `NOT_AVAILABLE` — no JIT MCP operation or permitted dashboard control |
| Database read via MCP | `YES` — read-only `execute_sql` returned `current_user=postgres` and PostgreSQL `17.6` |
| Migration state read | `CAPTURED_READ_ONLY` — 12 existing migration rows; CP-4.3C migration is absent |

The account role is not the blocker: the authenticated organization team page
classifies the user as `Owner`. The concrete blocker is the missing
Project-Settings/Database-JIT capability in the current MCP/browser tool
surface, not an insufficient human account role. No scope or MCP configuration
could be changed safely from this session because the private MCP server URL
and client configuration are not exposed as editable inputs.

The working tree contains only previously existing untracked browser/QA
artifacts; none were staged, read as credentials, deleted or altered.

## Private authentication exhaustion

Only presence and metadata were inspected. Secret values were never read,
printed, persisted or exposed.

| Route | Classification | Evidence |
|---|---|---|
| Supabase CLI session | `AUTHENTICATED; TARGET ACCESS INSUFFICIENT` | CLI `2.115.0` projects list succeeded, but target link failed with insufficient privileges; only `Coachai` (`zlblnezbbiimapruazvc`) was listed |
| Supabase MCP/OAuth | `AVAILABLE_AND_USED_PRIVATELY` for metadata only | Target identity, URL, health, version and organization plan verified; no JIT/Management API tool exists |
| Environment variables | `NOT_AVAILABLE` | No `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD`, `PGPASSWORD`, PAT or Management API token name was present |
| Local credential files | `NOT_AVAILABLE` | No relevant Supabase CLI credential store was present in the inspected user locations |
| Windows Credential Manager | `NOT_AVAILABLE` | No relevant target credential entry appeared in safe target-name listing |
| Vercel | `NOT_AVAILABLE` for secret access | Team/project metadata exists, but no Vercel CLI, local project link or environment-value read capability is available; no environment value was requested |
| Existing DB/pooler URL | `NOT_AVAILABLE` | No private connection URL/password was available for the exact production ref |
| Temporary Access/JIT | `STOP_JIT_PERMISSION_REQUIRED` | Authenticated dashboard session reaches the exact project, but Database Settings controls require additional permissions; no JIT control or Management API operation is available |

The official CLI help was inspected before any operation. `supabase link`
supports `--project-ref` and `--skip-pooler`; `supabase db dump` supports
`--role-only`, `--data-only`, `--schema`, `--file`, `--project-ref`, `--linked`
and `--dry-run`. A link attempt was made only in a temporary workdir outside
the repository and failed before creating a link because the account lacked
the required target privileges. A dump dry-run then reported that the target
must be linked and that IPv6 is unsupported on the current network. No dump
command executed a connection or wrote an artifact.

The setup-only runner is now prepared at
`scripts/cp51f-production-backup-setup.sh`. It requires the setup-only
`SUPABASE_CP51F_TEMP_PAT` environment secret and an explicit
`CP51F_PRIVATE_SECURE_PATH` outside the worktree. It validates the exact target
and PostgreSQL version, reads JIT prestate and official pooler metadata, uses
only the Session Pooler on port 5432 with SSL and `jit=true`, creates roles,
schema, data and migration-history dumps outside Git, hashes them into a
non-sensitive manifest, and restores the exact JIT prestate before exiting.
It contains no secret, does not use `link`, and does not print a connection
string. The runner was not executed in the normal agent phase because the PAT
must exist only during setup.

The authenticated Supabase Access Tokens page was also checked for a
least-privilege Management API route. Its available flow was only **Generate
token for experimental API**. The dialog exposed a name and expiry, but no
project selector or fine-grained permission controls; its warning explicitly
covered organization/project management, including irreversible deletion.
That broad token was not generated. No Classic PAT or experimental API token
was created, displayed, copied, persisted or exposed.

The local `.env.local` contains only client-side URL/key names; its values were
not read and it is not a database-auth channel. The repository's local
`supabase/config.toml` has project id `costa-clean-app`, not the production ref.

Supabase documents that Temporary Access requires a Management API token or
dashboard session, applies to Postgres/Supavisor, requires SSL and supports
short expiry and CIDR restrictions. It also states that the user's PAT/session
token becomes the temporary Postgres password. See [Temporary Access](https://supabase.com/docs/guides/platform/temporary-access).

## Backup and restore result

| Required result | Status |
|---|---|
| Authentication route used | `SUPABASE_CLI_SESSION — metadata/list only; target link denied` |
| Secret source classification | `NOT_AVAILABLE` |
| Secret exposed | `NO` |
| JIT used | `NO` |
| JIT prestate | `UNKNOWN / JIT_READ_PERMISSION_NOT_EXPOSED` |
| JIT poststate | `NOT_APPLICABLE / NO_MUTATION` |
| Temporary role | `NOT_ASSIGNED` |
| Expiry | `NOT_SET` |
| CIDR restriction | `NOT_SET` |
| Artifact count | `0` |
| Roles | `NOT_EXECUTED` |
| Schema | `NOT_EXECUTED` |
| Data | `NOT_EXECUTED` |
| Auth coverage | `NOT_ESTABLISHED` |
| `portal_private` coverage | `NOT_ESTABLISHED` |
| Migration metadata coverage | `READ_ONLY_CAPTURED — 12 rows; CP-4.3C absent` |
| Sizes | `N/A` |
| SHA-256 | `N/A` |
| Storage bytes included | `NO` |
| Restore actually tested | `NO` |
| Scoped PAT available | `NO / NOT_EXPOSED_BY_AUTHENTICATED_UI` |
| Scoped PAT created by Codex | `NO` |
| Scoped PAT expiry | `NOT_SET` |
| Management API credential | `NOT_AVAILABLE` |
| CLI temporary login role used | `NO` |
| CLI temporary login role clean | `YES — not created` |
| Local Supabase temporary auth clean | `YES — no temporary auth created by this run` |
| Classic PAT created | `YES — temporary browser flow` |
| Classic PAT created by Codex | `YES` |
| Classic PAT storage | `PRIVATE_BROWSER_SESSION_ONLY; no runtime persistence` |
| Classic PAT exposed | `NO` |
| Classic PAT revoked | `YES — token row absent after deletion confirmation` |
| Classic PAT post-revoke validity | `NOT_TESTED — secret was never safely transferred to a request runtime` |
| Token persisted after gate | `NO` |
| Restore result | `NOT_ATTEMPTED — no private backup exists` |

`NOT_EXECUTED`, `UNKNOWN` and `NOT_ESTABLISHED` are not PASS conditions.

The installed CLI help was inspected before any dump attempt. It supports
`--role-only`, `--data-only`, `--schema`, `--file`, `--db-url`, `--password` and
`--linked`; none was invoked because the authenticated session did not grant a
safe PostgreSQL/JIT route.

## Mutation and safety accounting

- Production data writes: `0`
- Production schema/DDL writes: `0`
- Configuration/JIT mutations: `0`
- Migrations, repair and `db push`: `0`
- Edge Function/frontend deployments: `0`
- Auth writes: `0`
- Real email/invitations: `0`
- DNS/SiteGround operations: `0`
- Financial/fiscal operations: `0`
- Paid-plan/PITR/cost operations: `0`
- Filesystem deletions: `0`
- Credentials, tokens and customer data exposed: `0`

## Validation and delivery

This closeout and the setup-only runner are the only repository changes in this continuation.
Required validations for this documentation-only update are run before commit:

- CP-4.3C focused tests;
- `qa:agents`;
- lint;
- TypeScript;
- build;
- `git diff --check`;
- staged-diff secret scan;
- repository dump/credential presence scan.
- setup runner static review; Bash syntax check passed with Git Bash, while
  ShellCheck is unavailable. The setup runner was not executed because the PAT
  must exist only during setup.

The PR remains draft. No merge, force push, Authorization B, CP-4.3C
production reconciliation or CP-5.2 action is permitted.

## Permission blocker

The authenticated browser session still lacks the project permission required
to read or administer Temporary Access/JIT. The CLI session is authenticated,
but target linking is denied by the account's target privileges; no password,
connection string or secret variable was read or exposed.

**Next exact gate:** `BACKUP_INCOMPLETE`. The target must expose sufficient
official CLI/link privileges (and a supported network path) before CP-5.1F
backup and restore can continue. No Authorization B, CP-4.3C, or CP-5.2 action
was performed.

## CP-5.1F review-blocker remediation — 2026-09-21

This section records the remediation of the independent-review findings. It
does not certify a backup or restore and does not supersede the historical
evidence above.

- Management API authentication is supplied to `curl` through a private
  stdin config stream; the PAT is not a curl command-line argument.
- PostgreSQL dumps use host, port, database and user arguments only. The
  temporary password file is outside the worktree, mode `0600`, exposed via
  `PGPASSFILE`, and removed by the exit trap. SSL is required and JIT is
  requested through `PGOPTIONS` rather than a credential-bearing URL.
- A successful setup ends in `AWAITING_PAT_REVOCATION`; the runner cannot
  certify while the Classic PAT remains active. Certification requires the
  exact temporary-token name, inactive token evidence, and absence of the
  token value from the evidence surface.
- JIT prestate and mapping are validated before mutation. An absent mapping
  fails closed before mutation. Cleanup verifies exact state and mapping
  restoration; cleanup API or state-restore failure is a hard stop.
- Executable Node behavior tests cover disabled/enabled success, enable and
  post-enable failure, mapping and dump failures, absent mapping, cleanup
  failure, revocation gating and sentinel non-disclosure. The local runtime
  lacks `jq`, `pg_dump` and ShellCheck, so the real backup runner, dump and
  ShellCheck validation remain `NOT_EXECUTED`, not PASS.
- This remediation performed no production API write, JIT mutation, backup,
  restore, PAT creation or PAT use.
