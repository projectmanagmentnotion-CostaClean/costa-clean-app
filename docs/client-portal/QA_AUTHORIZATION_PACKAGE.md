# CP-2 QA Authorization Package

Date: 2026-07-23
Current authorization: CP-2A source-only package complete; CP-2B none
Purpose: govern, not execute, the exact next QA gate

## Verdict

CP-0/CP-1 and the source-only CP-2A package may close. Remote CP-2B is not authorized by this document or commit.

The next gate is `continue` only after a separate user authorization names QA ref `kpvvydthlxupjjqqdpxy` and accepts the hashes frozen in `CP2B_EXACT_QA_AUTHORIZATION.md`. Production ref `wfxnwfcdjainpojhbdri` is always rejected.

## Objective

In QA only, introduce the internal-versus-customer trust split, portal tenancy tables, invitation/application/service-request/audit controls, private invoice-document delivery boundary and complete cross-client authorization tests without modifying canonical business/financial behavior.

## Required artifacts before execution

1. One uniquely versioned migration with immutable SHA-256.
2. Full SQL review for tables, constraints, indexes, RLS/FORCE RLS, policies, grants, default privileges, functions, owners and fixed search paths.
3. Exact Edge source/hashes and environment variable names without values.
4. Private bucket configuration and object policy SQL.
5. Synthetic seed for two clients, staff, admin/member, pending/revoked users, properties, jobs and non-fiscal dummy invoice documents.
6. Schema-only QA backup and rollback SQL derived from pre-state.
7. Project identity script proving public URL ref, private connection ref and live database ref equal QA and not production.
8. Test runner for the matrix below.
9. Secret/log/bundle scanning commands.
10. Evidence directory ignored by Git.

## Scope

Allowed only under separate authorization:

- QA schema/RLS/RPC/Edge/storage changes described in CP-1;
- Auth users only if the authorization explicitly permits synthetic QA users and cleanup;
- synthetic non-production portal fixtures;
- exact cleanup/reconciliation;
- portal-boundary tests.

## Non-goals

- production;
- public website/WordPress;
- portal UI;
- real clients or email matching;
- invoice issuance/correction/numbering;
- payments, closings, financial writes;
- job creation from service requests;
- existing Auth users;
- `db push`, migration repair/history writes;
- deployment beyond named QA Edge functions;
- real emails unless a sandbox mailbox is explicitly authorized.

## Stop conditions

Abort before mutation if:

- target identity is missing, ambiguous, production or unknown;
- working tree contains overlapping unreviewed changes;
- exact backup/rollback/hash allowlist is absent;
- migration history lock would be bypassed;
- any canonical policy still permits all authenticated users after planned commit;
- internal staff cannot be distinguished from portal members;
- an Edge secret is missing or would be printed/versioned;
- private bucket/public-policy assertions are incomplete;
- synthetic cleanup cannot be exact;
- migration touches invoice/payment/closing data, numbering or sequences;
- WordPress or production would be contacted for writes.

Abort after any failed step, execute only the pre-reviewed safe cleanup/rollback, and report honestly.

## Authorization matrix

For every endpoint, test:

| Identity | Own client | Other client | Random ID |
| --- | --- | --- | --- |
| anonymous | deny | deny | deny |
| unverified | deny | deny | deny |
| pending application | deny | deny | deny |
| suspended membership | deny | deny | deny |
| revoked membership | deny | deny | deny |
| active client_member | allow role capability | deny | deny |
| active client_admin | allow role capability | deny | deny |
| active internal staff | staff allowlist | staff allowlist | safe not-found |

Endpoints:

- account context;
- profile view/change request;
- properties list/detail/change request;
- services list/detail;
- service request list/create/cancel;
- invoices list/detail/download;
- invite/revoke member;
- application status;
- every canonical REST table and legacy RPC.

## Required test assertions

- Client A never reads/writes/downloads Client B.
- Wrong-client and random identifiers have the same status/body schema and acceptable timing variance.
- Portal identities cannot execute any current CRM/financial RPC or direct canonical DML.
- Pending/revoked identities return zero business rows.
- Member cannot invite/revoke/change role/client.
- Admin can act only within same client and cannot revoke staff or relink a client.
- Request submission creates one request only and zero jobs/quotes/invoices/payments.
- Document signature expires in 60 seconds and direct bucket/list access fails.
- Invitation is single-use, expiry/revocation works and raw token never persists.
- Recovery/signup responses do not enumerate users.
- rate limits pass burst/replay/expiry tests.
- logs, reports and built bundles contain zero secrets/tokens/PII fixtures.

## Validation commands

Mandatory after implementation:

```text
npm run lint
npm run build
npm test
npm run db:push                 # expected fail-closed only
npm run supabase:db:push        # expected fail-closed only
```

Plus exact local/disposable SQL proof, QA catalog assertions, live QA HTTP matrix and cleanup reconciliation. The two push commands are lock tests, not deployment.

## Rollback design

Rollback must:

- disable/revoke portal endpoints first;
- remove only portal synthetic objects/fixtures identified by exact IDs;
- restore pre-state canonical policies/grants from the private backup;
- never restore anonymous or any-authenticated broad access;
- leave invoice/payment/closing rows and sequences untouched;
- verify QA table/function/policy fingerprints and production unchanged.

Because replacing current authenticated policies is security-sensitive, a rollback that restores workspace-wide authenticated access is allowed only if no portal Auth users remain and the exact pre-state is proven. Otherwise stop for incident handling.

## Delivery

CP-2 final report must list exact refs, hashes, commands, counts, matrix results, cleanup, production `NO`, secrets `0`, commit/push and remaining blockers. It must not claim live success from source-only tests.
