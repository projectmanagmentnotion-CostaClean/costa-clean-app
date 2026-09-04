# U6F Portal Security Preservation

Date: 2026-09-04

U6F changes only portal presentation CSS, a local token reference, and mapping
documentation. The following boundaries remain intact:

- Portal bootstrap stays isolated behind `src/main.tsx` and `bootstrapPortal.tsx`.
- Production still uses `createPortalFoundationAdapter`; preview data remains development-only.
- Auth lifecycle, session recovery, membership resolution and sign-out remain in the existing state machine and adapters.
- Portal reads remain scoped through `loadPortalFoundationData`; no CRM contracts changed.
- Reviewed profile/property changes and service requests retain validation, idempotency and error handling.
- Invoices/documents remain read-only. No payment UI or direct canonical-table mutation was introduced.
- No secrets, service-role credentials, auth profiles or private QA reports are included.

## Verification

The pre-change baseline passed lint, the full Vitest suite, production build and
the disposable local CP-2A portal proof. The same checks must be repeated after
the visual changes, together with portal boundary and artifact checks.

The U6F-C synthetic visual run confirmed zero page/console errors, no runtime
Google Fonts requests, no browser credentials and no remote auth use.
