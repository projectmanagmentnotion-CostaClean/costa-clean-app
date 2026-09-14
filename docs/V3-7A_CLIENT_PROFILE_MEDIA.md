# V3-7A — Client profile media foundation

Status: `V3-7A CLOSED / CERTIFIED`

## Certified QA evidence

The V3-7A migration was applied externally to QA only. No SQL was executed by
this closeout, no migration was redeployed, and production was not accessed or
modified.

- QA project: `kpvvydthlxupjjqqdpxy`.
- `clients.profile_image_path`: PASS.
- Private bucket `client-profile-media`: PASS.
- Bucket limit: 5 MB.
- Allowed MIME types: JPEG, PNG and WEBP.
- Internal staff storage policies: PASS.
- Protected `update_client(jsonb)` support: PASS; security definer preserved.
- Authenticated media lifecycle: upload, persistence, signed display, reload,
  replacement, old-object cleanup, removal and fallback restoration: PASS.
- Invalid GIF and files above 5 MB: rejected locally without remote upload.
- Accessibility and focus behavior: PASS.
- V3 iconography: PASS; Unicode-as-icon `0`; emoji-as-icon `0`; inline SVG
  outside `V3Icon` on the changed surface `0`.
- Static responsive safety: PASS. Exact viewport matrix remains deferred to
  V3-8 and is not claimed here.

## Final QA fixture cleanup

The exact project-scoped QA cleanup completed externally after media removal.
The fixture was isolated and created through the real V3 client flow:

- Marker: `QA V3-7A CLIENT MEDIA`.
- Client ID: `CLIENT-DRAFT`.
- Display code: `CLI-0126`.
- Created at: `2026-09-14T13:44:02.77365Z`.
- Profile pointer before guarded deletion: `NULL`.
- Audit events, properties, jobs, quotes, invoices, recurring plans and portal
  relations before deletion: `0`.
- Exact guarded delete result: `1` client deleted.
- Post-cleanup client, marker, audit, related-entity and storage residue: `0`.
- Clients with non-null `profile_image_path`: `0`.

## Data and security contract

The persisted field is `clients.profile_image_path`, and it contains only the
private object path. The bucket is private and named `client-profile-media`.
The path contract is:

`clients/<client-id>/<uuid>.<ext>`

Signed URLs are derived at runtime and cached only in memory. No public URL,
signed URL, base64 value, blob URL, client name, email, phone or tax ID is
persisted in the client row or object path.

The allowed file contract is:

- `image/jpeg`
- `image/png`
- `image/webp`
- maximum 5 MB

## Safe lifecycle contract

Initial upload performs upload, pointer persistence, canonical client refresh and
signed display. If pointer persistence fails, the new object is cleaned up.

Replacement uploads the new object, persists the new pointer, then removes the
old object. The old object is never removed before the new pointer is
authoritative.

Removal persists a `NULL` pointer, refreshes canonical state and then removes
the old object. Storage cleanup errors remain separate from the truthful DB
state.

## UI and privacy contract

- Client list avatar: compact 44px identity treatment.
- Client workspace avatar: 72px identity treatment.
- Fallback: deterministic initials, maximum two characters.
- Actions: `Añadir foto`, `Cambiar foto`, `Eliminar foto`.
- Actions use the V3 media sheet and `V3ConfirmSheet`; no legacy modal and no
  `window.confirm`.
- Camera, replace and trash vectors are owned by `V3Icon`.
- Client creation keeps photo optional; text editing remains separate from the
  media transaction.
- Profile media is internal CRM media only. It is not exposed automatically to
  public quote pages, client portal, invoice PDFs, quote PDFs, emails or
  notifications.

## Production boundary

Production project `wfxnwfcdjainpojhbdri` remains untouched. The migration
`20260914131413_client_profile_media.sql`, the `client-profile-media` bucket,
the production `clients` table and production `update_client` were not changed.
