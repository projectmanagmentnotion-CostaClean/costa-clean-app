# Costa Clean App V3 — Regression Contract

V3 is a visual and information-architecture redesign. The following behavior is protected unless a later sprint explicitly authorizes a contract change.

## Protected domains

- Auth session bootstrap, sign-in, sign-out, refresh and account state.
- Supabase client configuration, RLS boundaries, authenticated RPCs and permission errors.
- Financial writes, payment creation/settlement, invoice numbering and fiscal sequences.
- Invoice, quote, job/service, client, property, expense and recurring-plan relations.
- PDF rendering, filenames, previews, downloads and bulk ZIP/CSV exports.
- Quote lifecycle, job/service lifecycle and invoice lifecycle.
- Alerts, fingerprints, read/acknowledge/dismiss/reopen decisions and deep links.
- Browser notifications permission/subscription state.
- Navigation guards, unsaved-change warnings, back behavior and query/deep-link contracts.
- Audit events, duplicate review and data-integrity checks.

## V3 visual acceptance contract

- Mobile is validated first at 390x844 and 430x932.
- No horizontal overflow; no clipped essential action; no action depends on hover.
- Touch targets are at least 44px, preferably 48px.
- Sticky controls respect safe areas and never cover the keyboard, legal controls or primary CTA.
- Lists preserve operational density and do not use card-inside-card composition.
- Filters use a bottom sheet on mobile.
- Workspaces are full-screen on mobile; no persistent master-detail split.
- Every complex create/edit action uses an understandable full-screen/StepFlow sequence.
- `prefers-reduced-motion` remains supported.

## Source and evidence rules

- Current application code is authoritative for behavior and data contracts.
- Approved Stitch frames are authoritative for visual implementation.
- Missing Stitch evidence is recorded as `WAITING_FOR_STITCH`.
- No production deployment, migration, business-schema change, Edge Function change or production data write is part of V3-0.

## Validation gates

- Existing test suite passes with no unexplained regression.
- `npm run lint` passes.
- `npm run build` passes.
- Later visual implementation must include mobile QA before iPad/desktop.
- Any live write test needs an explicitly authorized QA sandbox and exact cleanup proof; V3-0 itself performs no such write.
