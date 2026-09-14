# V3-7A — Client profile media foundation

Status: `OPEN — QA MEDIA INFRASTRUCTURE AUTHORIZATION REQUIRED`

## Audit result

- Existing persisted client media contract: absent.
- `public.clients` has no profile media pointer in the repository baseline.
- `update_client(jsonb)` rejected `profile_image_path`; the local migration extends
  that existing authenticated RPC instead of adding a direct table-write path.
- Existing private storage conventions are defined by the expense receipt bucket:
  internal staff policies, signed URLs, and exact object paths.
- No generated Supabase database types are present in this repository.

## Local implementation

The frontend foundation is implemented but remains backward-compatible until the
remote contract is authorized:

- `ClientListItem.profile_image_path` is optional and the client list first tries
  the canonical column, then falls back to the current select if the column is
  not yet present.
- `src/features/clients/clientProfileMedia.ts` validates JPEG, PNG and WEBP up
  to 5 MB, creates `clients/<client-id>/<uuid>.<ext>` paths, uses private
  signed URLs with a memory-only cache, and models upload, replacement and
  removal ordering.
- A pointer failure after upload is cleaned up; replacement deletes
  the old object only after the new pointer is authoritative; removal clears
  the pointer before storage cleanup and reports cleanup failure without reverting
  the truthful DB state.
- V3 client list rows use compact initials/photo avatars. The client workspace
  uses a native V3 media action sheet and V3 confirmation sheet. Client creation
  and the text edit flow remain unchanged.
- `V3Icon` now owns the camera, replace and trash vectors used by this surface.

## Proposed QA migration — not applied

File: `supabase/migrations/20260914131413_client_profile_media.sql`

- Add nullable `public.clients.profile_image_path text`.
- Create private bucket `client-profile-media` with a 5 MB limit and MIME types
  `image/jpeg`, `image/png`, `image/webp`.
- Add authenticated internal-staff select/insert/update/delete policies limited
  to `clients/%` paths and UUID image objects.
- Extend the existing protected `public.update_client(jsonb)` contract to accept
  only the new pointer field, validate the client-scoped path, and return the
  canonical client row.

The migration is a local review artifact only. It has not been applied to QA or
production, and no QA bucket, row, object or policy was changed.

## Rollback / reversibility

Before application, review the migration in the normal Supabase change gate.
If the migration must be rolled back after a controlled deployment, first stop
the V3 media UI, remove or null all authorized `profile_image_path` values, and
remove exact `clients/<client-id>/...` objects. Then, in a separately reviewed
SQL change, drop the four named storage policies, delete the empty
`client-profile-media` bucket, restore the previous `update_client(jsonb)` body,
and `alter table public.clients drop column profile_image_path`. Never execute
this rollback against production from this slice.

## Remaining gate

Remote QA media E2E is not run because the new column, RPC contract, bucket and
storage policies require explicit authorization. The required future fixture
marker is `QA V3-7A CLIENT MEDIA`; it must track exact client and object paths
and finish with DB pointer `null` and storage residue `0`.
