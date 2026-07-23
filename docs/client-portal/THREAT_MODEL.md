# Client Portal Threat Model

Date: 2026-07-23
Method: STRIDE plus privacy/abuse cases
Security objective: prevent cross-client, internal-data and invoice-document exposure while preserving canonical CRM integrity.

## Assets

- Auth identities, sessions, recovery and MFA factors.
- Memberships and invitation tokens.
- Client identity, contact, property and fiscal data.
- Jobs/services, quotes, invoice snapshots and payment state.
- Private invoice documents and signed access.
- Service requests and staff review decisions.
- Audit/security evidence and legal acceptance records.

## Threat matrix

| ID | STRIDE | Scenario | Impact | Required mitigation | Gate |
| --- | --- | --- | --- | --- | --- |
| T01 | Spoofing | Attacker registers with an email matching a CRM client | Full client takeover | never auto-link; invitation or manual approval; verified email is necessary but insufficient | CP-2 |
| T02 | Spoofing | Invite token stolen from logs/referrer/email preview | Membership takeover | 256-bit token, peppered hash, single use, short expiry, `Referrer-Policy: no-referrer`, no analytics on acceptance route | CP-2/3 |
| T03 | Tampering | Member changes `client_id` or property ID | Cross-client write/read | derive authorization server-side; exact membership/property join; negative tests | CP-2 |
| T04 | Repudiation | Admin denies inviting/revoking a user | Dispute and weak response | append-only portal audit with actor, target, request ID and result | CP-2 |
| T05 | Information disclosure | Any authenticated portal user inherits current workspace-wide policies | P0 disclosure of all CRM data | replace `auth.uid() is not null` canonical policies with explicit internal staff boundary before first portal user | CP-2 stop condition |
| T06 | Information disclosure | Sequential invoice or document IDs enumerated | Other-client fiscal disclosure | opaque endpoint IDs, ownership checks, uniform `not_found`, no list totals outside tenancy | CP-2 |
| T07 | Information disclosure | Public/permanent PDF URL shared or indexed | Persistent fiscal exposure | private bucket, opaque key, 60-second signature, no-store, no public bucket | CP-2 |
| T08 | Information disclosure | Signed URL appears in logs/referrer | Time-limited leak | do not log query/token; no third-party resources on download route; short expiry; optional streamed proxy | CP-2/3 |
| T09 | Denial of service | Signup/recovery/invite/request floods | Email cost and availability | per-IP + per-account pseudonymous rate limits, CAPTCHA escalation, payload limits, provider quotas | CP-2 |
| T10 | Elevation | `client_member` invokes admin function | Unauthorized invitations/revocation | endpoint-level role check, AAL2-ready admin action, no direct DML | CP-2 |
| T11 | Elevation | Portal calls legacy financial/internal SECURITY DEFINER RPC | Financial or CRM mutation | revoke portal reachability; internal staff checks inside legacy RPCs; explicit EXECUTE allowlist | CP-2 |
| T12 | Tampering | Request directly becomes a job | Unreviewed scheduling/financial consequence | separate request table and state machine; internal-only approval/job link | CP-2 |
| T13 | Spoofing | Recovery response reveals whether account exists | Account enumeration | identical status/body/timing envelope; rate limit; notification on material account change | CP-2/3 |
| T14 | Tampering | Revoked session continues via cached JWT/signed URL | Residual access | short JWT/document TTL, membership checked on every call, revoke sessions on critical events, deny refresh | CP-2 |
| T15 | Information disclosure | UI/analytics/error monitoring captures PII | Secondary exposure | structured redaction, no body logging, environment-safe telemetry, retention | CP-2/3 |
| T16 | Repudiation | Legal acceptance cannot be proven | Contract dispute | store document key/version/hash, timestamp, user, locale and acceptance event separately from privacy info | CP-3/4 |
| T17 | Privacy | Marketing or cookies bundled with portal terms | Invalid consent | four independent purposes/records; optional unchecked marketing; granular cookie choices | CP-3/4 |
| T18 | Supply chain | WordPress plugin or stale legal page compromised | Website/identity phishing | plugin inventory/updates, SiteGround backup, admin MFA, versioned export, CSP/headers where compatible | CP-4 |
| T19 | Elevation | Browser bundle contains service role or server secret | Total backend compromise | automated bundle/secret scan; only anon publishable key in client | every gate |
| T20 | Information disclosure | Client changes fiscal identity after invoice issue | Corrupted invoice evidence | issued invoice snapshot immutable; profile fiscal change becomes reviewed request | CP-2/3 |

## Abuse cases

### Cross-client matrix attacker

An authenticated Client A submits Client B IDs to every list, detail, mutation and download endpoint. Expected outcome is the same `404/not_found` envelope as an unknown ID, zero timing-distinguishable data, zero audit PII and no changed rows.

### Compromised client admin

An admin can only invite approved colleagues to the same client, within configured limits. It cannot link another CRM client, promote internal staff, access audit payloads, issue invoices or approve jobs. Staff can revoke all memberships and sessions.

### Compromised internal operator

Portal design does not solve all insider risk. Membership invitations, link changes and invoice-document registration require audit, least privilege and optional four-eyes review for client reassignment. Never permit silent membership `client_id` updates; revoke and reissue instead.

## Security headers

Portal responses target:

- HSTS on the production domain;
- CSP with explicit `connect-src` for the exact Supabase project and no unsafe third-party scripts on Auth/invoice routes;
- `Referrer-Policy: no-referrer`;
- `X-Content-Type-Options: nosniff`;
- `frame-ancestors 'none'`;
- `Permissions-Policy` minimised;
- `Cache-Control: no-store, private` for account and document responses.

## Residual risks requiring acceptance

- Email delivery remains a dependency and is not identity proof by itself.
- Signed URLs are bearer capabilities until expiry; a streamed Edge proxy is stronger but costs more and must be load-tested.
- Same-project Auth requires a coordinated internal/portal authorization migration. Partial rollout is prohibited.
- WordPress currently has no identified Git repository and exposes a broad plugin inventory through public REST metadata.
- Legal specifications require professional review and operational facts before publication.
