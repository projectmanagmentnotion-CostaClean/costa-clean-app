# Gate 4B — Direct QA Execution After Supabase Authentication

Date: 2026-07-22
Project: Costa Clean App
Authorized QA project: `kpvvydthlxupjjqqdpxy`
Forbidden production project: `wfxnwfcdjainpojhbdri`

## Purpose

Resume and complete the provider-independent Gate 4B implementation after the human operator has authenticated the Supabase CLI locally. This direct execution path exists because the generic continuation reviewer correctly stopped when private Supabase authentication and remote QA mutation became necessary.

## Required starting state

- Supabase CLI authentication is available locally through the user's private credential store.
- `npx supabase projects list` can see QA project `kpvvydthlxupjjqqdpxy`.
- Any existing uncommitted Gate 4B work from the blocked continuation run must be preserved and audited before new edits.
- Production is healthy and requires no recovery action.

## Authorized scope

Complete Gate 4B only in QA using the providerless architecture already authorized in `docs/GATE_4B_PROVIDERLESS_QA_FALLBACK_AUTHORIZATION_20260722.md`:

`QA quiz frontend -> strict contract + honeypot/minimum interaction -> public Edge Function -> server validation -> HMAC pseudonymous throttling -> private transactional RPC -> minimal insert`

Authorized work:

1. Inspect current worktree and the latest private continuation artifacts without exposing their contents.
2. Reuse and finish any valid Gate 4B source changes already present.
3. Generate a cryptographically secure independent pepper and install it only in Supabase QA Edge Function secrets.
4. Create or finalize exactly one unique 14-digit incremental migration, one private RPC and the minimum abuse-control storage.
5. Run the disposable PostgreSQL proof and record the exact migration hash.
6. Verify the exact target three times before any remote action.
7. Apply the reviewed migration only to QA using PostgreSQL 17, `ON_ERROR_STOP` and one transaction. `db push` remains prohibited.
8. Deploy the Edge Function only to QA.
9. Run synthetic legitimate, malformed, oversized, unknown-field, honeypot, too-fast, replay and cooldown tests.
10. Prove direct anonymous RPC execution and anonymous history reads remain denied.
11. Inspect logs for privacy violations and clean all synthetic records.
12. Run lint, build and the complete test suite.
13. Update Gate 4B evidence and roadmap documents.
14. Commit and push the completed bounded Gate 4B work.
15. Stop before Gate 4C and production authorization.

## Non-goals and prohibitions

- Never touch production `wfxnwfcdjainpojhbdri`.
- Never run `db push` or migration repair.
- Never touch invoices, payments, fiscal closings, fiscal numbering, fiscal sequences or full-submit.
- Never use real customer data.
- Never expose or print passwords, access tokens, connection strings, service-role values, the HMAC pepper or private artifacts.
- Never commit `.project-agent/private/`, `.env*` secrets, dumps, auth state, cookies or private reports.
- Never add Cloudflare, Turnstile, DNS changes, Upstash, paid plans or overage in this gate.

## Mandatory stop conditions

Stop and report the smallest required human action if:

- Supabase login or MFA is still required;
- QA project identity cannot be proven exactly;
- a database password or private connection value is unavailable through an existing private mechanism;
- the migration or deployment target could be production;
- local proof fails;
- cleanup cannot prove zero synthetic residue;
- any requested action exceeds this authorization.

## Completion report

Report:

1. Initial and final HEAD.
2. Files created or updated.
3. Migration filename and SHA-256.
4. Local disposable proof result.
5. QA before/after fingerprints and metadata evidence.
6. Edge Function deployment evidence.
7. Synthetic test matrix and cleanup evidence.
8. Production modified: NO.
9. Secrets versioned: 0.
10. Commit and push.
11. Gate 4C remains blocked pending separate authorization.
