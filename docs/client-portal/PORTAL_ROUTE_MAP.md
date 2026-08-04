# Portal Route Map

Date: 2026-08-04

This route map documents the portal surface that must stay isolated from CRM
routes.

## Canonical routes

| Route | Purpose | Notes |
|---|---|---|
| `/portal` | Portal home | Entry point for the authenticated workspace. |
| `/portal/account` | Account hub | Compact account-level navigation and support entry. |
| `/portal/profile` | Profile overview | Read-only account context and reviewed-change entry. |
| `/portal/profile/requests` | Profile request list | History and status of profile corrections. |
| `/portal/profile/requests/:reference` | Profile request detail | Public reference, not internal UUID. |
| `/portal/profile/correction/fields` | Profile correction fields | StepFlow stage 1. |
| `/portal/profile/correction/values` | Profile correction values | StepFlow stage 2. |
| `/portal/profile/correction/review` | Profile correction review | StepFlow stage 3. |
| `/portal/profile/correction/success` | Profile correction success | Receipt and stable confirmation. |
| `/portal/properties` | Property list | Opaque, client-scoped property cards. |
| `/portal/properties/:propertyRef` | Property detail | Safe detail view keyed by public property reference. |
| `/portal/properties/:propertyRef/requests` | Property request list | Requests linked to the selected property. |
| `/portal/properties/:propertyRef/requests/:reference` | Property request detail | Public reference only. |
| `/portal/properties/:propertyRef/correction/fields` | Property correction fields | StepFlow stage 1. |
| `/portal/properties/:propertyRef/correction/values` | Property correction values | StepFlow stage 2. |
| `/portal/properties/:propertyRef/correction/review` | Property correction review | StepFlow stage 3. |
| `/portal/properties/:propertyRef/correction/success` | Property correction success | Receipt and stable confirmation via public reference. |
| `/portal/services` | Services overview | Foundation only in this sprint. |
| `/portal/documents` | Documents overview | Foundation only in this sprint. |
| `/portal/security` | Security overview | Auth, recovery and MFA-ready guidance. |
| `/portal/preferences` | Preferences | Future support/settings surface. |
| `/portal/help` | Help | Support entry point. |

## Legacy compatibility

These routes should continue to resolve safely:

- `/portal/invoices` → canonical invoice/document area or a safe redirect
- `/portal/requests` → request history or safe redirect

## Route principles

- No UUIDs in visible URLs.
- No route should fall through to CRM navigation.
- Unknown portal routes should resolve to a safe not-found state.
- Preview and production must use the same route map.
