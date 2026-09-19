# CP-5.1C — Operational and Compliance Readiness

**Status:** `PREPARED / HUMAN_INPUT_REQUIRED / PRODUCTION NOT AUTHORIZED`
**Runtime candidate:** `7870ae4408ab7af0c944b149d2c75a70b8421e65`
**Depends on:** CP-5.1A source freeze and CP-5.1B zero-mutation preflight package

This document prepares the operational evidence required before any later
production authorization. It does not access production, QA, secrets, DNS,
Brevo, SiteGround or customer data.

## Readiness matrix

| Control | Required evidence | Current status |
|---|---|---|
| Target identity | Independent production ref proof from approved read-only sources | `HUMAN_INPUT_REQUIRED / NOT_EXECUTED` |
| Release identity | Candidate commit and CP-4.3C source hashes match CP-5.1A | `VERIFIED_SOURCE_ONLY` |
| Fresh backup | Timestamped private backup, integrity proof and restore owner | `HUMAN_INPUT_REQUIRED / NOT_EXECUTED` |
| Restore strategy | Restore path, expected duration, acceptance checks and abort point | `PREPARED / OWNER_REQUIRED` |
| Prestate compatibility | Read-only schema, constraint, RLS, grant, function and cron checks | `PREPARED / NOT_EXECUTED` |
| Secret presence | Names and presence only; values never printed, copied or committed | `HUMAN_INPUT_REQUIRED / NOT_EXECUTED` |
| Observability | Redacted worker/provider/database signals and alert destinations | `PREPARED / OWNER_REQUIRED` |
| Alert thresholds | Delivery failure, retry exhaustion, lease expiry, cron failure and auth-denial thresholds | `PREPARED / OWNER_REQUIRED` |
| Release observer | Named observer and observation window | `HUMAN_INPUT_REQUIRED` |
| Incident owner | Named incident/breach contact and escalation path | `HUMAN_INPUT_REQUIRED` |
| Rollback owner | Named operator authorized to stop/restore | `HUMAN_INPUT_REQUIRED` |
| Provider/legal | Brevo purpose, processor/DPA/region, sender domain and approved copy | `HUMAN_INPUT_REQUIRED / NEEDS_RECONCILIATION` |
| P0/P1 security | Fresh candidate-scoped review with no open P0/P1 | `NOT_EXECUTED` |
| Invite-only boundary | Proof that public registration is disabled and invitation boundaries remain intact | `NOT_EXECUTED` |
| CP-5.2 authorization | Exact target, cohort, window, backup, rollback and stop conditions | `TEMPLATE_READY / NOT AUTHORIZED` |

No human names are inferred. Missing ownership remains an explicit blocker.

## Required read-only evidence package

Before CP-5.1 can be proposed for closure, an authorized package must record:

1. production target identity from at least two independent read-only signals;
2. candidate/hash equality against CP-5.1A;
3. compatible prestate for the canonical migration, including RLS/FORCE RLS,
   grants, security-definer function contracts, audit constraint and cron;
4. a fresh private backup and restore verification owned by a named operator;
5. configuration/secret presence without exposing values;
6. redacted monitoring, alert routing and an observation window;
7. fresh P0/P1 and invite-only/public-registration evidence;
8. provider/legal reconciliation and approved support/incident ownership.

## Stop conditions

Stop without attempting a mutation when any target, hash, prestate, backup,
secret-presence, owner, provider, legal or monitoring fact is ambiguous. Also
stop for any P0/P1, public registration, cross-client isolation regression,
missing rollback proof, unexpected cron state, `db push`, migration-history
operation, real email, customer invitation or financial/fiscal effect.

## Exact future authorization boundary

CP-5.1C may prepare evidence and templates only. A later authorization must
explicitly name the target, candidate, allowed read/write operations, backup,
restore owner, incident owner, rollback thresholds and whether real delivery is
excluded. CP-5.2 remains `NOT STARTED` and is not implied by this document.

**Disposition:** `CP51C_PREPARED / HUMAN_INPUT_REQUIRED / ZERO_REMOTE_ACTIONS`
