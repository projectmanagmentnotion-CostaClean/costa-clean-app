# QA Sandbox Private Setup Instructions

## Current Stop Point

The automated sprint is blocked before sandbox authentication or data access because this work PC has no populated `.env.qa.local`, no Supabase CLI, no local Supabase project link, no isolated auth profile, and no proven restore operator. An ignored empty template was created and opened in Notepad for the authorized user. The linked Vercel project is a hosting configuration and cannot establish Supabase isolation.

Do not reuse `.env.local`: it is not classified as QA and contains private credential names that are forbidden in the browser runner.

## Manual Supabase Decision

An organization owner or administrator must choose one of these isolated targets in the Supabase Dashboard:

1. A separate project named `costa-clean-qa`; or
2. A persistent QA branch whose schema and credentials are isolated from production.

Before creating either target, review organization, region, compute, branching availability, backup/restore capability, and cost. Do not let automation choose billing or organization scope.

A branch must not be accepted merely because it exists. This repository has only one file under `supabase/migrations` while many historical SQL files live under `sql/`; the operator must verify that the QA target contains the complete current schema, policies, functions, triggers, and numbering contracts. Do not merge a QA branch back to production.

## Private Configuration

After the isolated target exists, open `.env.qa.local` in the repository root and add only public browser configuration:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=qa
QA_ENV=sandbox
QA_SANDBOX_PROJECT_REF=
QA_SANDBOX_RESET_STRATEGY=
```

Rules:

- Use the QA Project URL and QA publishable/anon key only.
- Set `QA_SANDBOX_PROJECT_REF` to the project reference from the QA URL.
- Choose `QA_SANDBOX_RESET_STRATEGY=branch-discard` only for a disposable branch that can be recreated from a verified baseline.
- Choose `QA_SANDBOX_RESET_STRATEGY=snapshot-restore` only when an operator can restore the QA project to a captured baseline and verify the result.
- Never place service-role keys, secret keys, database passwords, access tokens, connection strings, cookies, or credentials in `.env.qa.local`.
- Never paste any value into chat, documentation, screenshots, terminal output, or Git.

Git already ignores `.env.qa.local`. Verify without showing its contents:

```powershell
git check-ignore -v -- .env.qa.local
npm run qa:sandbox:check
```

The checker prints only the public project fingerprint, declared reset strategy, and whether it differs from the local reference project. Passing this checker does not authorize writes or full-submit.

## Required Evidence Before Dry-Run

After the configuration gate passes, the next work block must stop unless all of these are available:

1. Complete QA schema/policy/function inventory matched to the current app contract.
2. Dedicated QA user with sandbox-only authentication.
3. Outbound email, payment, fiscal, webhook, and export integrations disabled or routed to sandboxes.
4. Deterministic synthetic seed data with no production customer payloads.
5. Private baseline counts, relationships, numbering maxima, sequence state, and checksums.
6. A restorable snapshot or disposable branch baseline.
7. A tested operator procedure for restore/discard and post-reset comparison.

Only then run, in order:

```powershell
npm run qa:auth:sandbox
npm run qa:visual:sandbox
npm run qa:flow:sandbox:dry
npm run qa:flow:sandbox:write-clean
```

There is no full-submit command by design. Invoice, payment, cancellation, numbering, and fiscal writes remain blocked until the baseline and reset implementation are independently proven.

## Resume Input

When ready, tell Codex only:

- `.env.qa.local` has been saved;
- whether the target is a separate QA project or persistent/disposable branch;
- which reset strategy was selected;
- whether outbound integrations are disabled or sandboxed;
- whether the target schema was created from reviewed migrations or another authorized source.

Do not include URLs, keys, passwords, tokens, or screenshots containing credentials.

## Official Supabase References

- Branching and isolated branch credentials: `https://supabase.com/docs/guides/deployment/branching`
- Dashboard branch creation and permissions: `https://supabase.com/docs/guides/deployment/branching/dashboard`
- Database backup and restore constraints: `https://supabase.com/docs/guides/platform/backups`
- Restore to a new project and cost/data-copy caveats: `https://supabase.com/docs/guides/platform/clone-project`
