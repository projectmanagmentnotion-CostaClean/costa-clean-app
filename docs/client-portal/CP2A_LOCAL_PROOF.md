# CP-2A local disposable proof

Command: `npm run qa:client-portal:local-proof`

Result: `PASS` on PostgreSQL 17.10, loopback-only. The runner built a temporary cluster, installed minimal Auth/Storage compatibility stubs, applied the actual source baseline and incrementals in canonical order, bootstrapped exact synthetic staff UUIDs, applied the CP-2A migration, loaded deterministic `QA-CP2-` / `@example.invalid` fixtures, ran the SQL matrix, cleaned up, proved rollback, safely reapplied, cleaned/rolled back again and removed Auth stubs.

Final assertions: portal fixtures `0`, dummy documents `0`, memberships `0`, invitations `0`, service requests `0`, Auth stubs `0`; temporary cluster discarded. The ignored private report is `qa-reports/private/client-portal/cp2a-local-proof-latest.json`.

This is PostgreSQL compatibility and authorization logic evidence, not Supabase Cloud QA evidence. QA and production were not contacted.
