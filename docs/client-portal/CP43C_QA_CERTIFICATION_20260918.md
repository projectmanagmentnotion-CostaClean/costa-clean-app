# CP-4.3C — QA certification closeout

Date: 2026-09-18

## Certified QA state

Project: `kpvvydthlxupjjqqdpxy`

The invitation-delivery path was certified end-to-end in Brevo sandbox `drop` mode.

- worker: `portal-invitation-delivery-worker` v18
- worker SHA-256: `bd309b300e1bbe20532d70ea4a5c1c6d33704b4507307e8a761729794c39d3d6`
- worker HTTP: 200
- Brevo POST count: 1
- sandbox: `drop`
- real emails: 0
- outbox: `provider_accepted`
- attempt_count: 1
- provider_message_id: present
- encrypted payload: destroyed
- lease: cleared
- audit event: `invitation_delivery_provider_accepted`
- audit result: `completed`

The temporary wrapper was returned to HTTP 410. QA invitation fixtures, outbox rows, payloads, temporary membership and temporary Auth user were verified at zero.

## Root causes fixed

1. QA recipient mapping was missing from the worker runtime configuration.
2. Provider/internal failure boundaries were too broad to identify the failing stage.
3. Edge Runtime timer functions were passed as unbound references. Calling them through the dependency object changed their receiver and raised `brevo_timer_exception`.
4. `setTimeout` and `clearTimeout` now use wrappers over `globalThis`, matching the certified v18 runtime.

## Database reconciliation

QA accumulated diagnostic-only migrations while isolating the delivery failure. Those intermediary migrations are not intended for direct production promotion.

`20260918133000_cp43_certified_invitation_delivery_contract.sql` is the consolidated production-review migration representing the final certified database contract: outbox, encrypted payload storage, claim/finalize RPCs, service-role grants, audit event values and expiry cleanup job.

It must be reviewed and applied only during a separately authorized production rollout.

## Production status

Production `wfxnwfcdjainpojhbdri` was not touched during this closeout.

No DNS or secret values are included in this repository change.
