# Gate 4C — Public Quiz Protection Production Release

Date: 2026-07-23  
Authorized production: `wfxnwfcdjainpojhbdri`  
Forbidden QA: `kpvvydthlxupjjqqdpxy`  
Initial HEAD: `6b3870ffdc74e5a815da62241ea1e83d84090e59`  
Result: **PASS**

## Release boundary

This completion resumed after the production migration, production-only pepper installation, Edge Function deployment and frontend deployment had already succeeded. Those four operations were verified read-only and were not repeated.

The only remote writes performed by this completion were:

1. one uniquely marked `PROD-GATE4C-*` quiz attempt through the public Edge path;
2. two HMAC guard rows created by the accepted and cooldown cases;
3. exact cleanup of that one reconciled attempt UUID and those two captured guard hashes.

No QA request, deployment, database connection or write was used.

## Read-only deployment verification

- Supabase project: exact production ref, `ACTIVE_HEALTHY`, `eu-west-1`.
- Edge Function: `submit-public-gym-manual-quiz`, `ACTIVE`, version `1`, `verify_jwt=false`.
- Edge secret: `PUBLIC_QUIZ_FINGERPRINT_PEPPER` present by name; its value was not read, printed, persisted or versioned.
- Frontend deployment: `https://costa-clean-qz7ciwi1q.vercel.app`.
- Production domain: `https://app.costacleanbcn.com`, HTTP `200`.
- Edge CORS preflight: HTTP `204`, POST allowed.
- Deployed JavaScript audit: 117 assets inspected; production ref present and QA ref absent.
- PostgreSQL identity: exact production pooler/live user, database `postgres`, PostgreSQL `17`.
- Reviewed migration SHA-256: `8FE5E78E6BCFBCF15E3537CBDEBD8A3E852FBCA04209650E47FCFBF9DB3D9EF3`.

The completion runner rejects apply, deploy and secret-installation flags. It cannot repeat the migration, pepper installation, Edge deployment or frontend deployment.

## Production baseline and private contract

Before the synthetic matrix:

- real quiz attempts: `6`;
- `PROD-GATE4C-*` attempts: `0`;
- guard rows: `0`;
- private RPC present: yes;
- private RPC executable by anon/authenticated: no/no;
- private RPC executable by service role: yes;
- legacy RPC executable by anon/authenticated: no/no;
- anonymous quiz-history policies: `0`.

Migration history contained the same three canonical versions before and after. No history write or repair was executed.

## Synthetic matrix

| Case | Expected | Result |
| --- | ---: | ---: |
| Malformed JSON | `400` | `400` |
| Oversized body | `413` | `413` |
| Unknown field / forged score | `400` | `400` |
| Honeypot filled | `400` | `400` |
| Too-fast interaction | `400` | `400` |
| Legitimate exact request | `200` | `200` |
| Replay of accepted nonce | `429` | `429` |
| Cooldown with new nonce | `429` | `429` |
| Direct anonymous private RPC | `401/403/404` | `401` |
| Direct anonymous legacy RPC | `401/403/404` | `401` |
| Anonymous quiz-history read | `401/403` | `401` |
| Anonymous direct table insert | `401/403` | `401` |

Result: **12/12 PASS**.

The legitimate request contained no client score. The public response returned `20/20`, `100%`, `passed=true`, and the single persisted row independently reconciled to the same authoritative server result. The forged-score field was rejected.

## Log privacy

The Management API inspected only `function_logs.event_message` inside the synthetic run window. Three accepted/replay/cooldown events were found.

The scan found zero occurrences of the synthetic worker marker, either nonce, anon key, bearer/authorization text, user-agent text, forwarded-IP text, answer payload fields or IPv4 literals. Raw log rows and provider metadata were not versioned.

## Exact cleanup and postflight

Cleanup deleted exactly:

- synthetic attempts: `1`;
- captured synthetic guards: `2`.

Independent post-cleanup evidence:

- real attempts: `6 -> 6`;
- all `PROD-GATE4C-*` attempts: `0`;
- all guard rows: `0`;
- all public-table count/digest pairs: unchanged;
- financial/fiscal digest: unchanged;
- public sequence-state digest: unchanged;
- migration-history versions: unchanged.

Invoices, invoice lines, payments, expenses, annual closings, quarterly closings, fiscal numbering and operational sequences received zero writes.

## Repository validation

- Quiz-specific tests: `28/28`.
- Complete suite: `236/236`.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run db:push`: intentionally blocked, exit `1`.
- `npm run supabase:db:push`: intentionally blocked, exit `1`.
- Secret scan: 806 tracked/candidate files, `0` findings.
- Tracked private QA/auth artifacts: `0`.
- `.env` files tracked: templates only (`.env.example`, `.env.qa.example`).

`.vercelignore` excludes local auth, QA, private operational, backup, documentation and Supabase migration material from frontend uploads. It does not alter runtime behavior.

## Rollback

Ignored private rollback artifacts were verified present before the matrix:

- database inverse for the Gate 4C migration;
- Edge Function deletion plan;
- named-secret deletion plan;
- Vercel rollback to the prior deployment.

The database inverse restores the legacy public RPC grant and is security-regressive. It must run only under a separately authorized production incident. Repository rollback is `git revert` of the Gate 4C release commit followed by the normal controlled frontend release process.

## Stop condition

Gate 4C is complete. Gate 5 was not opened or started.
