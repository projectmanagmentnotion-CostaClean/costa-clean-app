# CP-4.2B.7 Runtime Runbook

Status: `QA_CERTIFIED`

The final full-funnel QA runtime certification completed on `2026-09-16`.
The private report is present locally, remains Git-ignored, and records only
safe assertion data. It is not source-controlled.

## Safety boundary

- QA target is fixed to `kpvvydthlxupjjqqdpxy`.
- The runner rejects the production ref `wfxnwfcdjainpojhbdri` and any
  non-local WEB URL.
- No Supabase call is made by importing the runner or running its tests.
- No credential, signer, cookie or browser session is stored by the runner.
- The signer and QA admin key are read only from the process environment when
  the owner explicitly runs the command. Neither is printed or written to the
  report.
- The report is written to `qa-reports/private/cp42b7-runtime.json`, which is
  ignored by the repository policy.

## Runtime inputs

Provide these privately in the process environment only:

```text
PUBLIC_LEAD_INTAKE_URL=https://kpvvydthlxupjjqqdpxy.supabase.co/functions/v1/public-lead-intake
PUBLIC_LEAD_INTAKE_ENV=qa
PUBLIC_LEAD_INTAKE_SECRET=<private QA signer>
SUPABASE_QA_SERVICE_ROLE_KEY=<private QA verification key>
```

`SUPABASE_QA_SERVICE_ROLE_KEY` is used only by this server-side QA runner for
restricted read/cleanup verification. It is never part of the WEB runtime
public configuration. Do not put either secret in a tracked file or command
arguments.

## One command

From `C:\Users\USUARIO\costa-clean-app`, after the private environment is
configured:

```powershell
npm run qa:cp42b7
```

The runner starts the real `costa-clean-web` app locally on `127.0.0.1:3217`,
checks that `/api/quote` exists, submits one fresh synthetic RES-C request,
verifies the QA rows and B.6 aggregation, replays the exact payload, checks
zero delta for canonical business entities, cleans by exact `submission_id`
and generated `lead_id`, and verifies the original counts are restored.

## Assertions

The synthetic request expects RES-C: `2` operators, `3` elapsed hours, `6`
operator-hours, `120` EUR internal base and `60` EUR labor. These values are
asserted only in restricted QA data and cannot be present in the public
response. The public response must be exactly `{ "ok": true }`.

The runner also asserts `cp42b-v2`, `quote_draft_seed_v1`,
`costa_clean_quote_intelligence@1.0.0`, `estimate_v1`, `needs_review`, null
customer pricing, four independent consent records, UTM preservation, and
absence of click IDs when advertising consent is false.

The B.6 aggregator is loaded from the canonical local implementation. The
single synthetic campaign is expected to be suppressed by the owner-approved
`k=3` threshold; service, city, week/month and recurrence remain operational
internal dimensions.

## Certified execution

- The real local WEB `/api/quote` -> HMAC -> QA Edge -> RPC path passed.
- The QA target was `kpvvydthlxupjjqqdpxy`; production writes were `0`.
- The public response was minimal, and the RES-C assertion passed: 2
  operators, 3 elapsed hours, 6 operator-hours, 120 EUR internal base and 60
  EUR internal labor cost in restricted QA data only.
- Consent separation, advertising click-ID gating, audit persistence,
  idempotency, B.6 intelligence loading and the owner-approved `k=3`
  suppression all passed.
- Canonical business entities had zero delta. The exact synthetic fixture was
  removed by the guarded QA cleanup RPC and the baseline counts were restored.
- The QA migration `cp42b7_guarded_runtime_fixture_cleanup` is applied. Its
  append-only audit trigger remains active; the cleanup RPC is restricted to
  the exact synthetic fixture guard set.

## Controlled rerun procedure

1. Authenticate Supabase normally and confirm the project is
   `kpvvydthlxupjjqqdpxy`.
2. Synchronize the same QA-only HMAC signer into the QA Edge runtime and the
   local WEB process environment. Do not display or commit its value.
3. Set the ephemeral `SUPABASE_QA_SERVICE_ROLE_KEY` for QA-only verification.
4. Run `npm run qa:cp42b7`.
5. Review `qa-reports/private/cp42b7-runtime.json` for safe PASS/FAIL data.
6. Remove the ephemeral signer and QA admin key from the local environment.
7. Preserve `QA_CERTIFIED` only when a rerun also passes every assertion;
   otherwise record the exact new blocker.

SiteGround remains separate:
`SITEGROUND=BLOCKED_EXTERNAL_INFRASTRUCTURE` and
`SITEGROUND_QA_SIGNER_SYNC_REQUIRED=YES`. This is a separate deployment debt
and does not invalidate the certified local/QA funnel.
