# CP-3B.2A Exact QA Authorization

Date: 2026-07-28

Current authorization: `NOT_AUTHORIZED`

CP-3B.2A permits only:

```text
node scripts/client-portal/run-cp3b2a-local-proof.mjs
node scripts/client-portal/run-cp3b2a-qa.mjs --plan
node scripts/client-portal/run-cp3b2a-qa.mjs --preflight
```

The preflight requires the existing private QA database URL, rejects the
production reference and runs one explicit read-only transaction with rollback.
It pins either the exact direct QA hostname/user or a Supabase pooler hostname
with the username bound to the exact QA project, forces `sslmode=require`, and
rejects spoofed hosts before invoking `psql`. Its output is aggregate and
sanitized.

Not authorized:

- applying the migration in QA or production;
- `db push`, `db pull`, repair or migration-history writes;
- any `--execute` mode or npm execute alias;
- Auth Admin/user changes;
- Edge deployment or secrets;
- Storage mutation;
- canonical CRM writes;
- WordPress or SiteGround access.

If later separately authorized, the expected migration effects are four
nullable columns, two format constraints, four partial unique indexes, three
private helpers, four public authenticated-only RPCs, removal of two broad
customer RLS policies and revocation of two legacy service grants. Expected
historical-row, Auth, Edge, Storage and canonical-data changes are zero.

A future authorization must name the exact migration SHA-256, exact QA project
`kpvvydthlxupjjqqdpxy`, reviewed apply/verify/rollback commands and allowed
effects. Production `wfxnwfcdjainpojhbdri` remains prohibited.
