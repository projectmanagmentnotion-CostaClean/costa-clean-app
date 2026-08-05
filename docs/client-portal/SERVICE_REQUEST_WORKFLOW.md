# Service Request Workflow

Date: 2026-08-05
Scope: CP-1 design; no jobs or requests created

## Boundary

A portal service request is a customer message for staff review. It is not a quote, booking, job, invoice, payment or acceptance of a final price.

```text
draft (client-local UI only)
  -> pending_review
  -> under_review
  -> quoted | confirmed | rejected | cancelled
```

Only internal staff can move a request to `under_review`, `quoted`, `confirmed` or `rejected`, and only the existing internal workflow may create/link a job. A customer may cancel only `requested` (and optionally `under_review` before operational commitment under a later business decision).

## `client_service_requests`

| Field | Rule |
| --- | --- |
| `id` | uuid PK, opaque |
| `public_reference` | public customer-safe reference |
| `client_id` | derived from active membership, not trusted from body |
| `property_id` | must belong to the same client |
| `requested_by` | `auth.uid()` |
| `service_type` | controlled allowlist |
| `preferred_date` | date; advisory, not a booking |
| `preferred_time_window` | controlled enum |
| `notes` | optional, normalised, max 1,000 chars |
| `status` | controlled state machine |
| `reviewed_by`, `reviewed_at` | internal only |
| `approved_job_id` | internal only, nullable, same client |
| `quote_id` | internal only, nullable, same client |
| `cancelled_at`, `cancelled_by`, `cancellation_reason_code` | evidence |
| `created_at`, `updated_at`, `version` | concurrency/audit |

Do not accept price, staff assignment, invoice status, job status, payment data or arbitrary metadata from the customer.

## Create RPC

`portal_submit_service_request_v2(p_client_id, p_property_public_ref, p_service_type, p_preferred_date, p_preferred_time_window, p_notes, p_idempotency_key)`:

1. validates active membership;
2. checks property belongs to that client and is active;
3. validates enum/date/length;
4. rate-limits per user/client/IP pseudonym;
5. enforces unique `(requested_by, idempotency_key)`;
6. inserts only `pending_review`;
7. writes audit event;
8. returns a customer-safe receipt with public reference, version and labels.

No trigger or RPC invoked by this function may create a job, quote, invoice or payment.

## Staff review

Internal workflow shows the request separately from the jobs schedule:

- accept review ownership;
- request clarification outside or through an approved messaging feature;
- prepare a quote;
- confirm and create a job through the current protected job workflow;
- reject with a customer-safe reason;
- preserve internal notes outside the portal-safe response.

Setting `approved_job_id` requires internal staff authorization and verifies `jobs.client_id = request.client_id`. It is not customer-writable.

## Customer presentation

- `pending_review`: received, not confirmed.
- `under_review`: team is evaluating.
- `quoted`: proposal available; no automatic contract assumption.
- `confirmed`: operational service confirmed and linked only after staff action.
- `rejected`: cannot be accepted; customer-safe reason.
- `cancelled`: request withdrawn/cancelled.

Copy must not imply that preferred dates are reserved before `confirmed`.

## Cancellation

`portal_cancel_own_service_request_v2` checks membership, ownership, allowed state and optimistic `version`. It records cancellation but never deletes the row. If the request is already linked to a confirmed job, cancellation stops and directs the customer to contact Costa Clean; it does not cancel the job.

## Abuse and privacy

- maximum 5 accepted submissions per client/user per hour with lower burst limit; exact values tuned in QA;
- CAPTCHA/risk escalation for open registration, not routine authenticated use unless abuse detected;
- generic errors and no property/client existence oracle;
- free-text warning against access codes, health or special-category data;
- no notes in logs, analytics or notifications;
- customer notifications contain request reference and status only.

## Acceptance criteria

- two-client negative matrix passes;
- duplicate/replayed idempotency key produces one request;
- invalid property, date, enum, length and state transitions fail without row change;
- member cannot set status/reviewer/job/quote fields;
- no job/quote/invoice/payment row or sequence changes;
- audit records every accepted/rejected transition with privacy-safe metadata.
