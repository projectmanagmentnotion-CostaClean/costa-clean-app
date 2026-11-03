# P0 + V3 GitHub Actions SQL proof

This workflow runs only on GitHub's disposable `ubuntu-latest` runner. It
starts the official Supabase local stack on a Docker bridge network marked
`--internal`, with published ports bound to `127.0.0.1`,
with no remote Supabase URL, access token, project link, or repository secret.
It never connects to QA or Production. No SQL, users, or files are exported as
artifacts; raw logs remain in a private temporary directory only during the
job, while failures print a bounded error class, CLI/engine versions, network
flags, and container names/states without raw output. Temporary files are
removed when the job exits.
The root `vercel.json` disables Git deployments only for this validation
branch, preventing this branch's push from creating another Vercel Preview;
other branches, including `main`, are not covered by this exception.

The runner replays the exact Git SQL available at the pinned `main`, V3 PR #28,
and P0 PR #30 commits. The QA bootstrap is loaded as a one-time local starting
schema and excluded from the temporary incremental migration directory. The
five source migrations whose Production statement equivalence was previously
confirmed are applied once to each fresh local database; this is not a remote
ledger repair and does not prove their remote aliases.

## Result semantics

- `PASS_REAL_SYNTHETIC`: SQL and role operations executed on the disposable
  Supabase stack using synthetic identities and rows.
- `INCOMPLETE`: execution was synthetic but the starting state is not a faithful
  Production reconstruction. The committed manifest records a stale,
  public-only baseline and a remote ledger larger than the Git history. A green
  SQL run cannot upgrade this to Production-equivalent evidence.
- `NOT_TESTED`: scenario intentionally not executed because no approved,
  standard migration-ledger path has been established.

The workflow exercises P0 alone after replaying the historical migrations and
five equivalent V3 source migrations, then runs the guarded V3 → N56 → grant
hardening → reconciliation → P0 chain. At each guarded transition it performs
synthetic operator-deny and finance-allow INSERT/UPDATE checks. The final P0
matrix checks anon, authenticated memberships, financial roles, destructive
grants, the four privileged RPC ACLs, and rollback/sequence invariants. Each
guarded transition checks nonmember/operator denial and owner/admin/finance
INSERT and UPDATE access. Storage
catalog and effective ACL fingerprints must remain identical across P0.
After N56, the runner also asserts that all four receipt Storage policies have
the expected command, authenticated role, QA bucket scope, staff-membership
predicate, path traversal guard, and that the legacy permissive receipt
policies are absent. It compares the Storage policy/catalog and table ACL
fingerprints across P0. No Storage object or byte-level Storage API operation
is created or read, so Storage runtime behavior remains outside this proof.

The P0-first variant is reported `NOT_TESTED`: P0's migration version is later
than the V3/N56 versions, and the approved evidence does not establish a safe
normal CLI/ledger procedure for applying those older unregistered migrations
after P0. No custom ledger writes are used to simulate that path.

The P0-only scenario can earn `PASS_REAL_SYNTHETIC`; the V3 scenario remains
`INCOMPLETE` unless a future, separately verified Production-equivalent
prestate and complete ledger are supplied. GitHub Actions must be run only after
the owner authorizes pushing this branch; no remote execution is part of the
local commit.
