# CP-3B.3 Service Contract Audit

Date: 2026-08-05

Scope: client portal services and own service requests.

This note documents the locally implemented portal contract for the services
slice. It is a repo audit, not a remote production proof.

## Summary

- Service history and service detail are rendered from public service
  references.
- Own service requests have a dedicated list, detail view, StepFlow creation
  flow and optimistic cancel action.
- The frontend reads and writes through the portal-specific adapter layer, not
  through direct table access.
- The contract uses public references and customer-safe DTOs; canonical IDs stay
  hidden from the UI.

## Implemented surfaces

| Surface | Status | Evidence |
|---|---|---|
| `/portal/services` | implemented | `src/portal/PortalServiceArea.tsx`, `src/portal/PortalPages.tsx` |
| `/portal/services/:serviceRef` | implemented | `src/portal/portalNavigation.ts`, `src/portal/PortalServiceArea.tsx` |
| `/portal/service-requests` | implemented | `src/portal/PortalServiceArea.tsx`, `src/portal/PortalWorkspaceView.tsx` |
| `/portal/service-requests/:reference` | implemented | `src/portal/portalNavigation.ts`, `src/portal/PortalServiceArea.tsx` |
| `/portal/service-requests/new/:step` | implemented | `src/portal/PortalServiceArea.tsx` |
| submit request | implemented in repo | `public.portal_submit_service_request_v2(...)` in `supabase/migrations/20260805120000_portal_service_request_contract_v2.sql` |
| cancel request | implemented in repo | `public.portal_cancel_own_service_request_v2(...)` in `supabase/migrations/20260805120000_portal_service_request_contract_v2.sql` |

## DTO rules

- Service summaries expose `reference`, `propertyPublicRef`, `serviceType`,
  `scheduledDate` and customer-safe labels only.
- Service request summaries expose `reference`, `propertyPublicRef`,
  `serviceType`, `preferredDate`, `preferredTimeWindow`, `requestedAt`,
  `resolvedAt`, `status`, `version` and cancelability.
- Service request receipts expose the public reference, labels, timestamps and
  version for safe confirmation UX.
- Session-backed request intent is limited to the local browser draft and is
  not treated as authoritative state.

## Safety boundaries

- No production writes were performed for this audit.
- No anon key, JWT, cookie or private header is printed here.
- No direct canonical-table browser access is used in the portal UI.
- No route exposes internal UUIDs.
- Preview scenarios remain synthetic and are clearly labeled.

## Local validation

- `npm.cmd test` passed.
- `npm.cmd test -- --pool=threads` passed.
- `npm.cmd run qa:agents` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

