# CP-3A Portal UI Foundation Closeout

Date: 2026-07-28

Verdict: `PASS — CP-3A DONE`

Next gate: `CP-3B.1 — Authentication and access lifecycle`

## Git and scope evidence

- Initial branch: `main`.
- Initial local and remote HEAD:
  `97a88cce8d3382b0f801577d0d443eda324d4945`.
- Initial divergence: `0/0`.
- Initial worktree: clean.
- Implementation scope: application entry split, isolated CRM bootstrap and new
  `src/portal/` UI foundation.
- Remote application writes: `0`.
- QA and production changes: `0`.
- Supabase schema, migrations, RLS, RPC, Edge Functions, Storage and Auth users:
  unchanged.
- WordPress and SiteGround: untouched.

## Implemented boundary

The application entry resolves the current pathname before importing either
surface:

```text
/portal and /portal/* -> portal bootstrap -> portal state/UI/adapters
all other paths       -> CRM bootstrap    -> existing CRM App/Auth/routes
```

The split is enforced with dynamic imports. The production build emits separate
portal and CRM bootstrap/CSS chunks. Loading `/portal` does not import the CRM
`App`, global CRM stylesheet, feature navigation or Supabase client.

The production portal foundation has a closed adapter:

- access resolves only to `unauthenticated`;
- every read method rejects as not connected;
- no write method exists;
- no email-to-client inference exists;
- no query, RPC or direct canonical-table access exists.

The authenticated preview adapter and its state selector are loaded only when
`import.meta.env.DEV` is true. Preview records use synthetic identifiers and
labels, contain no real PII and cannot write remotely. The production build does
not include the preview adapter or control.

## Access state machine

CP-3A implements explicit states for:

- `booting`;
- `unauthenticated`;
- `pending_review`;
- `authenticated` with explicit `clientContextId` and membership role;
- `suspended`;
- `revoked`;
- `forbidden`;
- generic bootstrap error.

The authenticated shell validates that the account DTO returns the exact client
context and role from the access decision. A mismatch fails closed with generic
copy.

Real login, recovery, invitations, session lifecycle and remote Auth integration
remain intentionally unimplemented until CP-3B.1.

## Routes and base pages

- `/portal`
- `/portal/profile`
- `/portal/properties`
- `/portal/services`
- `/portal/requests`
- `/portal/invoices`
- `/portal/security`

Unknown `/portal/*` paths remain inside the portal boundary and return generic
not-found copy. They never fall through to CRM navigation.

The pages are read-only foundations. They include no save affordance, document
download, financial mutation or business workflow.

## Responsive and accessibility evidence

Visible local browser QA used only the synthetic development preview:

| Viewport | Result |
|---|---|
| `390x844` | PASS; no horizontal overflow, desktop sidebar hidden, fixed compact mobile navigation visible |
| iPad breakpoint | PASS at `767x1024` and `769x1024`; the Windows browser scale skipped the exact 768 CSS pixel, and both adjacent widths had identical no-overflow tablet composition |
| `1366x900` | PASS; no horizontal overflow, desktop sidebar visible, mobile navigation hidden |

Additional executed checks:

- authenticated home, services and invoices rendered from synthetic DTOs;
- pending-review, revoked, forbidden and generic-error states rendered without
  CRM navigation or technical details;
- mobile `Más` exposed profile, properties, requests and security;
- unknown `/portal/admin` remained in the portal and exposed no client/CRM
  links;
- browser console errors/warnings: `0`.

Accessibility foundations include semantic banner/main/nav landmarks, one H1 per
page, labelled state selector, skip link, `aria-current`, live loading/error
regions, visible focus, minimum 44 px primary targets and reduced-motion
handling.

Exact automated screen-reader and full keyboard-journey certification remains
part of CP-3C.3.

## Validation evidence

- CP-3A focused tests: `18/18 PASS` across 6 files.
- Full test suite: `342 passed / 4 skipped` across 62 files.
- Agent package validation: `160/160 PASS`.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- Production portal JS chunk: `17.08 kB` (`4.76 kB` gzip).
- Portal CSS chunk: `11.50 kB` (`3.02 kB` gzip).
- CRM CSS remains isolated in its own `388.81 kB` chunk.
- Portal implementation forbidden import/direct-data scan: `0`.
- Changed-source secret/connection-string/project-ref/PII scan: `0`.
- Private files tracked: `0`.

## Residual risks and non-goals

- The production adapter is intentionally disconnected; CP-3A is not a usable
  client login.
- Real endpoint DTOs and Auth/session behavior require a separate CP-3B.1 gate.
- No claim is made that CP-3A completes end-to-end authorization, legal
  acceptance, document delivery or accessibility certification.
- The iPad evidence is honestly bracketed at adjacent CSS widths because the
  visible-browser scale could not represent exactly 768 CSS pixels.

## Rollback

Revert the single CP-3A commit. No remote application, Auth, database, Storage,
Edge, QA, production or public-website state exists to clean up.

Stop here. CP-3B.1 has not started.
