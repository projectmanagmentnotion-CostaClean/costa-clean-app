# CP-5.1F4 — Temporary Access / Logical Backup

**Status:** `STOP_JIT_PERMISSION_REQUIRED`

Authorization D was not executed because the current environment cannot safely
read the Temporary Access prestate or perform the required Management API
configuration with a non-exposed credential. No JIT setting, Postgres role,
network restriction or production data was changed.

## Verified target and compatibility

| Field | Result |
|---|---|
| Production ref | `wfxnwfcdjainpojhbdri` |
| Production status | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1.084` |
| Candidate | `7870ae4408ab7af0c944b149d2c75a70b8421e65` |
| Temporary Access minimum documented version | `17.6.1.081` |
| Technical version compatibility | `YES` |
| Temporary Access prestate | `UNKNOWN / NOT QUERIED` |
| Executing Supabase user identity | `UNKNOWN / NOT QUERIED` |
| SSL precondition | `UNKNOWN / NOT QUERIED` |
| Network restriction | `NOT_CONFIGURED` |
| JIT enabled by this gate | `NO` |
| JIT cleanup required | `NOT_APPLICABLE — no JIT mutation occurred` |

The target identity was revalidated through project metadata and project URL.
The database version is technically compatible with Temporary Access according
to the current official documentation. Compatibility is not authorization and
does not prove that JIT is enabled or that the user's account can configure it.

## Official mechanism reviewed

Supabase documents Temporary Access as disabled by default. It applies to
Postgres and Supavisor connections, not HTTP APIs. Enabling it requires the
Management API or Dashboard; user-to-Postgres-role authorization, expiry and
optional IPv4/IPv6 CIDR restrictions are separate settings. SSL must be enabled
before use. The authorized connection would use the existing authenticated
user's PAT/session token as the temporary Postgres password, without exposing a
database password.

Sources: [Supabase Temporary Access](https://supabase.com/docs/guides/platform/temporary-access),
[Temporary token-based access changelog](https://supabase.com/changelog/46346-feature-preview-temporary-token-based-database-access),
and [Supabase Access Control](https://supabase.com/docs/guides/platform/access-control).

## Capability and permission blocker

The installed CLI is `2.109.1`. Its supported help surface includes
`supabase db dump`, but no Temporary Access/JIT status, enable, user-role rule,
expiry or revoke command. The available Supabase MCP tools also expose no JIT
read/write operation. No Management API token or dashboard session token is
available in a safe, non-printing process context.

The official Management API path would require a credential with the necessary
project-management permission. The documented operation is therefore only a
future procedure, not an executed command. No endpoint was called with a
placeholder or guessed token.

**Stop reason:** `STOP_JIT_PERMISSION_REQUIRED`

This means the gate cannot prove the JIT prestate, authorize the exact user or
temporary role, set a short expiry, or guarantee restoration of the original
state. It must not enable JIT blindly.

## Least-privilege decision

No temporary role was selected or assigned. No role creation, grant, ownership
change or RLS change occurred. A future owner-approved run must first prove the
minimum role that can produce the required logical artifacts; `postgres` must
not be assumed automatically. If only `postgres` is technically sufficient,
that requirement must be explicitly documented before assignment.

## Backup and restore result

| Item | Result |
|---|---|
| Private backup artifacts | `0` |
| Roles/schema/data dumps | `NOT_CREATED` |
| SHA-256/checksums | `N/A` |
| `public`/`portal_private` coverage | `NOT_ESTABLISHED` |
| Migration metadata coverage | `NOT_ESTABLISHED` |
| Storage object bytes | `NO` |
| Restore actually tested | `NO` |
| Restore readiness | `BLOCKED_BY_MISSING_BACKUP` |
| Local restore | `NOT_ATTEMPTED` |

## Safety result

- Production data writes: `0`
- Production schema writes: `0`
- Production configuration mutations: `0`
- Migrations: `0`
- Edge Function deployments: `0`
- Auth writes: `0`
- Email sends: `0`
- Customer invitations: `0`
- Financial/fiscal writes: `0`
- Credential used privately: `NO`
- Credential value exposed: `NO`
- Secrets exposed: `NO`

## Required next authorization

A future run needs a separately verified Management API/dashboard capability
for Temporary Access and must name the authenticated user, minimum temporary
Postgres role, short expiry, prestate capture, optional safe CIDR, private dump
destination, cleanup procedure and poststate verification. It must not reset or
create a database password.

No Authorization B was executed. CP-5.1 remains `BLOCKED` and CP-5.2 remains
`NOT_STARTED`.

**Disposition:** `CP51F4_BLOCKED / STOP_JIT_PERMISSION_REQUIRED / ZERO_PRODUCTION_MUTATIONS`
