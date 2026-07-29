# CP-3B.2A.4 — Authorization and concurrency matrix V4

Status: `DONE — PACKAGE PREPARED_NOT_AUTHORIZED`

This gate corrects the evidence gap that stopped the V3 QA application before
effects. It does not change the reviewed-change migration, the portal UI, the
CRM, invoices, production or QA. V1, V2 and V3 remain byte-frozen.

## Evidence boundary

The V4 package separates two kinds of evidence:

| Section | Isolation | Required result |
|---|---|---|
| Authorization and payload matrix | One PostgreSQL transaction | `PASS_ROLLED_BACK` |
| Concurrency matrix | Committed synthetic fixtures shared by independent sessions | `PASS_CLEANED` |

The transactional matrix invokes all four public RPCs under the real `anon`
database role. It also invokes all four RPCs for verified authenticated
identities with no membership, revoked membership and suspended membership.
Every call records its case ID, SQLSTATE and public message. Expected denials
are exact: `42501` for `anon`, and the neutral `P0002/resource_not_found` for
membership failures.

The active-member payload matrix calls the RPCs with array and scalar JSON,
empty objects, unknown/protected fields, `id`, `client_id`, wrong types,
oversized values, valid-plus-extra fields and a foreign property. The contract
requires exact `22023/invalid_change_request` or the neutral
`P0002/resource_not_found`. Request, audit, rate-limit and canonical digests
must remain unchanged.

## Real concurrency proof

Each race uses a coordinator, two independent worker `psql` processes and an
observer connection:

1. the coordinator holds `SHARE` on the exact request table;
2. both RPC workers reach the real `INSERT`;
3. the observer proves two distinct backend PIDs with ungranted
   `RowExclusiveLock`, both blocked by the coordinator;
4. only then is the coordinator committed and the workers released.

This is a database barrier at the insertion boundary. A timer, sequential
retry, JavaScript mock or `Promise.all` without lock evidence cannot pass.

Profile and property each execute:

- same key and same payload: two identical authoritative receipts, one request,
  one audit and one rate-limit increment;
- same key and different payload: one receipt, one exact
  `23505/idempotency_conflict`, one request, one audit, one rate-limit
  increment, and a stored payload equal to exactly one contender.

Deadlock, timeout, two successes for conflicting payloads, receipt drift,
duplicate request/audit or double rate consumption are hard failures.

## Fixtures and recovery

Fixtures use a cryptographically random `CP3B2A-V4-*` run ID, random UUIDs,
`example.invalid`, and names explicitly marked QA synthetic. Auth rows are
created only by controlled SQL; no Auth Admin API, email or external session is
used. `session_replication_role=replica` is scoped only to the exact Auth
insert/delete.

Cleanup owns an exact inventory and deletes in FK-safe order: audit, rate
subjects, property/profile requests, membership, property, client and Auth
user. Full pre/post digests cover Auth, canonical entities, memberships,
requests, audit and rate limits. Any unverifiable cleanup becomes
`MANUAL_VERIFICATION_REQUIRED`; the DDL rollback must not proceed speculatively.

Maximum apply attempts: `1`. Maximum recovery attempts: `1`. Automatic retries:
`0`. The frozen V3 private failure envelope is retained and re-read before any
recovery.

## Gate result

- CP-3B.2A QA application V3:
  `BLOCKED_BEFORE_EFFECT — SUPERSEDED`
- CP-3B.2A.4: `DONE`
- CP-3B.2A QA application V4:
  `READY_PENDING_EXPLICIT_V4_AUTHORIZATION`
- CP-3B.2: `BLOCKED_PENDING_CP3B2A_QA_V4`
- CP-3B.3: `NOT STARTED`

No legal, security or technical text in this package represents professional
legal approval.
