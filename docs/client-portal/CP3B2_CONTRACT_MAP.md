# CP-3B.2 Contract Map

Date: 2026-07-28

Gate: `CP-3B.2 — Profile and properties`

Verdict: `BLOCKED`

Root cause: `CP3B2_REVIEWED_CHANGE_CONTRACT_MISSING`

Next required gate: `CP-3B.2A BACKEND REVIEWED CHANGE CONTRACT`

## Audit scope and evidence

This map reconciles the frozen CP-2B source, the CP-3B.0 self-access contract,
the current portal frontend and the deployed Supabase QA catalog. It does not
authorize or implement a backend or frontend change.

Evidence inspected:

- frozen CP-2B migration SHA-256:
  `ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277`;
- CP-3B.0 migration SHA-256:
  `c6161ddb4d5d85e139aea98a47429feae21d20dd06c5e3d54b579f58c5468731`;
- frozen Edge request parser and shared handler;
- current `src/portal/` Auth, route, adapter, preview and motion boundaries;
- CP-2B and CP-3B.0 QA closeout evidence;
- a fresh PostgreSQL QA catalog query inside an explicit read-only transaction
  followed by rollback;
- a fresh read-only Edge Function catalog listing.

The QA checks targeted only the approved QA project. The production project was
rejected before the database read. No row data, internal UUID, credential,
connection string, token or private environment value was printed or recorded.
Remote writes were `0`.

## Safe client-context origin

The authenticated portal first calls the zero-parameter
`public.portal_resolve_self_access_context()`. That function derives identity
only from `auth.uid()` and returns active membership contexts. The selected
client context may be held only in memory.

The read RPCs below accept a `p_client_id` because they predate the
self-resolving function. They do not trust it: each calls
`portal_private.current_portal_client_id(p_client_id)`, which requires the
authenticated caller to have an active, non-revoked membership for that exact
client. An invalid or cross-client value fails with the same
`resource_not_found` condition.

For Edge writes, the browser sends the selected in-memory client context, but
the trusted actor identity is independently derived from the verified bearer
session. The trusted SQL functions then require an active verified membership
for the actor and client. Email and Auth metadata do not establish tenancy.

## Contract inventory

### Profile read

| Field | Verified contract |
|---|---|
| Exact name | `public.portal_get_client_profile(p_client_id text)` |
| Method | Authenticated Supabase RPC |
| Input | One client identifier obtained from the resolved in-memory context |
| Output | JSON object with exact source keys `id`, `fullName`, `phone`, `email`, `taxId`, `billingAddress`, `status`, or SQL `null` |
| Roles | Active `client_admin` and `client_member` |
| Grant | `authenticated` may execute; `PUBLIC` and `anon` may not |
| Read/write | Read-only, `STABLE`, `SECURITY DEFINER` |
| Errors | Cross-client or inactive context becomes `resource_not_found`; malformed/transport errors must be mapped to neutral frontend errors |
| Limits | One canonical client row; deleted clients excluded |
| Logging | No application payload logging in the RPC |
| QA state | Present; authenticated execute grant confirmed |
| Frontend suitability | Not yet approved as a customer-safe DTO: canonical `id` must remain opaque, canonical `status` needs an approved public mapping, and `companyRepresentative` is writable through review but absent from this read model |

### Property list

| Field | Verified contract |
|---|---|
| Exact name | `public.portal_list_properties(p_client_id text, p_limit integer default 50)` |
| Method | Authenticated Supabase RPC |
| Input | Resolved in-memory client context and an optional limit |
| Output | JSON array of objects with `id`, `name`, `propertyType`, `address`, `city`, `postalCode`, `status` |
| Roles | Active `client_admin` and `client_member` |
| Grant | `authenticated` may execute; `PUBLIC` and `anon` may not |
| Read/write | Read-only, `STABLE`, `SECURITY DEFINER` |
| Errors | Cross-client or inactive context becomes `resource_not_found` |
| Limits | Limit clamped to `1..50`; deleted and archived properties excluded |
| Logging | No application payload logging in the RPC |
| QA state | Present; authenticated execute grant confirmed |
| Frontend suitability | Not yet approved as a customer-safe DTO: it needs strict array/item parsing, duplicate rejection, opaque identifier handling and an approved public mapping for canonical `status` |

### Property detail

| Field | Verified contract |
|---|---|
| Exact name | `public.portal_get_property(p_client_id text, p_property_id text)` |
| Method | Authenticated Supabase RPC |
| Input | Resolved in-memory client context and opaque property identifier from the route |
| Output | JSON object with `id`, `name`, `propertyType`, `address`, `city`, `postalCode`, `status`, or SQL `null` |
| Roles | Active `client_admin` and `client_member` |
| Grant | `authenticated` may execute; `PUBLIC` and `anon` may not |
| Read/write | Read-only, `STABLE`, `SECURITY DEFINER` |
| Errors | Cross-client context fails; absent and non-owned properties both return no row and must use identical neutral copy |
| Limits | One property; deleted and archived properties excluded |
| Logging | No application payload logging in the RPC |
| QA state | Present; authenticated execute grant confirmed |
| Frontend suitability | Not yet approved as a customer-safe DTO; the route identifier never replaces backend ownership validation and canonical `status` needs an approved public mapping |

### Profile correction request

| Field | Verified contract |
|---|---|
| HTTP surface | `portal-service-actions`, `POST` |
| Exact action | `submitProfileChange` |
| Trusted SQL | `public.portal_submit_profile_change_trusted(uuid, text, jsonb, text, uuid)` |
| Browser DTO | Exact keys `action`, `clientId`, `changes` |
| Allowed changes | `fullName`, `phone`, `email`, `taxId`, `billingAddress`, `companyRepresentative`; `1..6` fields; Edge accepts non-empty strings up to 320 characters, but has no field-specific format limits and does not explicitly reject control characters or HTML |
| Identity/tenancy | Bearer user verified server-side; trusted function accepts both active client roles and verifies membership |
| Write | Inserts only into `client_portal_profile_change_requests`; it does not update `clients` |
| Rate limit | Five accepted attempts per one-hour window for the hashed subject |
| Success output | HTTP `201` with `{ ok: true, requestId }` |
| Error surface | Generic `request_unavailable`; technical SQL/provider errors are not returned |
| Logging | Event name, status and correlation identifier only; no change payload |
| QA state | Edge surface and trusted function present; trusted function is executable only by `service_role` |
| Idempotency | **Missing**: no idempotency input, column, uniqueness rule or conflict replay |
| Receipt | **Incomplete**: returns an identifier but no authoritative request status or server timestamp |
| Safe frontend use | **No for CP-3B.2**: a network retry can create a second request and the response is not the required authoritative receipt |

### Property correction request

| Field | Verified contract |
|---|---|
| HTTP surface | `portal-service-actions`, `POST` |
| Exact action | `submitPropertyChange` |
| Trusted SQL | `public.portal_submit_property_change_trusted(uuid, text, text, jsonb, text, uuid)` |
| Browser DTO | Exact keys `action`, `clientId`, `propertyId`, `changes` |
| Allowed changes | `name`, `propertyType`, `address`, `city`, `postalCode`; `1..5` fields; Edge accepts non-empty strings up to 320 characters, but has no field-specific format limits and does not explicitly reject control characters or HTML |
| Identity/tenancy | Bearer user verified server-side; property must belong to the active selected client; both active client roles are allowed. The write check excludes `deleted_at` but, unlike the read RPCs, does not exclude `archived_at` |
| Write | Inserts only into `client_portal_property_change_requests`; it does not update `properties` |
| Rate limit | Five accepted attempts per one-hour window for the hashed subject |
| Success output | HTTP `201` with `{ ok: true, requestId }` |
| Error surface | Generic `request_unavailable`; absent and non-owned properties are not distinguished |
| Logging | Event name, status and correlation identifier only; no change payload |
| QA state | Edge surface and trusted function present; trusted function is executable only by `service_role` |
| Idempotency | **Missing**: no idempotency input, column, uniqueness rule or conflict replay |
| Receipt | **Incomplete**: returns an identifier but no authoritative request status or server timestamp |
| Safe frontend use | **No for CP-3B.2**: a network retry can create a second request and the response is not the required authoritative receipt |

### Own correction-request status

No narrow RPC or Edge action exists to list or retrieve the authenticated
caller's profile/property correction requests or their status.

The underlying request tables have same-client select policies and an
`authenticated` table grant. Those policies are client-wide rather than
requester-only, so any active member of the client can read every request row
for that client, including proposed changes and review metadata. CP-3B.2 also
explicitly prohibits direct table access from `src/portal`. That broad table
path is therefore neither a minimized receipt/status DTO nor an approved
frontend contract and cannot be used to fill the gap.

## QA catalog result

The fresh controlled QA read confirmed:

| Check | Result |
|---|---|
| Profile read RPC | Present |
| Property list RPC | Present |
| Property detail RPC | Present |
| Trusted profile submit function | Present; returns `uuid`; service-only |
| Trusted property submit function | Present; returns `uuid`; service-only |
| Four frozen portal Edge Functions | Present |
| Profile/property request idempotency columns | `0` |
| Profile/property request unique constraints | `0` |
| Narrow own-change status functions | `0` |
| QA writes caused by this audit | `0` |
| Production writes | `0` |

## Definition of Ready decision

The read side is available, but the reviewed-change workflow is not complete
enough for CP-3B.2:

1. neither correction action accepts an idempotency key;
2. neither request table has a uniqueness contract that can deduplicate a
   repeated intent;
3. retry after an ambiguous network outcome can insert a duplicate row;
4. success returns only a UUID, not a receipt containing an authoritative
   status;
5. no narrow frontend-safe contract can retrieve the caller's own request
   status;
6. canonical profile/property status values and opaque identifier exposure do
   not yet have an approved customer-safe DTO mapping;
7. field-specific validation, control-character handling and the archived
   property write rule are incomplete.

Rate limiting does not provide idempotency and cannot make an ambiguous retry
safe. A synthetic receipt or client-generated success state would be a fake
save and is prohibited.

Independent security classification:

- `P1`: the broad `authenticated SELECT` path on both correction-request
  tables exposes proposed PII and internal requester/reviewer identifiers to
  every active member of the same client; a frontend convention against
  `.from(...)` does not remove that database exposure;
- `P2`: customer-safe PII/fiscal DTOs, per-role exposure and public opaque
  references are not approved;
- `P2`: archived properties are rejected by reads but remain eligible for the
  trusted property-change insert.

Therefore CP-3B.2 fails its contractual Definition of Ready and stops before
frontend implementation. No profile/property UI, adapter, StepFlow, preview,
motion, test or roadmap completion change is authorized in this gate.

## Required CP-3B.2A outcome

A separately reviewed and authorized backend gate must provide, for both
profile and property correction intents:

- a bounded idempotency input generated once per user intent;
- server-enforced duplicate handling with payload-conflict behavior;
- an authoritative receipt containing a public tracking identifier and exact
  request status;
- a narrow own-request status/list contract;
- removal of the broad customer table-select path, with frontend access limited
  to the minimized narrow status contract;
- exact DTOs, field and character limits, neutral errors, grants, audit and
  rate-limit behavior;
- an explicit requester-only or tenant-shared visibility decision with a
  minimized response that never exposes internal review metadata;
- consistent denial for deleted and archived properties;
- approved customer-safe status mappings and opaque identifier handling;
- cross-client, retry, concurrency and rollback/cleanup proof in a disposable
  environment before any separately authorized QA application.

## CP-3B.2A resolution

CP-3B.2A closes the source-contract gap with the forward-only, not-yet-applied
migration `20260728160000_portal_reviewed_change_contract.sql`.

The new frozen public surface is:

- `portal_submit_profile_change_request_v2(text, jsonb, uuid)`;
- `portal_submit_property_change_request_v2(text, text, jsonb, uuid)`;
- `portal_list_own_profile_change_requests_v2(text, integer)`;
- `portal_list_own_property_change_requests_v2(text, text, integer)`.

The submit functions use `auth.uid()`, active verified membership, normalized
allowlists, partial unique idempotency indexes and opaque public references.
They return persisted receipts. The lists expose only the requester's minimized
status DTO.

The migration removes the two customer-wide request-table select policies while
preserving internal-staff policies. It revokes `service_role` execution from the
two non-idempotent legacy submit functions, so legacy Edge actions fail closed
until a separately authorized compatible Edge change exists. No Edge artifact
changes in this gate.

Disposable PostgreSQL 17 proved the original gap, security matrix, concurrent
retry, rollback, reapply and zero fixture residue. The controlled QA preflight
confirmed only the pre-CP-3B.2A catalog state in a read-only transaction.

State after CP-3B.2A:

- source/local proof/read-only preflight: `DONE`;
- QA application: `NOT_AUTHORIZED`;
- CP-3B.2: `BLOCKED_PENDING_CP3B2A_QA`;
- CP-3B.3: `NOT_STARTED`.

The CP-3B.2A package resolves only the reviewed-change write/status contract.
It does not change the frozen profile/property read RPCs. Before CP-3B.2
frontend implementation starts, its Definition of Ready must still freeze the
customer-safe mapping for canonical `status` and the treatment of canonical
profile/property identifiers as opaque values. Applying CP-3B.2A in QA is
necessary, but not by itself sufficient, to authorize CP-3B.2.
