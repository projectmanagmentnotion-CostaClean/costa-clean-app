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
