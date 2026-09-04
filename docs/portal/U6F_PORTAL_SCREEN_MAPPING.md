# Costa Clean U6F Portal Screen Mapping

Date: 2026-09-04  
Scope: visual integration only; production contracts and route behavior remain unchanged.

## Authority

The visual source is the frozen U5/U6E system from `costa-clean-web@af872b3`:
real brand cyan `#00AEF0`, auxiliary UI tokens `#0088BD`, `#0B1924`,
`#132230`, Epilogue and Manrope. The portal uses a controlled copy in
`src/portal/portalTokens.ts`; it does not import the public web at runtime.

## Route Mapping

| Stitch master | Existing portal route | Existing implementation | U6F treatment |
|---|---|---|---|
| `PORTAL_LOGIN_390` / tablet | `/portal/login` | `PortalAuthScreen` | Frozen auth shell and primary action; auth calls unchanged |
| `PORTAL_RECOVERY_390` | `/portal/recover` | `PortalAuthScreen` | Same shell; recovery contract unchanged |
| `PORTAL_SESSION_EXPIRED_390` / no access | `/portal/login` | `PortalAccessScreen` | Preserve session, pending, suspended, revoked and no-access states |
| `PORTAL_GENERIC_ERROR_390` | `/portal/*` | `PortalAccessScreen` / page error | Preserve safe error boundary and neutral disclosure |
| `PORTAL_HOME_390` / tablet / desktop | `/portal` | `PortalWorkspaceView` + `PortalPages` | Decision-first workspace header and operational cards |
| `PORTAL_NAV_TABLET_768` | `/portal/*` | `PortalWorkspaceView` | Compact tablet rail; mobile bottom navigation remains below 900px |
| `PORTAL_PROPERTY_DETAIL_390` / tablet / desktop | `/portal/properties/[id]` | `PortalPages` | Compact property identity and reviewed correction entry |
| `INVOICES_LIST_390` / detail masters | `/portal/documents` and legacy `/portal/invoices` | Read-only documents view | Preserve canonical route, alias and read-only contract |
| Services masters | `/portal/services`, `/portal/services/[id]` | `PortalServiceArea` | Preserve service reads and request links |
| Request masters | `/portal/service-requests`, `/new/[step]`, `/[ref]` | `PortalServiceArea` | Preserve StepFlow, idempotency and cancellation behavior |
| Account / profile / security / help | `/portal/account`, `/profile`, `/security`, `/help` | `PortalPages` | Visual hierarchy only; adapters and auth unchanged |

## Responsive Acceptance

- `320-767px`: mobile-first content, fixed bottom navigation, safe-area padding,
  no horizontal overflow.
- `768-1199px`: compact sidebar and dense operational content.
- `1200px+`: full sidebar and bounded content column.
- Controls retain a minimum 44px hit area and reduced-motion behavior.

## Non-goals

No route, Supabase, auth, RLS, invoice signing, CRM, public-web, deployment or
production browser certification changes are part of U6F.
