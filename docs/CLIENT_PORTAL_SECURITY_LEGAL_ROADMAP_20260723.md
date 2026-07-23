# Costa Clean — Client Portal, Security and Legal Roadmap

Date: 2026-07-23  
Status: `OPEN — NEW SCOPED ROADMAP`  
Starting production app: `https://app.costacleanbcn.com`  
Production Supabase ref: `wfxnwfcdjainpojhbdri`  
QA Supabase ref: `kpvvydthlxupjjqqdpxy`

## 1. Product objective

Create a secure client portal where a Costa Clean customer can:

- register or accept an invitation;
- complete and maintain the minimum billing profile;
- view their own properties;
- view scheduled and completed services;
- request a new service without directly creating an operational job;
- view their own invoices;
- download invoice PDFs through short-lived signed access;
- manage account security and sign out;
- exercise privacy rights and access the applicable legal documents.

The public website should link to the portal, but the website must never connect directly to unrestricted CRM tables.

## 2. Senior architecture decision

Use the same Supabase platform and canonical Costa Clean data, but introduce a dedicated client-facing authorization boundary.

Recommended flow:

`public website -> client portal UI -> Supabase Auth -> RLS-protected portal views/RPC/Edge Functions -> canonical CRM tables`

Do not expose the internal CRM data model directly to customer sessions.

The preferred initial route is:

- `https://app.costacleanbcn.com/portal`

The public website should add a clear `Área de clientes` entry point and updated legal pages. A later dedicated subdomain such as `clientes.costacleanbcn.com` may be introduced only if operationally justified.

## 3. Identity and account linking

### 3.1 Registration model

Do not automatically link a new account to a CRM client merely because the email matches.

Approved models:

1. **Invitation-first** — preferred for existing clients.
   - Internal staff selects an existing CRM client.
   - The system creates a one-time invitation token.
   - Only a hash of the token is stored.
   - The invitation expires and is single-use.
   - The invited user verifies email and creates the account.
   - The membership is linked to the exact `client_id` selected by staff.

2. **Open registration with manual approval** — allowed for new prospects.
   - Email verification required.
   - Account starts as `pending_review`.
   - No CRM data is visible before staff approval and exact client linkage.
   - Registration may create a lead or portal application, never a production client automatically.

### 3.2 Roles

Initial customer roles:

- `client_admin` — manages the customer organisation profile and invites approved colleagues.
- `client_member` — read-only access plus service requests.

Internal staff roles remain separate from customer roles.

### 3.3 Membership table

Recommended new table:

`client_portal_memberships`

Minimum fields:

- `id`
- `user_id`
- `client_id`
- `role`
- `status`
- `invited_by`
- `invitation_accepted_at`
- `created_at`
- `revoked_at`

Every customer-facing query must resolve access through an active membership.

## 4. Data minimisation and billing profile

Collect only what is needed for the contract, service operation and invoicing.

Recommended profile fields:

- legal or personal name;
- NIF/NIE/CIF when required for invoicing;
- billing address;
- postal code;
- city;
- country;
- billing email;
- contact phone;
- customer type: individual/company;
- company legal name and representative when applicable;
- optional invoice notes.

Do not request bank details, identity-document images or unrelated personal data unless a separately justified process requires them.

Changes to fiscal identity fields should create a reviewable request or audit trail. Previously issued invoices must retain their immutable fiscal snapshot.

## 5. Portal modules

### 5.1 Dashboard

- next confirmed services;
- pending service requests;
- recent invoices;
- outstanding amounts displayed read-only;
- profile completion warning;
- support contact.

### 5.2 Profile and billing data

- view current data;
- edit permitted fields;
- sensitive fiscal changes marked for review;
- clear validation and change history.

### 5.3 Properties

- list only properties belonging to the linked client;
- show operationally appropriate information;
- allow a property-change request, not unrestricted direct mutation of internal operational fields.

### 5.4 Services

- upcoming and completed services belonging to the client;
- date, address, service type, status and agreed summary;
- do not expose staff-only notes, margins, payroll, internal incidents or other clients.

### 5.5 Service requests

Create a separate workflow:

`requested -> under_review -> quoted/confirmed -> rejected/cancelled`

A customer request must not directly create or schedule a production job.

Recommended table:

`client_service_requests`

Minimum fields:

- `id`
- `client_id`
- `property_id`
- `requested_by`
- `service_type`
- `preferred_date`
- `preferred_time_window`
- `notes`
- `status`
- `reviewed_by`
- `approved_job_id`
- timestamps.

### 5.6 Invoices

- list only invoices belonging to the linked client;
- show number, issue date, status, total and payment state;
- preserve immutable invoice snapshots;
- PDF download through a private bucket or server-generated document;
- issue a short-lived signed URL only after rechecking membership and invoice ownership;
- never expose storage paths or public buckets;
- never expose another customer's sequential identifiers through enumeration.

## 6. Security model

### 6.1 Mandatory controls

- Supabase email verification.
- Strong password policy or passwordless email flow after threat-model review.
- Optional MFA for `client_admin`; capability designed from the start.
- RLS on every portal-accessible table/view.
- No customer access to canonical tables unless an exact policy is proven.
- Prefer narrow portal views, RPCs or Edge Functions.
- `service_role` only in trusted server/Edge code, never frontend.
- Invite tokens hashed, expiring and single-use.
- Rate limiting and anti-automation on signup, login recovery, invitations and service requests.
- Generic authentication and recovery errors to reduce account enumeration.
- Session revocation and secure logout.
- Audit events for login security, membership changes, invoice downloads and service requests.
- Privacy-safe logs: no raw tokens, passwords, invoice bodies, full addresses or personal payloads.
- Signed document URLs with short expiry and one-client ownership verification.
- CSP, HSTS, secure headers, no mixed content and no secrets in Vite bundles.
- Automated tests proving cross-client access denial.

### 6.2 RLS invariants

A customer session may access a row only when:

- `auth.uid()` has one active `client_portal_memberships` row;
- the membership `client_id` matches the row's `client_id`;
- the operation is explicitly permitted for the role;
- revoked and pending memberships receive zero data.

Required negative tests:

- Client A cannot read Client B.
- Client A cannot download Client B invoice.
- Client member cannot invite or change organisation ownership.
- Unverified/pending/revoked user receives no business data.
- Anonymous user receives no portal data.
- Guessing IDs does not reveal existence through differing errors.

### 6.3 Separate internal and customer surfaces

Internal CRM routes and customer portal routes must have distinct authorization gates.

Do not reuse the current `authenticated single-workspace` assumption for customer accounts. The client portal introduces differently trusted users and therefore requires a new ownership/tenancy model before production release.

## 7. Legal and privacy workstream

The public website and portal must include reviewed versions of:

- Legal notice.
- Privacy policy.
- Cookie policy and consent configuration.
- Client portal terms of use.
- Service-request and electronic-contracting conditions.
- Data-processing information at registration, billing-profile changes and service requests.
- Rights-request contact and procedure.
- Processor/subprocessor disclosure where required.
- Security-incident and breach-response procedure.
- Record of processing activities and retention matrix.

### 7.1 Privacy notice structure

Use layered information:

**First layer at the form**

- controller identity;
- purpose;
- legal basis;
- recipients summary;
- rights;
- link to full information.

**Second layer**

- controller and contact details;
- purposes by operation;
- legal bases;
- categories of data;
- recipients/processors;
- international transfers and safeguards;
- retention criteria;
- rights and complaint route;
- mandatory/optional fields;
- automated decisions, if none state none;
- security and account responsibilities;
- version and effective date.

The privacy notice is information, not a blanket consent. Marketing consent, when used, must be separate, optional and unbundled.

### 7.2 Recommended legal bases by purpose

Subject to final legal review:

- account creation and portal access: contract/pre-contractual measures;
- service management: contract/pre-contractual measures;
- invoicing and tax records: legal obligation and contract;
- security and fraud-prevention logs: legitimate interest supported by a balancing assessment;
- commercial communications: consent or another specifically validated basis;
- cookies/analytics not strictly necessary: consent.

### 7.3 Retention

Define a table-based retention policy. Accounting and business documentation must respect applicable statutory retention requirements. Portal security logs, invitation tokens, pending registrations and service-request drafts should use shorter justified periods.

Do not delete invoice evidence merely because a portal account is closed. Disable portal access and retain legally required accounting documentation under restricted access.

## 8. Delivery gates

### Gate CP-0 — Discovery and cross-repo mapping

- identify the exact public website repository, hosting and deployment workflow;
- map CRM tables, invoice/PDF generation and current Auth;
- classify all data shown to clients;
- produce data-flow and trust-boundary diagrams;
- no schema or production changes.

### Gate CP-1 — Threat model, legal inventory and authorization package

- STRIDE-style threat model;
- GDPR/LSSI/cookie checklist;
- processing purposes, bases and retention matrix;
- target data model and RLS specification;
- exact QA migration authorization package;
- no remote writes.

### Gate CP-2 — QA schema, RLS and server APIs

- add memberships, invitations, service requests and audit model in QA;
- private document delivery;
- complete allow/deny matrix;
- no production changes;
- disposable/local migration proof first.

### Gate CP-3 — Portal UI in QA

- registration/invitation;
- login, recovery, logout and account security;
- dashboard, profile, properties, services, requests and invoices;
- accessibility and responsive tests;
- no production release.

### Gate CP-4 — Public website integration and legal pages

- `Área de clientes` navigation;
- registration/login entry;
- legal notice, privacy, cookies and portal terms;
- consent manager audit;
- legal text marked `pending professional legal approval` until reviewed.

### Gate CP-5 — Production security release

- separate explicit production authorization;
- migration/Edge/storage/frontend release;
- invite-only pilot with one synthetic or designated test client;
- exact cleanup;
- rollback prepared.

### Gate CP-6 — Final portal smoke and operational handoff

- cross-client isolation proof;
- document download proof;
- service-request workflow proof;
- legal links and consent proof;
- P0/P1 = 0;
- runbook, support and incident procedures;
- roadmap closeout.

## 9. Non-goals for the first release

- online card payments;
- automatic client-to-job scheduling;
- automatic invoice issuance;
- customer editing of issued invoices;
- public invoice URLs;
- social login providers;
- multiple Costa Clean companies/workspaces;
- customer access to payroll, expenses, margins, staff notes or fiscal closing;
- AI decisions affecting access, price or eligibility.

## 10. Definition of Done

The client portal is ready only when:

- every user is linked through an explicit active membership;
- cross-client isolation passes positive and negative tests;
- customer sessions cannot access internal-only data;
- invoice downloads use private short-lived authorization;
- service requests cannot bypass internal approval;
- registration/recovery endpoints have abuse protection;
- legal information is layered, clear and versioned;
- cookie consent matches the actual trackers used;
- QA passes before any production action;
- production has a separately approved release gate;
- P0/P1 open findings are zero;
- secrets and personal evidence versioned are zero;
- rollback, incident response and support runbooks exist.

## 11. Immediate next action

Execute Gate CP-0 and CP-1 only. Do not implement schema or production access until the exact website repository, data flows, legal inventory, tenancy model and QA authorization package are complete.