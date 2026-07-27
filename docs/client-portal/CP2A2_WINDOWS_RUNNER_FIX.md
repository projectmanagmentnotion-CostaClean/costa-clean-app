# CP-2A.2 Windows-compatible Supabase CLI runner

Date: 2026-07-27
Status: `DONE — LOCAL/READ-ONLY ONLY`
Remote writes: `0`

## Scope

CP-2A.2 corrects only the Windows process-launch boundary used by the future CP-2B QA runner. It does not authorize or execute CP-2B, apply SQL, create Auth users, deploy Edge Functions, write Storage, modify QA/production, touch WordPress, or start `/portal` or CP-3.

The 16 original frozen artifacts and all eight V2 artifacts remain byte-for-byte unchanged. V3 is a separate package with a separate manifest and authorization ID.

## Root cause

The npm Windows shim at `node_modules/.bin/supabase.cmd` is a batch file. It resolves Node and forwards arguments to `node_modules/supabase/dist/supabase.js`. V2 passed the `.cmd` path directly to Node `spawnSync` with `shell: false`. Windows cannot create a batch file as a native process, so Node returned `EINVAL`.

The failure occurred in the initial CLI identity check, before `createEmptyLedger`. Consequently the blocked V2 attempt created no ledger, Auth user, fixture, schema, bucket, Storage object, secret, or Edge deployment.

## V3 launcher

`cp2b_command_launcher_v3.mjs` provides two controlled paths:

1. Supabase CLI uses the package's real JavaScript entry with `process.execPath`. This avoids the batch shim entirely on Windows and behaves identically on Linux and macOS.
2. A restricted compatibility path exists for a real `.cmd`/`.bat`. It invokes the exact `ComSpec` with `/d /s /c`, `shell: false`, `windowsVerbatimArguments: true`, and a reviewed command string in which every token is quoted.

The batch path rejects:

- NUL, CR, or LF in executable and arguments;
- `"`, `&`, `|`, `<`, `>`, `^`, `%`, or `!`;
- empty or non-string command tokens.

This deliberately supports paths and arguments containing spaces while refusing command-shell expansion and injection syntax. It does not use `eval`, `Invoke-Expression`, generic `shell: true`, or debug mode.

## Secret handling

- Secrets are inherited only through the child environment.
- Supabase access tokens, anon/service keys, QA database URL, and portal peppers are rejected if copied into launcher arguments.
- The V3 runner never adds `--debug`.
- `redactFailure: true` exposes only `command_failed:<binary>:redacted`.
- The launcher writes no command log, report, environment file, or private output.
- Private preflight/backup files remain ignored under `.git/cp2b-private/`.
- When the frozen V2 runner invokes `psql`, the preload removes the QA database URL from `argv` and maps its parsed connection fields to `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and supported `PG*` connection options. The full URL remains inherited only in the private environment.

CP-2A.2 does not open a PostgreSQL connection through V3 and does not run the mutating path.

## Runner composition

`run-cp2b-qa-v3.mjs` adds an outer V3 authorization gate:

- authorization ID `CP2B-V3-AUTHORIZATION-PENDING`;
- V3 manifest/hash validation;
- clean exact HEAD;
- nine private inputs;
- exact QA URL/database target;
- verified private backup tied to the authorized HEAD;
- local/database/CLI triple identity.

Only after those checks may a future explicitly authorized `--execute` start the frozen V2 runner. `cp2b_v3_preload.mjs` replaces only the child-process handling of `.cmd`/`.bat`; the V2 migration, fixtures, Auth lifecycle, matrices, cleanup, recovery, ledger, Storage, and Edge scope remain unchanged.

No npm execute alias exists.

## Platform behavior

| Platform | Supabase CLI path | Batch compatibility |
|---|---|---|
| Windows | Node executes `supabase/dist/supabase.js` directly | restricted `ComSpec` path, tested with a real `.cmd` |
| Linux | Node executes the same JavaScript entry directly | `.cmd` path not selected |
| macOS | Node executes the same JavaScript entry directly | `.cmd` path not selected |

## Validation

The CP-2A.2 proof is non-mutating and verifies:

- a real Windows `.cmd`;
- Supabase CLI version through the direct V3 target;
- authenticated `projects list --output json`;
- QA linked and production not linked;
- V3 plan and preflight report zero writes;
- execution gate denial without authorization;
- denial for wrong HEAD, production target, and missing private input;
- timeout, nonzero exit, command injection rejection, and secret redaction;
- mocked non-Windows direct execution.

The proof never invokes either V2 or V3 with `--execute`.

## Rollback

Rollback is a source-only revert of the V3 launcher, preload, runner, tests, proof, manifest, npm scripts, and documentation. No remote rollback exists because CP-2A.2 performs no remote mutation.

## Remaining debt

- Supabase Cloud schema, Auth, Edge, Storage, RLS, signed URLs, and cross-client behavior remain unvalidated until a separately authorized CP-2B V3 run.
- Invitation delivery remains unimplemented; the future gate may validate token security but must not claim email delivery.
- A prior Edge bundle still cannot be reconstructed automatically. The reviewed disable-first recovery remains mandatory.
- The private backup must be regenerated and tied to the future exact authorized V3 HEAD.
- V3 preparation is not authorization. CP-2B remains blocked until a new prompt names the exact clean V3 commit, QA ref, authorization ID, hashes, private prerequisites, and permitted mutation scope.
