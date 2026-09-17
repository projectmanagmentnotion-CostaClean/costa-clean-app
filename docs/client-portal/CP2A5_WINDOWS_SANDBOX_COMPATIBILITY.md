# CP-2A.5 — Versioned Windows sandbox compatibility package

Status: `CERTIFIED — LOCAL / INDEPENDENT-SANDBOX COMPATIBILITY ONLY`

## Scope

CP-2A.5 is a new V6 package. It leaves every V1–V5 artifact byte-for-byte
unchanged and has no remote execution mode. It exists only to run the historical
V3 launcher and V4 unauthorized-execution boundary deterministically under the
independent Windows sandbox.

## Root causes addressed

- The frozen V4 child inherited a deliberately tiny environment, so Git could
  not receive the exact repository trust entry and stopped before its
  unauthorized-execution guard.
- The frozen V3 launcher inherited the sandbox's unavailable interactive
  profile, so the Supabase CLI telemetry/cache setup failed before `--version`.
- A private `.cmd` shim is not a safe solution because Windows resolves
  `git.exe` before it; global `safe.directory` configuration remains prohibited.

## V6 boundary

`cp2b_sandbox_compat_v6.mjs` creates one temporary profile/cache root and an
allowlisted child environment. It passes only one Git configuration entry:

`safe.directory=<exact current repository path>`

There is no wildcard trust, no global Git configuration: `GIT_CONFIG_NOSYSTEM=1`
disables system configuration and the isolated profile contains no global
configuration. There is no copied secret, remote URL, or execute capability.
The temporary profile, HOME,
USERPROFILE, APPDATA, LOCALAPPDATA and XDG cache/config paths are deleted after
each proof.

The proof runs only:

1. frozen V4 `--execute`, which must stop at `execution_not_authorized`;
2. V3 direct Supabase JavaScript `--version`;
3. V3 preload handling of the local `.cmd` shim.

It does not invoke a QA preflight, database connection, Auth API, Edge deploy,
Storage operation, ledger or CP-2B execution.

## Version governance

The authoritative V6 manifest is
`scripts/client-portal/cp2b_qa_package_v6.manifest.json`. It pins the V6
compatibility module, proof entry point and tests, then re-verifies the reused
V5 manifest plus immutable V4/V3 runner, test and launcher artifacts.

V6 uses a static canonical registry for every reused V3/V4/V5 artifact path
and SHA-256, so a manifest substitution fails closed before any proof is run.
It then transitively re-verifies every artifact declared by the hash-pinned V5
manifest. The V6-owned source artifacts remain versioned through the normal
reviewed Git commit; a manifest cannot redirect this proof to another launcher.

V5 remains the historical QA execution package. V6 does not authorize V5,
repeat QA execution, CP-3, Supabase changes or production activity.

Rollback is a source-only revert of the V6 module, proof, test, manifest and
this document. The proof is deliberately invoked with Node rather than adding a
package script, because `package.json` belongs to immutable historical chains.
No remote rollback exists because V6 has zero remote effects.

## Certified evidence

The independent Windows sandbox ran the focused test and proof with `PASS`:
frozen V4 reached `execution_not_authorized` after exact Git trust, the V3
direct launcher and preload both reported a local CLI version, and the
temporary profile was removed. The final scope review also verified the
effective command-line-only Git origin after system configuration suppression.
