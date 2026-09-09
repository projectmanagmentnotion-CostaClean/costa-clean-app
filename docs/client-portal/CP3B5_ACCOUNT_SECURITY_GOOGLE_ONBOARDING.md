# CP-3B.5 Accounts, Security, Google OAuth and Billing Onboarding

Date: 2026-09-09

## Result

`PARTIAL — backend QA deployed; authenticated E2E identity/configuration pending`

The existing portal Auth lifecycle is suitable for Google sign-in. The
mandatory fiscal/billing contract is now implemented and deployed only to QA;
the authenticated E2E matrix remains pending because no private synthetic Auth
identity is available in this session. Production was not changed.

## Audit and gap map

CP-3B.4 remains `PARTIAL — implementation complete; browser download, expiry
and negative authorization certification pending`. This is certification debt,
not an auth/tenancy defect blocking the source audit.

| Area | Current evidence | Result |
| --- | --- | --- |
| Portal Auth | Isolated Supabase client, persisted PKCE session, Auth event lifecycle, generic recovery | Reused |
| Self access | Parameterless `portal_resolve_self_access_context()` with strict DTO parsing and explicit active memberships | Reused; email is not tenancy proof |
| Application | `client_portal_applications` stores email, contact name, company name, phone, status, privacy version | `BACKEND_GAP_FOUND`: no customer type or mandatory billing/fiscal fields |
| Submission | `portal_submit_application_trusted` accepts only contact/company/phone/privacy and writes `pending_review` | Requires new validated contract |
| Membership | Membership/invitation tables and trusted acceptance/revocation RPCs exist | Foundation exists; member UI/certification remains open |
| Legal | `client_portal_legal_acceptances` stores version/hash/user/membership/client/locale/time/correlation | Suitable table; no CP-3B.5 acceptance RPC/UI path found |
| Audit/rate limits | Append-only audit table and trusted rate-limit helper exist | Reuse |
| MFA | AAL is recorded and AAL2 checks exist for admin actions | Ready; not forced |
| Marketing | No dedicated consent record found; legal acceptance excludes marketing | `BACKEND_GAP_FOUND`; do not overload legal |
| Google provider QA | Dashboard/allowlist not verifiable from repository-only access | `NOT_VERIFIED`; no secrets invented or printed |

## Google OAuth source/runtime

- `signInWithGoogle()` uses the existing portal lifecycle/provider boundary.
- The provider calls Supabase `signInWithOAuth` with `provider: 'google'`.
- Redirect is exactly the current allowed origin plus `/portal` (local QA:
  `http://127.0.0.1:4174/portal`).
- No extra scopes, custom token storage, Gmail/Drive/Calendar/Contacts access,
  or provider-token logging was added.
- Post-callback routing still resolves self-access; Google identity alone cannot
  unlock a client.

Provider configuration is `NOT_VERIFIED` because no authorized Supabase
Dashboard/API configuration read was available. Manual QA setup must enable
Google privately and allow only the exact QA portal origin and Supabase callback
URL. Production was not inspected or changed.

## Backend QA execution result

The QA-only migration, legal fixture, consent catalog and trusted onboarding
RPC are applied. `portal-account-actions` is deployed as version 11 with JWT
verification enabled. The current package is pinned by
`scripts/client-portal/cp3b5a_qa_package.manifest.json`.

Repository checks: `628 passed`, `4 skipped`; lint, QA build and diff check pass.
Historical manifests remain unchanged and are verified against their matching
Git blobs rather than the current mutable shared contract.

The following are intentionally `NOT_EXECUTED` until a private QA Auth
identity/session is available: individual/business submissions, marketing
true/false runtime receipts, forged-field HTTP negatives, same-key retries,
transaction rollback, no-active-legal fail-closed test, email-match-no-tenancy,
cross-tenant isolation, direct-grant probes, and authenticated browser/network
smoke. No production writes or deploys occurred.

## Backend change gate

`BACKEND_GAP_FOUND` — do not apply until explicitly authorized.

Minimum proposed package:

1. Extend `client_portal_applications` with proposed, reviewable fields:
   `customer_type`, `first_name`, `last_name`, `legal_name`, `trade_name`,
   `tax_id`, `contact_person`, `billing_address`, `postal_code`, `city`,
   `region`, and `country`, with conditional checks for individual/business
   and bounded lengths. These do not overwrite `clients`.
2. Add dedicated `client_portal_consents` for optional marketing purpose:
   purpose, status, version/text reference, source, consented/withdrawn times,
   user/application/correlation identifiers. It is unchecked by default.
3. Replace/extend `portal_submit_application_trusted` with one atomic,
   server-validated contract deriving email from Auth, writing `pending_review`,
   recording required versioned legal acceptance, and recording marketing only
   when explicitly opted in.
4. Add a narrow trusted legal/consent receipt path if no existing RPC is
   suitable. The caller cannot choose client, membership role, approved client,
   document hash, or document version.

Canonical `clients` fields (`full_name`, `tax_id`, `billing_address`, `email`,
`phone`) remain unchanged. Approval/linkage remains an internal decision that
creates/links the canonical client and then creates an explicit membership.

RLS/grants: keep `FORCE ROW LEVEL SECURITY`, deny customer table DML, allow
only own safe application reads, make application/consent/legal writes trusted
RPC/service-role only, and keep raw fiscal payloads out of audit metadata.

Rollback: drop only new CP-3B.5 functions/consent objects and remove added
application columns after checking no approved application depends on them;
restore the previous function signature only through a reviewed rollback
migration with private prestate proof. No remote rollback is authorized here.

Synthetic QA matrix: email existing member; Google new/existing member; no
membership to onboarding; incomplete/complete conditional billing; pending
review with no client data; active/multiple/suspended/revoked routing; no email
auto-link; marketing unchecked/checked; legal key/version/hash evidence; admin
invite/revoke versus member denial; hashed expiring single-use invitation;
cross-tenant, role-escalation, client-id-choice, token-leak and service-role
negatives.

## Manual next action

Provide a private QA Auth identity/session and run the synthetic CP-3C.1/CP-3C.2
identity and cross-tenant matrix. Google provider configuration remains
`PRIVATE_CONFIG_PENDING`. Do not start CP-3C automatically or touch production
configuration.
