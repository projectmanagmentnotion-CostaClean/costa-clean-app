# CP-2B exact QA authorization package

Status: `NOT AUTHORIZED / NOT EXECUTED`.

QA project ref: `kpvvydthlxupjjqqdpxy`. Production ref `wfxnwfcdjainpojhbdri` is prohibited. Production proof: `NO`.

## Frozen hashes

| Artifact | SHA-256 |
|---|---|
| `supabase/migrations/20260723160000_client_portal_security_boundary.sql` | `ea10b4b3db30f6b27f60cd8fff6c8a7c711636e1d6ac439337966f5736cc6277` |
| `supabase/functions/_shared/portalContract.ts` | `3a474271ebe265ae53486c40407752370e7d7d4908dae975643ce0ef7548f271` |
| `supabase/functions/_shared/portalHandler.ts` | `5309116b26eec92044a3d86e7bab04f90ee82e6dd7729765e551f5b8c295f8c3` |
| `supabase/functions/portal-account-actions/index.ts` | `2c42f3ba84beb5ab766d38416fd969bc6a8e968ed39d3f758288148541cfffd9` |
| `supabase/functions/portal-service-actions/index.ts` | `6268365b2ffb3cfadde23c5fd52b2bf6e4fec9cf3e32053c3d649e0777b81024` |
| `supabase/functions/portal-member-actions/index.ts` | `d99f64e43787af5df56dafa736b2410621ced457163c4abacc18f2c737b40f3c` |
| `supabase/functions/portal-invoice-download/index.ts` | `aee337003adc848697febf2efc414996862b62ff46220e9214ad28478914ac43` |
| `scripts/client-portal/run-cp2a-local-proof.mjs` | `2d98909b9d55ada13bf036494ad18f7266bcca53f3c0f099d4a1019c97d1c891` |
| `scripts/client-portal/run-cp2b-qa.mjs` | `c0fd0806b8c7eb3fe47d732071435d4b0da2758a7659d7afaa861d6573ed1a66` |
| `scripts/client-portal/cp2a_rollback.sql` | `dfdc64a272bde2b8ddfcbab54f58ff4908f170057b4d110f77c27558b5826dee` |
| `scripts/client-portal/cp2a_fixtures.sql` | `acaf020adda30cb0f22a90195ccbf95a95017b2061a096df286fdbd8ddee504e` |
| `scripts/client-portal/cp2a_authorization_matrix.sql` | `f4734b4a91461dff7b97c68a0571c208193d4f362c7f7f1ed709baf893756845` |
| `scripts/client-portal/cp2a_cleanup.sql` | `9cbbc8c71274fdeccd4804e06e4f7fa365b177be406340689bdab5f6deab446e` |
| `scripts/client-portal/cp2b_catalog_snapshot.sql` | `ba470d3e113536d39a24cca5a42c227f8f16bf38134abcbdf1b750af51e8fce6` |
| `scripts/client-portal/cp2b_apply.sql` | `1b04a35d0e7a2a703ac36b86510d005044464236049dcf596590205dd6c914b5` |
| Storage SQL/config | migration hash above |
| `supabase/config.toml` | `839c8ce0493969c851586b9768dbbfb12adf29566ad13283911b8fa58211bbd7` |

## Secrets by name only

`CP2B_QA_DATABASE_URL`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORTAL_INVITATION_PEPPER`, `PORTAL_RATE_LIMIT_PEPPER`, `PORTAL_ALLOWED_ORIGIN`. Exact active/suspended staff Auth UUIDs are private runtime inputs, not repository fixtures.

## Future commands, inert until a new explicit authorization

```text
npm run qa:client-portal:cp2b-plan
pg_dump "$CP2B_QA_DATABASE_URL" --schema-only --no-owner --no-privileges --file "<private-backup-path>"
psql "$CP2B_QA_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/client-portal/cp2b_catalog_snapshot.sql > "<private-catalog-path>"
psql "$CP2B_QA_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v project_ref=kpvvydthlxupjjqqdpxy -v active_staff_user_id="<private-uuid>" -v suspended_staff_user_id="<private-uuid>" -f scripts/client-portal/cp2b_apply.sql
supabase functions deploy portal-account-actions --project-ref kpvvydthlxupjjqqdpxy --no-verify-jwt
supabase functions deploy portal-service-actions --project-ref kpvvydthlxupjjqqdpxy --no-verify-jwt
supabase functions deploy portal-member-actions --project-ref kpvvydthlxupjjqqdpxy --no-verify-jwt
supabase functions deploy portal-invoice-download --project-ref kpvvydthlxupjjqqdpxy --no-verify-jwt
```

Expected mutations, only in a later CP-2B: the reviewed schema/RLS/grants/functions, private bucket row, exact staff membership rows, synthetic fixtures and four QA Edge deployments. Expected cleanup: delete exact `QA-CP2-` fixtures and dummy object, prove zero synthetic portal/Auth residue, retain reviewed schema only if the gate passes; otherwise disable-first rollback.

Stop on any hash/catalog/target mismatch, production reference, missing private backup, missing exact staff UUID, nonzero unexpected rows, sequence/financial drift, failing isolation, secret/PII evidence, cleanup uncertainty or rollback uncertainty. This file does not authorize those commands.
