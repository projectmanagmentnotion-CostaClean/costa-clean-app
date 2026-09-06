# CP3B2A V6 Identity Hash Repair

The V6 identity helper previously passed `git cat-file blob` output through a
text command helper that called `.trim()`. The Git object ID still referred to
the complete blob, while `blobSha256` referred to trimmed text. The manifest
could therefore contain two identities for different byte sequences.

The repair keeps line-oriented Git commands trimmed, but reads blob content as
an exact `Buffer` with no trimming or newline normalization. SQL files were not
corrupt; this change updates identity tooling and the generated manifest only.
No remote effects are involved.

## Notification dispatcher secrets

The local dispatcher expects `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`COSTA_CLEAN_NOTIFICATION_DISPATCH_SECRET`, `COSTA_CLEAN_VAPID_SUBJECT`,
`COSTA_CLEAN_VAPID_PUBLIC_KEY`, and `COSTA_CLEAN_VAPID_PRIVATE_KEY`. The VAPID
private key and service-role key are server-side only. No secret values belong in
Git; real delivery remains blocked until the VAPID secrets are configured.
