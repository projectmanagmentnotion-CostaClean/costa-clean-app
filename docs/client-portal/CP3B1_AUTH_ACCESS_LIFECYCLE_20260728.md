# CP-3B.1 Authentication and Access Lifecycle

Date: 2026-07-28

Initial HEAD: `f1a4f69dfbc6ebb5340b52e467e4a179ee233544`

Gate status: `DONE — local implementation and visible synthetic-runtime evidence`

## Scope and result

CP-3B.1 connects the isolated `/portal` frontend to Supabase Auth and to the
single zero-parameter boundary `portal_resolve_self_access_context()`. The
implementation covers login, session bootstrap, logout, neutral password
recovery, password replacement, session expiry, refresh/user-change events,
strict access-context validation and safe retry.

The gate did not create QA users or fixtures and did not change SQL, RLS, RPC,
Edge Functions, Storage, production, WordPress or SiteGround. A live journey
with a real QA Auth identity therefore remains intentionally outside this gate
and belongs to the separately authorized CP-3C.1/CP-3C.2 fixture and E2E gates.

Complete invitations, email delivery and membership administration remain
outside scope. No invitation token is persisted.

## Runtime architecture

```text
/portal route
  -> isolated portal bootstrap
  -> portal-only Supabase Auth client
  -> getSession / onAuthStateChange
  -> portal_resolve_self_access_context()
  -> strict DTO parser
  -> fail-closed access state machine
  -> auth screen, access outcome or minimal protected shell
```

- The portal Auth client has a host-scoped storage key distinct from the CRM
  client and uses PKCE, persisted sessions, token refresh and URL-session
  detection.
- Production code calls Auth methods and exactly one parameterless RPC. It
  contains no `.from(...)`, REST-table call, Edge invocation, `service_role`,
  email/metadata tenancy or browser-supplied `client_id`.
- The development preview is loaded only through `import.meta.env.DEV` dynamic
  imports. Product build inspection found no preview scenario, synthetic
  invoice or reduced-motion query markers.
- Protected business pages remain absent from the production portal shell in
  this gate. An authenticated session is not treated as portal authorization.

## Auth lifecycle

The lifecycle subscribes synchronously, then resolves the initial session. It
handles `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`, `USER_UPDATED`,
`MFA_CHALLENGE_VERIFIED`, `PASSWORD_RECOVERY` and `SIGNED_OUT`.

Every async context resolution carries an epoch and expected Auth user. A late
response is discarded if the session changed. Sign-out and user replacement
clear protected state immediately before another context may render. Unknown
events and malformed provider results fail closed.

MFA is architecturally prepared through the Auth lifecycle event but is not
enabled or claimed as delivered.

## Access and tenancy rules

The RPC result is accepted only when its top-level and membership keys match
the contract exactly. Unknown keys, states, roles, statuses, malformed UUIDs,
unsorted or duplicate memberships, control characters and inconsistent
application status are rejected.

| RPC outcome | Client behavior |
|---|---|
| `active_member` | Requires one active membership whose `clientId` exactly equals `selectedClientId`; accepts only `client_admin` or `client_member`. |
| `client_selection_required` | Requires at least two active memberships and no selected client; the user chooses in memory from opaque “Cuenta 1/2” labels and roles. |
| `pending_review` | Shows a neutral review state with no tenant identifier. |
| `suspended` | Denies protected content and exposes no tenant identifier. |
| `revoked` | Denies protected content and exposes no tenant identifier. |
| `authenticated_without_access` | Denies protected content without revealing client existence. |
| Network/session failure | Shows a safe retry or expired-session path without technical provider details. |

Client selection does not query client names, does not persist a client
identifier and does not unlock business reads in CP-3B.1.

## Recovery and anti-enumeration

- Login exposes one generic invalid-credentials response.
- Recovery returns the same neutral success message whether an account exists
  or not.
- `redirectTo` is reconstructed from the current allowed origin and the exact
  `/portal/reset-password` path. HTTPS is required except for loopback local
  development; query and hash input are not copied.
- Password replacement requires matching values of at least 12 characters.
  After update, the session is signed out and the user must log in again.
- Forms use stable identifiers and correct autocomplete tokens, block duplicate
  submission, expose live status and focus the first invalid field.
- Emails, UUIDs, sessions, JWTs, tokens, RPC payloads and provider errors are
  absent from application logs and committed fixtures.

## iPhone-first and visible QA

Visible local browser QA used the real running Vite application and synthetic
development scenarios. Exact CSS viewport measurements passed at:

- portrait: `320x568`, `375x812`, `390x844`, `430x932`, `768x1024`,
  `1366x900`;
- orientation checks: `844x390` and `1024x768`.

At every measured size `scrollWidth <= innerWidth`, inputs rendered at 16 px,
touch actions were at least 44 px, the submit remained reachable and the
bottom navigation did not cover the final content. The implementation uses
`100dvh` with a `100vh` fallback and all four safe-area insets.

Visible scenario review covered login, recovery, reset, active admin, active
member, multi-client, pending, suspended, revoked, without-access,
session-expired and offline outcomes. It also covered:

- first-error focus and `aria-invalid`;
- password reveal state and retained input;
- neutral recovery live status;
- browser back navigation with portal-only query preservation;
- a reduced viewport (`390x500`) while an input remained focused;
- mobile bottom-navigation clearance, iPad shell containment and desktop
  sidebar behavior;
- reduced motion and normal motion after settlement;
- absence of residual `ScrollTrigger` globals and browser console errors.

After the independent audit fixes, visible `390x844` regression also confirmed
route and lifecycle-state heading focus, polite/assertive live-region roles,
native `<ul>/<li>/<button>` multi-client semantics, a reachable mobile logout,
first-paint opacity `1`, reduced-motion transform `none` and no console errors.

Physical Safari iOS, a physical software keyboard, third-party password-manager
UI and real provider autofill were `NOT_EXECUTED` in the available Windows
environment. Their semantic hooks and responsive conditions were inspected,
but this document does not claim physical-device certification.

## Motion and accessibility

Auth surfaces use the existing GSAP infrastructure with a transform-only
entrance, leaving all content visible from first paint. The form is usable
before animation settles; submit, focus and errors are never timeline-gated.
Scoped GSAP contexts are reverted on unmount.
Auth routes create no `ScrollTrigger`, pin, scrub, scroll hijack or continuous
motion. `prefers-reduced-motion` removes displacement and duration, and the
development reduced-motion simulation rendered content immediately.

Landmarks, labels, descriptions, status/alert live regions, focus movement,
password-toggle state and keyboard-operable actions are present. This is a
code and visible-browser accessibility result, not a physical screen-reader
certification.

## Validation evidence

- `npm test`: `69` files passed; `404` tests passed; `4` skipped.
- `npm run qa:agents`: `160/160` passed.
- `npm run lint`: pass.
- `npm run build`: pass.
- Production portal bundle: `27.12 kB` before gzip; preview markers absent.
- `git diff --check`: pass.
- QA remote writes: `0`.
- Production writes: `0`.
- Auth users created: `0`.
- Backend, SQL, RLS, RPC, Edge and Storage changes: `0`.
- WordPress/SiteGround changes: `0`.
- Real PII, versioned secrets and tracked private files: `0`.

## Rollback and next gate

Rollback is a revert of the single CP-3B.1 frontend/documentation commit. There
is no QA identity, fixture or backend residue to clean.

CP-3B.2 is not started. Before it opens, its narrow profile/property DTOs,
reviewed-change contract and cross-client synthetic fixture plan must satisfy
its Definition of Ready. Real Auth and authorization journeys require the
separate CP-3C.1/CP-3C.2 authorization and cleanup controls.
