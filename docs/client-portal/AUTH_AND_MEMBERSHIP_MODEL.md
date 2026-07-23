# Auth And Membership Model

Date: 2026-07-23
Scope: CP-1 design; no Auth or user changes executed

## Identity is not tenancy

Supabase Auth proves control of an authentication factor. It does not prove that the user belongs to a Costa Clean CRM client. Email verification and CRM email equality never create or select a membership.

Access requires:

```text
valid Auth session
AND verified email
AND active, non-revoked client_portal_membership
AND endpoint role permission
AND row.client_id = membership.client_id
```

## Target entities

### `internal_staff_memberships`

Required before the first customer Auth user because current canonical policies trust every authenticated user.

| Field | Type / rule |
| --- | --- |
| `user_id` | uuid PK, FK `auth.users(id)` |
| `role` | `owner`, `admin`, `operator`, `finance`, `readonly` |
| `status` | `active`, `suspended`, `revoked` |
| `created_at`, `created_by`, `revoked_at`, `revoked_by` | audit fields |

### `client_portal_memberships`

| Field | Type / rule |
| --- | --- |
| `id` | uuid PK |
| `user_id` | uuid FK `auth.users`; not null |
| `client_id` | text FK `clients`; not null |
| `role` | `client_admin` or `client_member` |
| `status` | `active`, `suspended`, `revoked` |
| `invitation_id` | uuid nullable, immutable link to evidence |
| `approved_by` | uuid internal staff, not customer supplied |
| `invitation_accepted_at`, `created_at`, `updated_at` | timestamptz |
| `revoked_at`, `revoked_by`, `revocation_reason_code` | nullable revocation evidence |
| `last_role_changed_at`, `last_role_changed_by` | role audit |

Constraints:

- unique `(user_id, client_id)`;
- no update to `user_id` or `client_id`; revoke and recreate instead;
- at least one `client_admin` may be required operationally, but the database must allow staff emergency revocation of the last admin;
- customer sessions have SELECT on their own safe membership projection only and no direct DML.

One user may hold separately approved memberships in more than one client. Every API call includes one explicit client context and validates that exact membership; permissions are not unioned across clients.

### `client_portal_invitations`

| Field | Rule |
| --- | --- |
| `id` | uuid public reference |
| `client_id` | exact staff-selected client |
| `email_normalized` | lower/trimmed delivery address; not used to find a client |
| `role` | customer role only |
| `token_hash` | HMAC-SHA-256 or equivalent with Edge-held pepper; raw token never stored |
| `expires_at` | default 72 hours, maximum 7 days |
| `status` | `pending`, `accepted`, `expired`, `revoked` |
| `invited_by`, `created_at`, `accepted_by`, `accepted_at`, `revoked_by`, `revoked_at` | evidence |
| `attempt_count`, `last_attempt_at` | abuse control without raw IP |

Only trusted server code can read/write this table. A token is at least 32 random bytes, single-use and invalidated transactionally on acceptance.

### `client_portal_applications`

Open registration creates an application, never a client or membership.

Fields: `id`, `user_id`, `email_normalized`, optional contact/company data, `status` (`pending_review`, `approved`, `rejected`, `withdrawn`, `expired`), `submitted_at`, `reviewed_by`, `reviewed_at`, `decision_reason_code`, `approved_client_id`, `privacy_notice_version`.

Before approval the user can view only a generic application state. Staff manually resolves the exact client. Email similarity may be shown to staff as a non-authoritative hint, never used by code to link.

### Supporting security/evidence entities

`client_portal_audit_events` is append-only trusted-code evidence with:

- `id`, `occurred_at`, `event_type`, `result`;
- `actor_user_id`, nullable `membership_id`, `client_id`;
- nullable target type/opaque ID;
- correlation/request ID, AAL and coarse risk code;
- privacy-minimised JSON metadata constrained to an event allowlist.

Event types cover application submitted/approved/rejected, invitation created/accepted/revoked/expired, membership created/role-changed/suspended/revoked, login/recovery security notices, MFA enrol/reset, profile/property change requested/resolved, service request submitted/transitioned/cancelled and invoice download allowed/denied. It stores no raw tokens, passwords, OTPs, signed URLs, object keys, full addresses, tax IDs, notes, invoice bodies, raw IPs or user agents.

`client_portal_rate_limits` stores a peppered HMAC subject key, action, fixed/rolling window, count and expiry. It has no browser policies.

`client_profile_change_requests` and `client_property_change_requests` store the exact safe proposed fields, status, requester, reviewer and timestamps. Fiscal/client reassignment fields are never applied by a portal RPC.

`client_portal_legal_acceptances` stores contractual document key/version/hash, user, membership/client, locale, acceptance timestamp and correlation ID. Marketing consent and cookie choices are not stored in this table.

## Roles

| Capability | client_admin | client_member |
| --- | --- | --- |
| Read own profile/properties/services/invoices | allow | allow |
| Submit/cancel own service request | allow | allow |
| Submit profile/property change request | allow | allow |
| Invite member to same client | allow via Edge, rate limit, preferably AAL2 | deny |
| Revoke same-client member | allow via Edge; cannot revoke staff or other client | deny |
| Change client identity/client link | deny | deny |
| Issue invoice, record payment, create/approve job | deny | deny |
| Read internal notes/audit/expenses/closings | deny | deny |

## Registration and invitation

### Invitation-first

1. Internal staff chooses exact client and role.
2. Edge creates one token and sends the invite.
3. User verifies email and authenticates.
4. Acceptance validates authenticated email against invite delivery email, but client linkage comes only from `invitation.client_id`.
5. One transaction marks invite accepted and creates membership.
6. Existing membership returns the same success result idempotently if it matches; conflicting membership stops for staff review.

### Pending registration

1. Signup and email verification.
2. Generic acknowledgement regardless of CRM email existence.
3. Application remains `pending_review`; zero CRM data.
4. Staff approval selects exact `clients.id`.
5. Trusted transaction creates membership and records approval.

## Authentication controls

- Production email confirmation is mandatory even though local `supabase/config.toml` currently sets `enable_confirmations = false`; local config is not proof of remote settings.
- Password policy target: minimum 12 characters or approved passwordless flow after provider review; breached-password protection where available.
- Auth errors are mapped to generic Spanish copy. Raw provider error messages are not shown.
- Redirect allowlist contains only exact production/QA/local portal callback URLs; no wildcard origins.
- Session storage remains Supabase-managed. No token appears in URL after callback.
- Logout invalidates local session immediately and uses server/global revocation for security events where supported.

## MFA-ready design

- Do not encode tenancy solely in mutable user metadata.
- `client_admin` high-risk actions accept only `aal2` once MFA is enabled.
- Store no TOTP secret in portal tables; Supabase Auth owns factors.
- UI handles `aal1 -> aal2` challenge without losing the intended action.
- Recovery codes/factor resets require recent authentication, generic notices and audit.

MFA is capability-ready in CP-2 and may be optional during an invite-only pilot; production policy is a separate decision.

## Recovery and anti-enumeration

Recovery endpoint always returns the same HTTP status, body and approximate timing for existing/non-existing/suspended accounts. It validates origin and redirect, applies IP plus pseudonymous email throttles and triggers CAPTCHA after risk thresholds.

On successful password/factor change:

- notify the account email;
- revoke other sessions where supported;
- require fresh membership evaluation;
- log a security event without secret material.

## Rate-limit targets

These are initial QA values and must be tuned without weakening provider limits:

| Action | Burst / sustained target | Subject keys | Response |
| --- | --- | --- | --- |
| signup/application | 3 per IP per 15 min; 5 per email HMAC per 24 h | IP prefix HMAC + email HMAC | generic accepted; CAPTCHA escalation |
| password recovery | 3 per IP per 15 min; 3 per email HMAC per 24 h | IP/email HMAC | identical 202 response |
| invitation creation/resend | 5 per admin per hour; 10 per client per day; resend cooldown 15 min | actor/client/email HMAC | generic, audited |
| invitation acceptance | 10 failed attempts per invitation then revoke; 5 per IP per 15 min | invitation ID + IP HMAC | generic invalid/expired |
| login | Supabase provider limit plus CAPTCHA/risk escalation; no custom existence response | provider/IP | generic credentials error |
| service requests | burst 2 per minute; 5 accepted per user/client per hour | user/client + IP HMAC | 429 with safe retry |
| invoice signatures | burst 5 per minute; 30 per user/client per hour | user/client/document | 429; no URL minted |
| member invite/revoke | 10 actions per admin/client per hour | actor/client | 429 + security event |

Rate-limit cleanup follows the retention matrix. Raw emails/IPs never enter the limiter table.

## Revocation

Revocation sequence:

1. Set membership `revoked` in a trusted transaction.
2. Revoke/invalidate refresh sessions for that user when the event is account-wide; otherwise short JWT TTL plus per-request membership check makes row access cease immediately.
3. Revoke pending invitations and outstanding sensitive actions.
4. Existing invoice signed URLs remain valid only until their maximum 60-second expiry.
5. Write append-only audit event.

Account closure revokes access but does not delete invoices or legally required business evidence.
