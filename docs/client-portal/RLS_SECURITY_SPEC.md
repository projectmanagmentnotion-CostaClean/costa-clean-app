# RLS Security Specification

Date: 2026-07-23
Status: exact target specification, not executed SQL

## P0 prerequisite

The current canonical policies grant SELECT to every `authenticated` session when `auth.uid()` is non-null. Before any portal Auth user is created, CP-2 must replace that assumption on all canonical and sensitive tables with explicit internal staff authorization.

The QA migration must be atomic: either the staff split, portal tables, grants and tests all commit, or nothing commits.

## Database schemas and grants

- `public`: canonical CRM and portal tables required by the existing repository. No implicit grants.
- `portal_private`: helper functions and rate-limit internals; not exposed by PostgREST.
- Exposed functions live in `public` only when PostgREST requires it and are individually granted.
- Default privileges revoke table/function access from `PUBLIC`, `anon` and `authenticated`; re-grant only the allowlist.
- Customer-facing writes use narrow RPC/Edge functions. No `service_role` reaches the browser.

## Helper predicates

Target semantics:

```sql
portal_private.is_internal_staff(p_user_id uuid)
portal_private.has_active_membership(p_user_id uuid, p_client_id text)
portal_private.has_client_role(p_user_id uuid, p_client_id text, p_roles text[])
portal_private.require_active_membership(p_client_id text)
```

Helpers are `STABLE SECURITY DEFINER`, owned by a non-login migration owner, use `SET search_path = pg_catalog, public, portal_private`, fully qualify relations, reject nulls, and have EXECUTE revoked from all API roles unless SQL policy evaluation requires a controlled grant. They return only booleans or a minimal membership row.

## Exact policy intent

### Internal staff

For every canonical table currently readable to authenticated users (`clients`, `properties`, `leads`, `jobs`, `job_lines`, `quotes`, `quote_lines`, `invoices`, `invoice_lines`, `payments`, `expenses`, closings, intake, drafts, audit and quiz history):

```sql
DROP POLICY IF EXISTS "Authenticated read access" ON public.<table>;
CREATE POLICY "Internal staff read"
ON public.<table>
FOR SELECT TO authenticated
USING (portal_private.is_internal_staff((SELECT auth.uid())));
```

Existing write policies/RPCs must also call `is_internal_staff`, not merely `auth.uid() is not null`. In particular, `require_authenticated_write()` and `require_authenticated_financial_write()` must be replaced or hardened to require active internal staff. Portal users receive zero execution on `create_client`, `update_client`, property/job writes, quote/invoice/payment/closing functions and audit functions.

### `client_portal_memberships`

```sql
ALTER TABLE public.client_portal_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY "Portal user reads own active membership"
ON public.client_portal_memberships
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND status = 'active'
  AND revoked_at IS NULL
);
```

No INSERT/UPDATE/DELETE policy for portal users. Internal staff and Edge mutate through a separately guarded function. The API projection omits internal revocation notes and staff IDs.

### `client_portal_applications`

```sql
CREATE POLICY "Applicant reads own application"
ON public.client_portal_applications
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
```

No direct INSERT/UPDATE/DELETE. Registration/withdrawal uses rate-limited Edge/RPC. An applicant cannot set `approved_client_id`, status or reviewer fields.

### `client_service_requests`

```sql
CREATE POLICY "Portal reads same-client requests"
ON public.client_service_requests
FOR SELECT TO authenticated
USING (
  portal_private.has_active_membership(
    (SELECT auth.uid()),
    client_id
  )
);
```

No direct INSERT/UPDATE/DELETE policies. RPCs validate membership, property ownership, state transition, `requested_by = auth.uid()` and payload schema. Internal staff reads/writes require `is_internal_staff`.

### Invitations, rate limits and audit

`client_portal_invitations`, `client_portal_rate_limits`, `client_portal_audit_events` and private document registry have no customer table policies. They are trusted-code only. A customer may receive a filtered activity receipt from a purpose-built RPC, never table SELECT.

### Profile/property changes and legal evidence

Change-request tables use the same own-client SELECT predicate as service requests and have no direct customer DML. Submission RPCs set requester/client/property from authenticated context; review/status/canonical apply fields are internal-only.

`client_portal_legal_acceptances` allows a user to read only its own safe acceptance receipt. Creation occurs through a narrow acceptance RPC that chooses the current server-side document version/hash; callers cannot submit an arbitrary hash/version. UPDATE/DELETE are denied.

Do not expose a SECURITY DEFINER view as a shortcut. If a view is used, prove its security mode and underlying policies explicitly. The preferred first release is typed RPC results because canonical staff RLS must deny portal identities.

## Narrow canonical reads

Portal users do not receive direct grants on canonical tables. Functions use `SECURITY DEFINER` only when needed to read canonical data and must:

1. require a non-null Auth user;
2. require verified email where relevant;
3. accept one explicit `p_client_id`;
4. resolve one active membership;
5. use exact joins (`row.client_id = p_client_id`);
6. exclude archived/deleted/cancelled records unless the product explicitly needs a safe status;
7. list columns explicitly;
8. cap rows and validate pagination;
9. return generic not-found for wrong client/unknown IDs;
10. use fixed search path and fully qualified tables.

Example invoice list projection:

```sql
SELECT
  i.id,
  i.invoice_number,
  i.issue_date,
  i.status,
  i.total,
  public.portal_safe_payment_state(i.id) AS payment_state
FROM public.invoices AS i
WHERE i.client_id = p_client_id
  AND i.deleted_at IS NULL
  AND portal_private.has_active_membership(auth.uid(), p_client_id)
ORDER BY i.issue_date DESC
LIMIT least(p_limit, 50);
```

It does not return `internal_notes`, `pricing_metadata`, sequence diagnostics or other-client aggregates.

## Function execution allowlist

| Function/endpoint | anon | portal member | portal admin | internal staff | service role |
| --- | --- | --- | --- | --- | --- |
| public registration/recovery Edge | call with abuse controls | call | call | call | server |
| portal read RPCs | deny | own client | own client | optional support path | server |
| service request RPCs | deny | own client | own client | review path | server |
| invite/revoke Edge | deny | deny | same client + AAL policy | allow by staff role | server |
| invoice download Edge | deny | own client | own client | support policy | server |
| canonical CRM/financial RPCs | deny | deny | deny | explicit existing allowlist | server |
| audit/rate-limit/token tables/functions | deny | deny | deny | narrow admin tooling | server |

## Cross-client allow/deny matrix

| Actor / operation | Own client | Other client | Unknown ID | Expected envelope |
| --- | --- | --- | --- | --- |
| anonymous list/detail/download/write | deny | deny | deny | 401/generic |
| pending/unverified user | deny | deny | deny | generic pending/no data |
| revoked/suspended member | deny | deny | deny | 401/403 generic |
| active member read safe projection | allow | deny | deny | wrong/unknown both `not_found` |
| active member submit request to own property | allow | deny | deny | no existence oracle |
| active member invite/revoke | deny | deny | deny | role denied |
| active admin invite same client | allow | deny | deny | client derived server-side |
| portal user canonical table/RPC access | deny | deny | deny | permission denied |
| internal staff | by staff role | by staff role | n/a | internal authorization |

## Mandatory catalog assertions

CP-2 QA must prove:

- RLS and FORCE RLS on every portal table;
- zero canonical policy predicates equivalent to “any authenticated user”;
- zero portal execution on legacy CRM/financial functions;
- zero anon portal table grants;
- fixed `search_path` and expected owner for every SECURITY DEFINER function;
- no view owned by a bypass-RLS role exposes canonical rows without the same membership check;
- private storage bucket and object policies have no public/anon access;
- one exact allowlist of functions granted to authenticated.

## Mandatory negative tests

Use two clients, two users, pending, revoked and anonymous identities. Test every list/detail/create/cancel/invite/revoke/download endpoint with own, other and random IDs. Assert response status/body class, row count, unchanged database state, uniform error semantics and zero secret/PII log findings.
