# CP-3B V6R1F status (base 4dd3530)

## Reproduced blocker

`CP-3B.2A.6R.1E final real PostgreSQL adapter revalidates the capability map immediately before consuming it` exceeds its declared Vitest timeout of 5 seconds. It took 6.27 seconds isolated and 6.49 seconds during the full suite. Full suite on the base: 1,138 passed, 4 skipped, 1 failed (before the two new release-policy tests were added).

The hot path begins in `preflightV6` at `verifyPackageManifestV6`, which rechecks the entire protected package. `assertPackageWorkingTreeIntegrityV6` performs synchronous Git/index/worktree probes per artifact (`ls-files`, staged diff, authorized blob lookup, and raw worktree hashing); the many child-process startups dominate this small test's runtime. The timeout is not proven to be a production runtime defect, but it makes the verification suite unreliable and must remain visible.

## Safe V6R1F engineering direction

Create a separate revision and manifest; leave V6R1E files and hashes untouched. Batch metadata/blob probes for the immutable package snapshot, while retaining a fresh integrity check of each file immediately before each file-backed stage is consumed. Keep NUL-safe paths, no-follow/reparse protections, clean-index checks, exact HEAD binding, and all existing negative tests. A one-time cached snapshot alone is insufficient because it could create a TOCTOU gap.

V6R1F has **not** been implemented or certified in this delivery branch: changing the frozen runner or its package metadata would invalidate the current contract; a complete new revision requires regenerated package/canonical hashes and focused security tests. No timeout was enlarged and no test was disabled.

## 2026-10-11 stress run

After adding the delivery policy changes, a complete `npm test` run took 205.28 seconds and reported 1,147 passed, 4 skipped, 2 failed. Both failures were timeout failures in the frozen `cp3b2aV6RealAdapter.test.mjs`: `keeps read-only plan and preflight usable without execution authorization` (15 s) and `revalidates the capability map immediately before consuming it` (5 s). This is a failure, not a stable PASS; the new L2 baseline policy intentionally exempts only the single previously pinned case, so it rejects this run. The additional timeout must be reproduced and explained before the baseline policy can be widened.

Independent read-only review confirmed V6R1F remains unimplemented. Do not call this a CP3B optimization or mark the full suite stable. Safe completion requires a separately versioned runner/manifest, a reduced synchronous Git-process count, preserved immediate per-stage byte/index/HEAD checks, negative TOCTOU tests, and repeated full-suite PASS runs without suppressing the original failures.
