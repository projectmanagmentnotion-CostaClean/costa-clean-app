# CP-3B.2 Real Read Contract Audit

Date: 2026-08-04

This note records the locally implemented portal work for the profile and
properties slice.

## Verified implementation points

- Portal reads now flow through `src/portal/portalReadApi.ts`.
- Profile data is rendered as read-only account context with a reviewed-change
  request form.
- Property data is routed through public references, not internal IDs.
- Property cards link to public property routes.
- Reviewed-change forms submit through the portal-specific request adapter and
  return a receipt.
- The portal shell, route resolution, preview shell, and preview adapter were
  updated to keep portal and CRM navigation isolated.

## Safety boundaries preserved

- No remote Supabase schema or policy changes were made in this slice.
- No production or WordPress changes were made.
- No service_role credential is exposed in frontend code.
- Public property references are visible; internal canonical IDs remain hidden
  in the UI.

## Local QA evidence

- `npm.cmd run lint` passed.
- `npm.cmd run test` passed.
- `npm.cmd run build` passed.
- Browser QA was exercised locally across the required mobile, tablet and
  desktop sizes with no horizontal overflow observed in the tested portal
  surfaces.

