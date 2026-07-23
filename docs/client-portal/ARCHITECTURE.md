# Costa Clean Client Portal Architecture

Date: 2026-07-23
Gate: CP-0 / CP-1 design only
Status: ready for a separately authorized CP-2 QA implementation

## Decision

The first portal route is `https://app.costacleanbcn.com/portal`. It is a distinct customer trust surface inside `costa-clean-app`, not a reuse of the internal CRM shell.

```text
costacleanbcn.com (WordPress)
        |
        | HTTPS link only
        v
app.costacleanbcn.com/portal (React/Vite portal UI)
        |
        | Supabase Auth access token; never service_role
        v
portal-specific Edge Functions and narrow SECURITY DEFINER RPCs
        |
        | explicit active client_portal_membership check
        v
canonical CRM tables + private invoice-documents bucket
```

The public website never receives Supabase credentials and never queries CRM tables. Portal users never receive direct, indiscriminate access to canonical CRM tables.

## Verified current systems

| Surface | Verified implementation | Ownership / deployment |
| --- | --- | --- |
| Public website | WordPress, Elementor, Astra, WPForms Lite, Complianz; page source and REST namespaces verified live | SiteGround DNS/hosting (`ns1.siteground.net`, `ns2.siteground.net`, nginx, SiteGround headers), WordPress-managed deployment |
| Public website repository | No repository was found in the connected GitHub owner or local Git workspaces | The connected owner exposes only `projectmanagmentnotion-CostaClean/CostaCleanCRM` and `projectmanagmentnotion-CostaClean/costa-clean-app`; WordPress is therefore the current operational source of truth. Obtain a SiteGround/WordPress export and establish version control before CP-4. |
| CRM web app | React 19 + TypeScript + Vite 8 | `projectmanagmentnotion-CostaClean/costa-clean-app`, `main`, Vercel, `app.costacleanbcn.com` |
| Legacy CRM | Google Apps Script repository, not the public website | `projectmanagmentnotion-CostaClean/CostaCleanCRM`; excluded from portal runtime |
| Data/Auth | Supabase Auth, PostgREST, PostgreSQL, Storage and one public quiz Edge Function | Production ref `wfxnwfcdjainpojhbdri`; QA ref `kpvvydthlxupjjqqdpxy` |

Live website evidence on 2026-07-23:

- `https://costacleanbcn.com/` returned WordPress REST links, nginx, SiteGround host/cache headers and IP `34.175.186.33`.
- Home page `1477` and WPForms form `2092` collect name, phone, address, email and message.
- Contact has a similar WPForms form. Neither rendered form showed a first-layer privacy notice or a dedicated marketing choice.
- Complianz provides category controls. The published cookie policy is dated 2024 and contains unresolved or inconsistent entries.

## Current `costa-clean-app` audit

### Auth and routes

- `App.tsx` bootstraps `getSession()` and `onAuthStateChange`; every non-public path enters the same protected CRM shell when a session exists.
- `AuthPage` supports email/password sign-in only and currently renders raw Supabase error messages. There is no customer signup, invitation, recovery, MFA or portal role gate.
- Logout uses the shared Supabase client, handles `SIGNED_OUT` and clears the stored local session.
- Public standalone paths are `/quote-request`, `/presupuesto`, `/manual-quiz`, `/prueba-operativa-gimnasio` and `/prueba-manual-gimnasio`. `/dev/step-flow-preview` is development-only.
- Protected navigation is query-based across dashboard, alerts, fiscal/quarterly/annual closing, leads, clients, properties, quotes, jobs, invoices, expenses and payments.
- `/portal` is not implemented at CP-1.

### Canonical data

- `clients -> properties -> jobs` is the operational chain; quotes may link lead/client/property and jobs; invoices link client/job/quote/property; payments link invoice.
- The source baseline includes 17 public tables plus RPCs/triggers. `recurring_invoice_plans` is referenced by UI but absent from the authoritative schema and remains unrelated blocked debt.
- Customer-safe data must be projected field-by-field. Canonical tables contain internal notes, pricing metadata, lead links, fiscal snapshots and operational fields that must not cross the portal boundary.

### Current RLS/RPC

- The 2026-07-22 closure removes anonymous reads on ten sensitive tables and grants their reads only to `authenticated`.
- Its `Authenticated read access` predicate checks only non-null `auth.uid()`, so every authenticated identity remains workspace-wide.
- Operational RPCs for client/property/job and financial RPCs are SECURITY DEFINER or otherwise privileged and primarily distinguish only anonymous from authenticated. They are not customer tenancy controls.
- CP-2 must preserve current staff behavior while adding explicit staff membership and denying every portal user direct execution of these functions.

### Public intake

- The Vite app's `/quote-request` flow posts to Vercel `api/public-quote-request.js`; the server holds `SUPABASE_SERVICE_ROLE_KEY`, performs request protection and creates/updates intake, lead and draft rows.
- That existing lead flow may match a lead by phone/email. It does not create a canonical client, and it must not be reused as portal membership proof.
- The app form requires `consentQuoteProcessing`, but its wording is an “authorization” and no linked layered privacy information was identified. CP-4 must classify it as privacy information plus contract/pre-contract processing, not blanket consent.

### PDFs, Storage and Edge

- Invoice and quote documents are React A4 views. “Guardar PDF” opens the browser print dialog; there is no stored canonical invoice PDF.
- Source defines a private `expense-receipts` bucket with broad internal authenticated object policies. It is not suitable for customers.
- One Supabase Edge Function exists: `submit-public-gym-manual-quiz`, with public ingress and a service-role-only private RPC. No portal Edge Function exists.

### Source-of-truth limitation

The QA baseline plus later migrations and production gate reports support this audit. CP-0 performed no remote database/Auth catalog read, so remote configuration details not evidenced by those artifacts (email confirmation, SMTP, Auth rate limits, MFA availability and exact Storage state) remain `unverified` and must be captured in CP-2 read-only preflight.

## Mandatory trust split before any portal user exists

The current effective CRM read model is `authenticated = trusted internal operator`. The final read-closure migration creates `Authenticated read access` policies whose predicate is only `auth.uid() is not null`. That model is safe only while every Auth user is internal.

CP-2 must introduce an explicit `internal_staff_memberships` authorization predicate and replace all canonical-table policies that trust any authenticated user. This change must be atomic with the first portal account. If that split is not proven, creating a portal Auth user is a P0 data exposure and the gate stops.

Target principals:

- `anon`: public routes only; no portal or CRM data.
- `authenticated + active internal_staff_membership`: current CRM capabilities, separately allowlisted.
- `authenticated + active client_portal_membership`: portal RPCs/Edge only for the selected client.
- `service_role`: trusted Edge/server operations only; never browser code.

## Components

### Public website

- Adds only an `Área de clientes` link to `/portal` in CP-4.
- Keeps marketing/contact forms isolated from portal registration.
- Receives updated legal pages and consent configuration only after content and tracker inventory review.
- Must not embed portal credentials, Supabase queries, invoice links or account identifiers.

### Portal UI

- Uses a dedicated route guard and layout.
- Implements invitation acceptance, pending registration, login, recovery, logout, optional MFA enrolment, dashboard, profile, properties, services, requests and invoices.
- Sends an explicit `client_id` context to every client-scoped RPC; the server derives permitted client IDs from memberships and rejects mismatches.
- Treats all identifiers as untrusted. UI hiding is not authorization.

### Portal boundary

Use a `portal_private` database schema for helper functions and non-API internals, plus allowlisted Edge Functions/RPCs in the exposed API schema. Recommended endpoints:

- `portal_get_account_context`
- `portal_get_dashboard`
- `portal_list_properties`
- `portal_list_services`
- `portal_list_invoices`
- `portal_get_invoice_detail`
- `portal_submit_service_request`
- `portal_cancel_service_request`
- `portal_submit_profile_change`
- Edge: `portal-register`, `portal-accept-invitation`, `portal-recover-account`, `portal-invite-member`, `portal-revoke-member`, `portal-download-invoice`

Every function is deny-by-default, has a fixed `search_path`, validates `auth.uid()`, checks email verification where required, resolves one active membership, returns an allowlisted shape and logs a privacy-minimised event.

### Canonical CRM

Canonical tables remain the source for clients, properties, jobs, quotes, invoices and payments. Portal tables never duplicate invoice truth or create operational jobs. Customer changes that affect fiscal identity, properties or service scheduling are review requests.

## Deployment boundary

- CP-0/CP-1: documentation only.
- CP-2: local/disposable proof, then exact QA-only migration/Edge/storage authorization.
- CP-3: portal UI in QA after the data boundary passes.
- CP-4: WordPress integration and legal publication through a separately controlled SiteGround/WordPress workflow.
- CP-5: explicit production authorization and invite-only pilot.

No step uses `db push` while the repository lock remains active.

## Security invariants

1. Email equality never creates a membership or client.
2. Memberships are created only from an exact staff-selected client invitation or explicit staff approval.
3. Pending, suspended, expired and revoked subjects see zero business data.
4. Canonical CRM tables are not generally granted to portal users.
5. Invoice objects are private and their keys are opaque.
6. Signed document access is short-lived and issued only after a fresh ownership check.
7. Service requests never create, schedule, invoice or charge a job.
8. Portal terms, privacy information, marketing consent and cookie consent are four separate records and user decisions.

## Open operational inputs

These do not block the design but block later release:

- authoritative controller identity, NIF, postal address and rights contact;
- confirmed SiteGround/WordPress owner, backup/export and deployment procedure;
- executed processor terms/DPAs, regions and subprocessors for Supabase, Vercel, SiteGround and any email/AI provider;
- invoice-PDF rendering strategy and private bucket lifecycle;
- final professional legal review.
