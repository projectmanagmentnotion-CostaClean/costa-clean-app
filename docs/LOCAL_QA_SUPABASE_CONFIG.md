# Local QA Supabase Configuration

## Purpose

The local authenticated QA build and deterministic write-and-clean cleanup require the same public Supabase project configuration used by the application. This configuration is local-only and must never be committed or printed in logs.

## Required Variables

Only these variable names are required:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Use the project URL and the public/anonymous key from the existing Vercel or Supabase project configuration. Never use `SUPABASE_SERVICE_ROLE_KEY`, a service-role key, a database password, or any privileged token for this QA flow.

## Local File

Create `C:\Users\Anderson S\costa-clean-app\.env.local` and set the two values there. `.env.local` is covered by `.gitignore` through `.env*.local` and must remain untracked.

Do not paste the values into prompts, documentation, terminal output, screenshots, reports, or `.env.example`. The committed `.env.example` intentionally contains variable names with empty values only.

## Safe Presence Check

This PowerShell check reports only missing variable names and never prints values:

```powershell
$required = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY')
$present = Get-Content -LiteralPath '.env.local' |
  ForEach-Object { if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*.+$') { $Matches[1] } }
$missing = $required | Where-Object { $_ -notin $present }
if ($missing) { throw "Missing local QA variables: $($missing -join ', ')" }
git check-ignore -v -- .env.local
```

## Local Connection Verification

From the repository root:

```powershell
npm run build
npm run preview
```

Keep preview running, open `http://127.0.0.1:4173/`, and confirm the authenticated shell loads without the Supabase startup error. If the reusable QA profile is not authenticated for the local origin, run the visible setup flow before QA:

```powershell
$env:QA_APP_URL='http://127.0.0.1:4173/'
npm run qa:auth:setup
```

Do not continue if authentication, shell startup, or the local build fails.

## Dry-run Gate

Run the full visible dry-run before enabling writes:

```powershell
$env:QA_APP_URL='http://127.0.0.1:4173/'
$env:QA_REMOTE_DEBUGGING_PORT='58811'
node scripts/qa/run-end-user-flow-agent.mjs --mode=dry-run
```

All applicable checks must pass. A startup error, authentication failure, flow failure, or stale URL blocks write-and-clean.

## Write-and-clean Gate

Only after local dry-run is green:

```powershell
$env:QA_APP_URL='http://127.0.0.1:4173/'
$env:QA_REMOTE_DEBUGGING_PORT='58811'
$env:QA_ALLOW_WRITE_CLEAN='1'
node scripts/qa/run-end-user-flow-agent.mjs --mode=write-and-clean
```

Allowed flows:

- `client-create`
- `property-create`
- `quote-create`
- `expense-create`

Each entity must include the run `qaRunId`, expose or resolve its created ID, and finish with cleanup status `cleaned`. Cleanup with zero affected rows is a failure.

Always blocked or skipped:

- invoice creation or emission
- payment/cobro registration
- fiscal actions
- job/service creation while no cleanup contract exists
- schema, SQL, RPC, migration, auth, numbering, calculation, or financial write changes

The run is not green when submits are skipped for missing Supabase public configuration. Private reports and screenshots must remain under ignored `qa-reports/private/` and `qa-screenshots/private/` paths.
