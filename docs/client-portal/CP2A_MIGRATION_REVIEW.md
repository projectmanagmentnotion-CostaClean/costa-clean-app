# CP-2A migration review

Migration: `supabase/migrations/20260723160000_client_portal_security_boundary.sql`

The single 14-digit migration is transactional (`BEGIN`/`COMMIT`) and `ON_ERROR_STOP` compatible. It requires an explicit temporary `cp2a_bootstrap_staff` table populated with exact pre-existing Auth UUIDs; it fails closed if the bootstrap is absent or invalid. It never derives staff or client membership from email or editable Auth metadata.

It creates the private helper schema, staff and portal entities, constraints/indexes, fixed-search-path helpers, narrow read/trusted RPCs, default privilege revocations, RLS plus `FORCE RLS`, exact grants and the private Storage boundary. Existing canonical policies and operational/financial guards are replaced with active-staff checks. Legacy RPC grants remain usable only by active staff because their guards are hardened; portal identities fail.

Review exclusions: no real row mutation, `invoice_number` assignment, `display_code` assignment, amount mutation, sequence operation, payment/closing write, migration-history write or indiscriminate drop. References to invoice numbers/display codes occur only in allowlisted read projections.

Frozen SHA-256 is recorded in `CP2B_EXACT_QA_AUTHORIZATION.md`. Any byte change invalidates the proof and requires re-review, local proof, full tests and new hashes.
