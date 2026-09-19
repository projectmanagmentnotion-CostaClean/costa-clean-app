# CP-5.1D — Production Read-only Authorization Boundary

**Status:** `TEMPLATE ONLY / NOT AUTHORIZED`

This document is an exact authorization template for a future CP-5.1
production-readiness inspection. It does not authorize access or mutation.

## Fixed identities

- Runtime candidate: `7870ae4408ab7af0c944b149d2c75a70b8421e65`
- Expected production Supabase ref: `wfxnwfcdjainpojhbdri`
- Expected QA Supabase ref: `kpvvydthlxupjjqqdpxy`
- Canonical migration blob: `c7c686769160d987c3721721a589dae1eae0dced`

The authorization is valid only for the exact identities above. Any mismatch,
unknown target or mixed QA/production signal is an immediate stop.

## Allowed scope

Only read-only inspection required for CP-5.1 may be authorized:

- project identity and non-secret metadata/configuration;
- schema, prestate, tables, columns and constraints relevant to the candidate;
- RLS, FORCE RLS, policies, grants, function signatures and triggers;
- `pg_cron` extension and relevant jobs;
- non-secret observability/prestate signals;
- presence-only checks for required configuration/secrets, without reading or
  revealing values;
- compatibility checks against the canonical migration.

No backup or restore execution is included unless separately and explicitly
listed in the authorization. A private backup must never enter Git or output.

## Prohibited scope

The authorization must not permit any `INSERT`, `UPDATE`, `DELETE`, DDL,
migration apply, migration repair, migration-history write, `db push`, deploy,
Edge Function deploy, Auth mutation, user creation, email/Brevo send, secret
value access or mutation, DNS, SiteGround, customer invitation, CP-5.2 pilot,
financial/fiscal write, cleanup or any production mutation.

## Mandatory stop conditions

Stop immediately if:

- the project ref is not exactly the expected production ref;
- environment identity is ambiguous or evidence conflicts;
- any check requires a write, elevated mutation or secret value;
- private credentials, tokens, cookies or secret values appear in output;
- required evidence is missing or cannot be independently corroborated;
- production prestate differs materially from the reviewed migration model;
- migration compatibility, backup/restore ownership or rollback evidence is
  absent;
- the request expands from read-only inspection into execution.

## Human authorization template

> I authorize a CP-5.1 production **read-only preflight only** for production
> ref `wfxnwfcdjainpojhbdri`, candidate
> `7870ae4408ab7af0c944b149d2c75a70b8421e65`, and migration blob
> `c7c686769160d987c3721721a589dae1eae0dced`. The QA ref is
> `kpvvydthlxupjjqqdpxy` and must not be inspected as production. Allowed work
> is limited to non-secret identity, metadata, schema/prestate, RLS/policy,
> grants, function/trigger, pg_cron, observability and presence-only
> configuration checks. No writes, DDL, migrations, db push, deployment,
> secrets access/value disclosure, email, Auth mutation, invitations, DNS,
> SiteGround, financial/fiscal operation, cleanup or CP-5.2 action is allowed.
> Stop on any mismatch, ambiguity, missing evidence or scope expansion.

## Human owners

`RELEASE_OWNER`, `ROLLBACK_OWNER`, `INCIDENT_OWNER`, `OBSERVABILITY_OWNER`,
`BACKUP_OWNER` and `RESTORE_OWNER` are all `HUMAN_INPUT_REQUIRED` until named
by the owner outside this document.

**Disposition:** `CP51D_TEMPLATE_READY / PRODUCTION_NOT_AUTHORIZED`

## Executed read-only preflight record — 2026-09-19

The owner authorized one bounded read-only preflight using the fixed identities
above. The authorization was honored. No production writes, DDL, migration
application, `db push`, deployment, secret-value access, email, Auth,
invitation, DNS, SiteGround, financial/fiscal or CP-5.2 operation was
performed.

### Verified identity

- Supabase project ref: `wfxnwfcdjainpojhbdri`
- Project: `CostaClean`
- Status: `ACTIVE_HEALTHY`
- Region: `eu-west-1`
- Candidate commit: `7870ae4408ab7af0c944b149d2c75a70b8421e65`
- Canonical migration blob: `c7c686769160d987c3721721a589dae1eae0dced`

The candidate commit and migration blob were verified locally from Git. The
production project identity matched exactly.

### Read-only evidence

The production migration history does not contain the CP-4.3C migration. The
active Edge Function inventory contains only `submit-public-gym-manual-quiz`
and does not contain the CP-4.3C delivery worker or member-actions function.
The required CP-4.3C relations, trusted functions, trigger, constraint and
cleanup job were absent:

- `public.portal_invitation_delivery_outbox`
- `public.portal_invitation_delivery_payloads`
- `public.client_portal_invitations`
- `public.client_portal_audit_events`
- CP-4.3C trusted functions, trigger, constraint and `pg_cron` cleanup job

`pg_cron` is installed, but the required CP-4.3C job is not present. The
presence of `pg_net` was observed as environment metadata only and is not
treated as proof that the candidate contract is installed.

### Verdict

**`BLOCKED / STOP_PRESTATE_DRIFT / PRODUCTION_NOT_COMPATIBLE_WITH_CP43_CANDIDATE`**

The production prestate is materially incompatible with the QA-certified
CP-4.3C candidate. This preflight therefore stops here. The missing contract
cannot be repaired under the current authorization because migration,
DDL, deployment and production mutation are explicitly prohibited.

### Observed external production debt — not executed

The read-only security/performance advisory inspection also reported existing
production findings, including mutable function `search_path` warnings,
security-definer functions executable by `anon`/`authenticated`, disabled
leaked-password protection, unindexed foreign keys, RLS init-plan warnings,
unused indexes and duplicate invoice indexes. These findings are recorded as
external production debt only; no remediation was attempted because it would
expand beyond the authorized preflight.

### Continuation state

- CP-5.1: `BLOCKED / STOP_PRESTATE_DRIFT`
- CP-5.2: `NOT STARTED`
- Next action: obtain a separate, explicit owner-approved migration/deployment
  plan after the contract, backup/restore ownership, rollback timing and
  independent go/no-go evidence are prepared. This is a future authorization
  requirement, not an action authorized by this record.
