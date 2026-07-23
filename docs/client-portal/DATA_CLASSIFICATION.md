# Client Portal Data Classification

Date: 2026-07-23
Scope: canonical and target portal data

## Classification levels

- `PUBLIC`: deliberately published website/legal content.
- `CUSTOMER`: personal or contractual data visible only to the linked client.
- `CUSTOMER_REVIEWED`: customer may propose a change; staff controls canonical mutation.
- `INTERNAL`: operational information unavailable to customer accounts.
- `FINANCIAL_PROTECTED`: fiscal/payment evidence with stricter immutability and delivery controls.
- `SECRET`: credentials, raw tokens, service-role keys, peppers and recovery material.

## Field-level decision

| Domain / fields | Class | Portal visibility | Customer mutation |
| --- | --- | --- | --- |
| Client name, billing email, phone | CUSTOMER | yes, own client | direct only for low-risk contact fields with audit, or review by policy |
| Tax ID, legal name, billing address/company representative | FINANCIAL_PROTECTED / CUSTOMER_REVIEWED | yes, own client | change request and staff review; never rewrite issued invoice snapshots |
| Client status, source lead, internal identifiers | INTERNAL | no, except customer-safe account status | none |
| Property name, service address, city/postal code | CUSTOMER | yes, own client | change request only |
| Property notes, access instructions, alarms/keys, internal status | INTERNAL or heightened CUSTOMER_REVIEWED | default no; expose only separately approved safe fields | reviewed request only |
| Job date, customer-safe service type and public status | CUSTOMER | yes, own client | no direct mutation |
| Job notes, billing metadata, staff assignment, incidents, payroll, margins | INTERNAL | no | none |
| Service request fields and customer notes | CUSTOMER | yes, own client | create; cancel only in allowed states |
| Quote number/status/customer-facing lines/totals | CUSTOMER / FINANCIAL_PROTECTED | optional after CP-1, own client only | accept/contract flow only after separate design; no direct edit |
| Quote internal notes, pricing metadata, lead links | INTERNAL | no | none |
| Invoice number/date/status/customer-facing lines/totals/fiscal snapshot | FINANCIAL_PROTECTED | yes, own client | read-only |
| Invoice internal notes, pricing metadata, sequence internals | INTERNAL / FINANCIAL_PROTECTED | no | none |
| Payment state, paid/outstanding amount, payment date/method summary | FINANCIAL_PROTECTED | minimal read-only | none; portal has no payment feature |
| Payment notes, reconciliation/origin internals | INTERNAL / FINANCIAL_PROTECTED | no | none |
| Invoice PDF | FINANCIAL_PROTECTED | private short-lived delivery | none |
| Expenses, suppliers, receipts | INTERNAL / FINANCIAL_PROTECTED | no | none |
| Quarterly/annual closings | INTERNAL / FINANCIAL_PROTECTED | no | none |
| Leads, intake payloads, lead drafts | INTERNAL | no | none |
| Membership role/status | CUSTOMER | own current client only | no direct DML; admin actions through Edge |
| Invitation raw token | SECRET | only once in email/browser | never stored raw |
| Invitation metadata/hash | INTERNAL / SECRET | no | Edge only |
| Auth session, recovery code, MFA secret | SECRET | Auth-controlled | Auth flow only |
| Audit/security event | INTERNAL | no raw feed | append-only trusted code |
| Legal document/version/acceptance | CUSTOMER / INTERNAL evidence | own acceptance receipt may be shown | append-only acceptance; no bundled consent |
| Marketing consent | CUSTOMER | yes | independent opt-in/out |
| Cookie choice | CUSTOMER/device scoped | consent panel | granular and revocable |

## Canonical table review

| Table | Portal decision |
| --- | --- |
| `clients` | never generic direct access; narrow profile projection |
| `properties` | narrow projection filtered by membership client |
| `jobs`, `job_lines` | customer-safe service projection; exclude operational notes/pricing internals |
| `quotes`, `quote_lines` | not required for first release dashboard; if enabled, narrow customer document projection |
| `invoices`, `invoice_lines` | narrow read-only invoice projection; preserve snapshots |
| `payments` | aggregate/summary only; no direct table access |
| `audit_events` | internal only; existing schema is not sufficient for portal event vocabulary |
| `expenses`, closing tables | deny |
| `leads`, `intake_submissions`, `lead_drafts` | deny; pending portal registration uses a separate application table |
| quiz tables | unrelated public subsystem; deny from portal |

## Data minimisation

- Do not collect bank details, ID-document images, special-category data or unrelated household details.
- Free-text fields warn users not to include health, access-code or other sensitive information.
- Use typed fields and maximum lengths before free text.
- Do not expose raw UUID/text IDs where an opaque endpoint identifier is sufficient.
- Do not place PII in object keys, URLs, metrics, logs, traces or email subject lines.

## Review triggers

Staff review is mandatory for legal name, tax ID, billing address used for invoicing, company identity, property ownership/client reassignment, and any request that could affect an issued invoice or operational schedule.
