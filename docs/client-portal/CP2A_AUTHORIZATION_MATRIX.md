# CP-2A authorization matrix

The SQL matrix covers anonymous, unverified, pending, suspended, revoked, active `client_member`, active `client_admin`, active staff and suspended staff across own client, other client and random identifiers.

It asserts account/profile/property/service/request/invoice projections; profile/property review writes; idempotent service request create/cancel; member invite/revoke rules; application state; document authorization; direct canonical REST/DML denial; legacy operational and financial RPC denial; private bucket/no listing; invitation use/expiry/revocation/replay; rate-limit burst/expiry; audit minimization; unchanged fiscal sequences; active-staff regression and suspended-staff denial.

Required invariants passed locally:

- A cannot read or download B; wrong-client and random IDs deny without existence disclosure.
- inactive portal states return no business data.
- members cannot administer memberships; admins are limited to their explicit client and cannot relink.
- a service request creates one `client_service_requests` row and zero jobs, quotes, invoices or payments.
- invoice authorization returns only an exact opaque key with TTL 60.
- invitations persist a hash only and are single-use, expiring and revocable.
- active staff retains guarded operational access; suspended staff does not.

Code tests separately cover strict contracts, unknown fields, generic errors, production rejection, invitation hashing and exact-path signing.
