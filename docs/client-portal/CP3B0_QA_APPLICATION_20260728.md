# CP-3B.0 QA Application V2

Date: 2026-07-28

Status: `DONE`

Target: Supabase QA `kpvvydthlxupjjqqdpxy`

Authorized starting HEAD:
`8ab1eeb156e5620d1bb9415f529c5b8c48a619ff`

## Authorized effect

The frozen V2 runner executed exactly once and created exactly:

```text
public.portal_resolve_self_access_context()
```

No other remote effect was authorized or observed. Production, WordPress and
SiteGround were not touched.

## Pre-effect evidence

- local `main`, `origin/main` and the authorized HEAD matched with divergence
  `0/0` and a clean worktree;
- all nine V1 artifacts, all nine V2 artifacts and the complete CP-2B V5
  chain passed their frozen hashes;
- the migration SHA-256 matched
  `c6161ddb4d5d85e139aea98a47429feae21d20dd06c5e3d54b579f58c5468731`;
- local link, Supabase CLI and PostgreSQL identified only the authorized QA
  project; the production project was not linked;
- PostgreSQL live read, the 11 portal tables, the CP-2B prerequisite, catalog
  digests and zero synthetic collisions passed;
- the target function was absent;
- a fresh ignored private backup with eight verified artifacts was created for
  the exact authorized HEAD and matched the immediate prestate.

No secret, connection string, token, private path or internal UUID is recorded
in this document.

## One-shot execution

The direct command
`node scripts/client-portal/run-cp3b0-qa-v2.mjs --execute` ran once:

| Control | Result |
|---|---|
| Target | `QA_MATCH` |
| Pre-effect ordering | `PASS` |
| Apply attempts | `1` |
| Remote effect | `ONE_FUNCTION_CREATED` |
| QA authorization matrix | `PASS_ROLLED_BACK` |
| Synthetic residue | `0` |
| Recovery attempts | `0` |

There was no retry and no recovery path was entered.

## Independent post-application verification

Independent read-only PostgreSQL checks against the fresh backup confirmed:

- exactly one zero-parameter function returning `jsonb`;
- `STABLE`, `SECURITY DEFINER`, owner `postgres`;
- fixed `search_path=pg_catalog` and a function comment;
- execute denied to `PUBLIC`, `anon` and `service_role`;
- execute granted only to `authenticated`;
- all 11 portal tables still present;
- portal rows, policies, table grants, other portal functions and migration
  history unchanged from the immediate prestate;
- no synthetic Auth user, CRM client, membership, application or staff fixture;
- the existing `invoice-documents` bucket remained private and empty.

Observed changes:

| Surface | Change |
|---|---:|
| Authorized function | `1 created` |
| Table rows | `0` |
| Policies | `0` |
| Table grants | `0` |
| Auth users | `0` |
| Edge Functions | `0` |
| Storage | `0` |
| Migration history | `0` |
| Production / WordPress / SiteGround | `0` |

## Regression

- `npm test`: `64` files passed; `368` tests passed and `4` skipped;
- `npm run qa:agents`: `160/160 PASS`;
- `npm run lint`: `PASS`;
- `npm run build`: `PASS`;
- frontend changes: `0`;
- versioned secrets: `0`;
- real PII added: `0`;
- tracked private files: `0`.

## Gate state

- CP-3B.0: `DONE`;
- CP-3B.0A: `DONE`;
- CP-3B.0 QA application: `DONE`;
- CP-3B.1: `UNBLOCKED_NOT_STARTED`;
- CP-3B.2: `NOT_STARTED`.

This closeout does not start or implement CP-3B.1.
