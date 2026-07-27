# CP-2A.3 — Bootstrap contract fix

Date: 2026-07-27
Status: `DONE / LOCAL-DISPOSABLE PROOF PASS / REMOTE EXECUTION NOT AUTHORIZED`
Remote writes: `0`

## Root cause

The frozen `cp2b_apply.sql` created `cp2a_bootstrap_staff(user_id, staff_role, status)` and inserted both the real active staff identity and the synthetic suspended-staff identity.

The frozen migration requires `pg_temp.cp2a_bootstrap_staff(user_id, role)` and executes:

```sql
select b.user_id, b.role, 'active'
```

The first executable incompatibility is therefore a column-contract mismatch. Disposable PostgreSQL 17 reproduced:

- SQLSTATE: `42703`;
- file: `20260723160000_client_portal_security_boundary.sql`;
- line: `656`;
- redacted identifier: `BOOTSTRAP_COLUMN_MISMATCH`.

No earlier executable migration error was found.

## Why the failed attempt left zero portal tables

The immutable migration starts an explicit transaction. The missing `b.role` failure occurred before its final commit, so PostgreSQL rolled back the schema, tables, policies, functions and grants created in that transaction. Independent post-recovery evidence found zero portal tables.

## Why suspended staff is not bootstrap data

Bootstrap establishes the already-confirmed real internal staff authority required to create the security boundary. The migration deliberately turns every bootstrap row into an `active` internal membership.

The suspended staff identity is synthetic negative-test data. Adding it to bootstrap would incorrectly activate it. Its correct lifecycle is:

1. create the synthetic Auth identity dynamically;
2. apply the migration with only the real active staff identity;
3. insert the synthetic staff membership through the frozen V2 fixtures as `operator / suspended`;
4. prove suspended denial in the matrix;
5. remove it through exact cleanup.

## V4 correction

`cp2b_apply_v4.sql`:

- requires `project_ref` and `active_staff_user_id`;
- rejects production and unknown targets before the migration;
- validates the UUID and confirms that it exists in `auth.users`;
- creates exactly `cp2a_bootstrap_staff(user_id uuid primary key, role text not null)`;
- inserts only the real active identity with role `admin`;
- does not accept or bootstrap `suspended_staff_user_id`;
- includes the immutable migration without changing migration history.

`run-cp2b-qa-v4.mjs` preserves the V3 launcher and the V2 Auth, ledger, fixture, matrix, cleanup and recovery contracts. Its only execution-flow correction is the explicit use of `cp2b_apply_v4.sql`.

## Evidence

The CP-2A.3 PostgreSQL 17 proof demonstrated:

- original apply failure reproduced as SQLSTATE `42703`;
- invalid and missing active staff rejected before migration;
- production and unknown targets rejected;
- V4 migration applied;
- 11/11 portal tables with RLS and FORCE RLS;
- exactly one active membership for the real staff identity;
- no suspended identity in bootstrap;
- frozen fixtures insert synthetic staff only as suspended;
- missing synthetic suspended Auth identity rolls back fixtures;
- parameterized authorization matrix passes;
- exact cleanup leaves no synthetic fixtures;
- frozen recovery removes the portal boundary after a post-migration scenario;
- dynamic Auth stubs are deleted;
- zero local residue and discarded cluster.

The private QA schema archive was restored as `public` into a disposable PostgreSQL database with compatibility-only Auth/Storage schemas. V4 applied successfully there, detecting no additional public-catalog incompatibility. The archive, catalog, reports and incident ledger remain outside Git.

## Recovery and remaining risk

The frozen V2 disable-first recovery remains authoritative for a future authorized V4 execution. No recovery logic was changed.

Remaining risk:

- CP-2B has not run with V4 in Supabase Cloud QA;
- Edge deployment, Storage and HTTP denial evidence remain unproven for V4;
- invitation delivery remains `NOT IMPLEMENTED`;
- a new private backup must be created for the exact future authorized V4 HEAD;
- V4 requires a new explicit authorization and cannot inherit V2 or V3 authorization.

Production, WordPress, SiteGround, `/portal`, CP-3, migration history, financial records and fiscal sequences were not modified.

Closeout note: the frozen authenticated CP-2A.2 Windows proof passed through an explicitly authorized private-auth process. It confirmed the real Windows shim, Supabase version and project listing, QA link, production rejection, V3 plan/preflight, negative execution gates and secret redaction with zero remote writes. No private value was printed or versioned. CP-2B remains `BLOCKED_PENDING_EXPLICIT_V4_AUTHORIZATION`.
