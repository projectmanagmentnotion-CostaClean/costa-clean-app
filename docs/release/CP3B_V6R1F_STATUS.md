# CP-3B V6R1F integrity revision

## Implemented scope

V6R1F is a separately versioned, read-only package-integrity adapter. It does not alter the frozen V6R1E runner or its manifest, grant execution authorization, connect to a database, or apply migrations. Run it with an explicit commit:

```powershell
node scripts/client-portal/run-cp3b2a-qa-v6r1f-integrity.mjs --commit <full-commit-sha>
```

The adapter verifies the complete frozen V6R1E package plus the V6R1F manifest and implementation. It batches Git metadata into five processes for the whole package (exact HEAD, object format, staged-path set, index metadata, and `cat-file --batch-check`) rather than launching several synchronous Git children for every artifact. It then hashes raw working-tree bytes and checks each path component for symlinks/reparse points, resolved-path containment, and file identity before/after reading. `verifyStageV6R1F` repeats a fresh exact-commit check immediately before an individual file-backed stage; a cached package snapshot is not treated as a stage lease.

The manifest pins SHA-256 for the new V6R1F code and test files. The adapter also binds all checked bytes to the caller-supplied immutable commit. It is not an independent trust root: an operator must supply the commit from a trusted source.

## Frozen runner limitation

V6R1E and its package manifest remain byte-for-byte unchanged. Its exported `preflightV6` always calls its own serial `verifyPackageManifestV6` before it accepts injected stage-verification dependencies. Therefore V6R1F's optimized verifier cannot transparently replace that first check without modifying the frozen runner contract. The new adapter is implemented and executable, but it is not represented as an integrated database-execution replacement; CP3B's existing V6R1E timeout remains a visible suite failure until a reviewed, separately authorized runner integration is made.

## Why prior work stopped at NOT_IMPLEMENTED

The previous status documented an implementation direction but created no V6R1F runtime module or test. Work stopped to avoid changing the frozen V6R1E runner/manifest, but did not proceed to the separately versioned adapter explicitly requested. This revision closes that implementation gap for the integrity layer while preserving the frozen package.

## Regressions and remaining validation

Focused tests exercise clean package hashing, staged changes, worktree divergence, moved HEAD, path traversal, per-stage revalidation, and an external Windows junction/POSIX symlink fixture. Full-suite results are reported separately; the frozen V6R1E timeout is not suppressed or lengthened by this revision.
