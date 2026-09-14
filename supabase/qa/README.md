# V3-6R CRM QA-only cleanup

`qa_cleanup_v3_6r_crm_fixture.sql` is a QA-only contract. It deliberately
lives outside `supabase/migrations/` so it is not eligible for production
migration or deployment by the normal migration path.

Apply it only to Supabase project `kpvvydthlxupjjqqdpxy` through the reviewed
QA procedure. Never apply it to `wfxnwfcdjainpojhbdri`. The function accepts
only exact IDs from the current certification manifest and aborts the whole
transaction when a marker or relationship safety check fails.
