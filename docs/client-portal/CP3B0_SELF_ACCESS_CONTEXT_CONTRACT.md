# CP-3B.0 Self Access Context Backend Contract

Date: 2026-07-28

Status: `DONE — SOURCE/LOCAL DISPOSABLE PROOF ONLY`

QA application: `NOT AUTHORIZED`

CP-3B.1: `BLOCKED_PENDING_CP3B0_QA`

## Objective

Remove the verified bootstrap deadlock without weakening the portal tenancy
boundary. An authenticated browser needs to resolve its own portal access state
before it knows a `client_id`; the frozen CP-2B
`portal_get_account_context(text)` contract intentionally requires that
identifier and exposes only active memberships.

CP-3B.0 adds one forward-only, read-only PostgreSQL contract:

```sql
public.portal_resolve_self_access_context()
```

It is not applied to QA or production by this gate.

## Original block reproduced

The frozen CP-2B catalog and source prove:

- `portal_get_account_context(text)` has one required `p_client_id`;
- no zero-parameter public context function exists;
- that RPC filters `m.status = 'active'`;
- suspended, revoked and no-access identities therefore have the same generic
  denial from the browser's available contracts;
- CP-3A has no `.from(...)`, email/metadata tenancy inference or trusted
  `client_id` source that could safely fill the gap.

`cp3b0_reproduce_block.sql` validates those statements against a disposable
PostgreSQL catalog before the new migration is applied. The Vitest contract
test also locks the frozen-source and frontend sides of the reproduction.

## Exact result contract

The function always returns a JSON object with these top-level keys:

```json
{
  "state": "active_member",
  "selectedClientId": "client-id-or-null",
  "memberships": [
    {
      "clientId": "client-id",
      "membershipId": "membership-id",
      "role": "client_admin",
      "status": "active"
    }
  ],
  "applicationStatus": "pending_review-or-null"
}
```

Allowed `state` values:

- `active_member`;
- `client_selection_required`;
- `pending_review`;
- `suspended`;
- `revoked`;
- `authenticated_without_access`.

Only active memberships may appear in `memberships`. Suspended and revoked
client identifiers are never returned. Client names, profiles, email, phone,
address, tax data, Auth metadata, administrative reasons and tokens are absent.

`applicationStatus` is the caller's own application status or JSON `null`. It
does not influence tenancy and cannot create a membership.

## Deterministic resolution

1. The function captures `auth.uid()` once. A null identity fails closed as
   `authenticated_without_access`.
2. Active memberships are eligible only when
   `portal_private.is_verified_portal_user(auth.uid())` passes.
3. One eligible active membership produces `active_member`, returns that exact
   context and selects its `client_id`.
4. Multiple eligible active memberships produce `client_selection_required`,
   return only those memberships ordered by `client_id`, and select none.
5. With no eligible active membership, an own suspended membership produces
   `suspended` without identifiers.
6. Otherwise an own revoked membership produces `revoked` without identifiers.
7. Otherwise an own `pending_review` application produces `pending_review`.
8. Approved-without-membership, unverified-active, internal-staff-only,
   incoherent and absent states fail closed as
   `authenticated_without_access`.

Active membership has priority over suspended/revoked history and applications.
Invitations are deliberately absent: they continue to require an explicit
one-time token and a separately reviewed contract.

## SQL security properties

- zero parameters;
- `RETURNS jsonb`;
- `STABLE`;
- `SECURITY DEFINER`;
- owner `postgres`;
- fixed `search_path = pg_catalog`; all non-catalog objects are explicitly
  schema-qualified;
- identity only from `auth.uid()`;
- no `auth.jwt()` or Auth metadata;
- no email comparison;
- no dynamic SQL;
- no writes or audit event;
- no table grants or policy changes;
- `EXECUTE` revoked from `PUBLIC`, `anon`, `authenticated` and `service_role`
  before being granted only to `authenticated`.

The existing parameterized `portal_get_account_context(text)` remains unchanged
and continues to authorize subsequent client-scoped reads. CP-3B.0 only
provides the safe bootstrap/selection context.

## Local disposable proof

`npm run qa:client-portal:cp3b0-proof` starts a loopback-only PostgreSQL 17
cluster, installs the required synthetic Auth/Storage compatibility baseline,
applies the canonical baseline, the frozen CP-2B migration and the new CP-3B.0
migration, and then tests:

- anonymous execute denial and authenticated execute grant;
- no records and internal-staff-only identities;
- own pending application and another user's hidden application;
- one active admin and one active member;
- deterministic two-client selection;
- suspended and revoked minimization;
- active precedence over suspended history and pending application;
- approved application without membership;
- unverified active membership denial;
- exact response keys, absence of PII and cross-user leakage;
- unchanged table grants and policies;
- local function rollback, reapply and a repeated matrix;
- zero synthetic fixture residue and cluster discard.

The generated report stays under
`qa-reports/private/client-portal/` and is not versioned.

Executed closeout evidence:

- focused CP-3B.0 tests: `11/11 PASS`;
- full suite: `353 passed / 4 skipped` across 63 files;
- project agent package: `160/160 PASS`;
- `npm run lint`: `PASS`;
- `npm run build`: `PASS`;
- QA preflight: `PASS`, `READ_ONLY_ROLLBACK`, new RPC absent;
- QA and production writes: `0`.

## Rollback and forward-fix

Before any remote apply there is no remote rollback. The local proof drops only:

```sql
drop function public.portal_resolve_self_access_context();
```

It then proves clean reapplication. A future QA gate must prepare a private
backup and an exact reviewed rollback before applying the migration. Production
requires a later independent gate.

## Evidence and next gate

Frozen hashes live in
`scripts/client-portal/cp3b0_self_access_context.manifest.json`.

The only permitted next action is a separately and explicitly authorized
CP-3B.0 QA application. CP-3B.1 must not resume until the deployed QA catalog
and authorization matrix pass.
