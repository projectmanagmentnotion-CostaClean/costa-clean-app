# CP-3B.2A.6R.1 Final Real PostgreSQL Closeout V6R1

Date: 2026-08-03

Status: `PREPARED_NOT_AUTHORIZED`

CP-3B.2A.5 proved that the historical mixed-byte pin for the V3 manifest could not be reconstructed honestly from the current Git-visible sources. CP-3B.2A.6R.1 replaces the synthetic V6 runner with a real PostgreSQL QA adapter while keeping the reproducible identity model that uses:

- Git blob ID for stored SQL, MJS and documentation artifacts;
- `CP3B2A_CANONICAL_JSON_V1` for contractual JSON;
- canonical JSON digests derived from parsed objects, not from checkout bytes;
- PostgreSQL 17 read-only preflight against QA;
- private backup storage under an ignored repo-local path.

This gate preserves the historical V1-V5 evidence chain unchanged. It does not modify the reviewed migration, does not touch QA or production and does not authorize `--execute`.

## Reproducibility rules

- JSON is canonicalized by recursively sorting object keys and preserving array order.
- Working tree line endings are not part of the JSON identity.
- Git blob identity is derived from the committed object, not from the checkout rendering.
- The manifest package stores the V6R1 artifact identities for the new package; the manifest itself is validated at runtime and is not self-referential.
- The V5 historical pin remains recorded as unrecoverable evidence, not as a dependency for V6R1.

## V6R1 package boundary

The V6R1 package is the new executable contract for the future client-portal QA path. It includes:

- a canonical JSON utility;
- a local concurrency/state model;
- a reproducible matrix SQL contract;
- a plan/preflight runner;
- a local proof harness;
- a package manifest and exact authorization note.

The runner remains fail-closed unless the future authorization gate is supplied exactly. No QA or production write is authorized here.
