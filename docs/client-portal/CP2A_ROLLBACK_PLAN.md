# CP-2A rollback plan

Authoritative script: `scripts/client-portal/cp2a_rollback.sql`.

Rollback is disable-first and two-phase:

1. revoke portal endpoints, suspend portal memberships and revoke invitations, then commit;
2. restore legacy broad authenticated behavior only when an explicit `app.cp2a.allow_legacy_restore=true` flag is present and every portal record is proven absent.

If safe restoration cannot be demonstrated, the script stops with portal access disabled for incident handling. It never reopens anonymous access and does not touch invoice/payment/closing rows, numbering or fiscal sequences. Exact synthetic cleanup is separate in `cp2a_cleanup.sql`, guarded for local/QA use and production rejection.

The local proof ran rollback, verified removal/restoration, reapplied safely and ran rollback again. No remote rollback was executed.
