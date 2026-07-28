# CP-3B.2A Reviewed Change Contract

Date: 2026-07-28

State: `PREPARED_NOT_AUTHORIZED`

This freezes the source-only backend contract created to unblock the future
CP-3B.2 frontend. It is not evidence of a QA or production application.

## Public surface

| Capability | Exact PostgreSQL signature | Volatility |
|---|---|---|
| Submit profile correction | `public.portal_submit_profile_change_request_v2(text, jsonb, uuid)` | `VOLATILE` |
| Submit property correction | `public.portal_submit_property_change_request_v2(text, text, jsonb, uuid)` | `VOLATILE` |
| List own profile corrections | `public.portal_list_own_profile_change_requests_v2(text, integer)` | `STABLE` |
| List own property corrections | `public.portal_list_own_property_change_requests_v2(text, text, integer)` | `STABLE` |

All four are `SECURITY DEFINER`, owned by `postgres`, use fixed `pg_catalog`
search paths, derive identity only from `auth.uid()` and grant execution only to
`authenticated`.

The explicit `client_id` is an untrusted selection context validated by the
server through active, verified `client_admin`/`client_member` membership. No
contract accepts user identity, email, Auth metadata, subject hash or
correlation ID from the browser.

## Persistence and idempotency

Both existing request tables gain nullable, no-default `idempotency_key uuid`
and `public_reference text` columns. There is no backfill; historical rows
remain unchanged and are excluded from V2 lists.

Partial unique indexes enforce one key per requester and one reference per
table. A non-null UUID is required by each V2 submit.
The all-zero UUID is rejected.

- The first valid submit inserts once, consumes the existing rate limiter and
  writes one audit event.
- An identical retry returns the receipt from the persisted row.
- Reuse with another context, target or normalized payload raises
  `idempotency_conflict` without returning the existing receipt.
- `INSERT ... ON CONFLICT` is the atomic decision. Concurrent identical calls
  yield one row, one audit and the same receipt.
- Rate-limit rejection rolls back the whole transaction.

Profile and property keys are separate namespaces.

## DTOs

Submit returns exactly:

```json
{
  "reference": "CC-PR-… or CC-PT-…",
  "status": "pending_review",
  "requestedAt": "server timestamp",
  "changedFields": ["sortedField"],
  "requestType": "profile or property"
}
```

References use 24 hexadecimal characters from a SHA-256 digest of two fresh
server-generated UUIDs, providing 96 opaque random-derived bits and no
client/user/email-derived material.
Lists return 1–50 requester-owned V2 records, newest first, adding only
`resolvedAt`. They never return internal IDs, target IDs, proposed values,
review reasons, reviewer identity, audit identifiers or PII.

## Tenancy and canonical boundary

The contracts insert only review-request rows. They never update `clients` or
`properties` and never create jobs, quotes, invoices or payments.

Profile creation requires an active, non-deleted, non-archived client. Property
creation and listing require an owned property with `deleted_at` and
`archived_at` null and `status = 'active'`. The canonical row is held with
`FOR SHARE` through validation and insertion so a concurrent staff archive,
deletion or reassignment cannot invalidate the authorization decision. Missing,
foreign, inactive, archived and deleted targets share
`resource_not_found`.

Each member sees only their own requests. The migration drops the two broad
customer same-client select policies while retaining the internal-staff
management policies and existing table grant.

## Audit and rate limit

Only a winning insert writes `profile_change_requested` or
`property_change_requested`. Metadata contains sorted field names only. The
correlation UUID stays internal.

The existing limiter uses server-derived SHA-256 subjects:

- actions: `profile_change_v2`, `property_change_v2`;
- subject: action + authenticated actor + validated client;
- window: 3,600 seconds;
- limit: five new requests per action/actor/client;
- replay: does not consume the limiter.

## Legacy compatibility

The legacy service-only submits cannot satisfy V2 safety. This migration revokes
their `service_role` execution grants without changing their definitions. The
deployed legacy Edge actions therefore fail closed. No Edge deploy occurs.

## Rollback contract

The local-only rollback requires zero V2 rows, drops the four public and three
private functions, restores the two customer policies and two legacy grants,
then drops four indexes, two constraints and four columns. PostgreSQL 17 proved
rollback, prestate restoration, reapply and zero residue. No remote rollback or
application is authorized.
