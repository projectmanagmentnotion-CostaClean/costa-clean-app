# Stitch Implementation Blueprint

Date: 2026-08-04

This document translates the approved Coastal Luminous Stitch reference into the
real Costa Clean client portal implementation. Stitch is a closed visual
reference only; it does not override repository architecture, auth contracts or
security boundaries.

## Design system

The portal should feel modern, premium, minimal and calm, with a clear Costa
Clean identity.

### Visual language

- Coastal Luminous is the approved visual reference.
- The portal must stay mobile-first and iPhone-priority.
- The experience should be airy, bright and structured.
- One primary action per screen remains the default.
- Secondary actions stay quiet and compact.
- Surfaces should remain visually flat enough for fast scanning.

### Tokens

Use semantic CSS tokens instead of scattered hex values.

- background: `#f9f9ff`
- surface: `#ffffff`
- surface low: `#f0f3ff`
- primary: `#00658d`
- primary accent: `#00abec`
- text: `#111c2d`
- muted: `#3e4850`
- border: `#bdc8d1`
- error: `#ba1a1a`

Spacing, radius and size guidance:

- base spacing: 8 px
- mobile outer margin: 20 px
- primary control height: at least 48 px
- field height: 52 px
- main card radius: 16 px
- small control radius: 8–12 px
- desktop max width: 1180–1240 px

### Typography

Preferred font:

- Be Vietnam Pro, if it can be loaded through the allowed web mechanism.

Fallback stack:

- `system-ui`
- `-apple-system`
- `BlinkMacSystemFont`
- `"Segoe UI"`
- `sans-serif`

## Breakpoints

- Mobile: 320–767 px, with bottom navigation.
- Tablet: 768–1199 px, with compact sidebar.
- Desktop: 1200 px and up, with full sidebar.
- StepFlows should stay focused and limited to roughly 720–760 px content width.

## Shared components

Implement and reuse these portal components across preview and production:

- `PortalWorkspace`
- `PortalAppShell`
- `PortalSidebar`
- `PortalMobileNav`
- `PortalHeader`
- `PortalAuthHeader`
- `PortalPageHeader`
- `PortalButton`
- `PortalIconButton`
- `PortalField`
- `PortalCheckbox`
- `PortalRadio`
- `PortalTextarea`
- `PortalCard`
- `PortalStatusChip`
- `PortalTabs`
- `PortalStepFlow`
- `PortalEmptyState`
- `PortalErrorState`
- `PortalOfflineState`
- `PortalSkeleton`
- `PortalModal`
- `PortalToast`
- `PortalPropertyCard`
- `PortalRequestCard`

Do not add `PortalDocumentViewer` in this sprint unless it is actually used.

## Screen map

### Auth

- login
- recovery
- reset password
- session expired
- no access
- temporary error

### Workspace

- home
- services
- properties
- documents
- account
- help

### CP-3B.2 focus

The next implementation slice centers on:

- account summary
- profile read model
- property list and property detail
- reviewed-change request StepFlow
- safe loading, empty, error, retry and conflict states

## Backend capabilities already real

The portal may rely on these verified contracts:

- isolated portal auth lifecycle
- self-access resolution
- narrow preview and production adapters
- authenticated session handling
- profile/property reviewed-change source contract as a backend design

## Visual-only or future-only capabilities

These must not be faked as live backend behavior in production:

- synthetic preview data
- profile/property correction submission UI until the matching backend read/write
  surface is explicitly wired
- document download experiences without a verified signing boundary
- any direct canonical-table mutation

## Implementation notes

- Preview and production should share the same shell components.
- Preview may inject synthetic data only in development.
- Production should render safe empty or unavailable states when a capability is
  not yet backed by a contract.
- Keep portal and CRM surfaces isolated.
- Never infer a client from email matching alone.

