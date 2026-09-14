# CP-4.1 Public Website Rollback Runbook

**Status:** reference-only; no production rollback was executed.  
**Current production:** WordPress on SiteGround.  
**Current apex/www address:** `34.175.186.33`.  
**Current nameservers:** `ns1.siteground.net`, `ns2.siteground.net`.

## Pre-cutover requirements

1. Freeze the exact approved Next.js commit and preview deployment ID.
2. Obtain and hash a private WordPress files/database export. Do not proceed without it.
3. Record current DNS values and TTLs immediately before any future cutover.
4. Confirm email DNS records remain unchanged: MX, SPF, DKIM and DMARC.
5. Capture production and preview smoke evidence, including legal pages, forms and WhatsApp.

## Current production reference

- Runtime: WordPress/Astra/Elementor/WPForms/Complianz on SiteGround.
- SiteGround Site Tools: `costacleanbcn.com`.
- Apex and `www` currently resolve to `34.175.186.33`.
- `www` currently redirects to the apex over HTTPS.
- SiteGround restore controls are available for files, databases, emails and full site, but no restore was clicked.

## Future cutover rollback

1. Stop the new deployment or disable the new public route according to the approved provider procedure.
2. Restore the apex record to the recorded pre-cutover value, currently `34.175.186.33`.
3. Restore the `www` record to the recorded pre-cutover value, currently `34.175.186.33`, and preserve the apex redirect behavior.
4. Do not alter nameservers or email DNS unless a separate exact authorization exists.
5. In SiteGround, select the approved private backup and restore the required WordPress files/database only after confirming the target and backup identity. Never use a guessed backup.
6. Purge only the relevant web cache after restoration; do not change unrelated services.
7. Validate HTTPS, apex/www redirect, home, services, contact, legal pages, cookie controls, forms and WhatsApp.
8. Confirm no production CRM, Supabase, advertising or email side effect was introduced.

## Non-destructive rehearsal result

The current SiteGround backup UI, DNS values, old public endpoint and provider restore actions were verified without executing restore or DNS changes. A private files archive and private database dump are now held outside Git and hashed; no restore was executed, so a complete rehearsal remains `NOT_EXECUTED` until a separately authorized non-production restore target exists.

## CP-4.1B evidence update - 2026-09-14

- Files artifact: `.auth/cp4/backups/cp4-1b-wordpress-files-20260914.zip` (ignored custody only).
- Files SHA-256: `4F5036EEE2A5EC770B45C77984E5C0F55FBB4F07E8E3E01E8BB208AC2D2EB81E`.
- Files integrity: `PASS`; `32294` archive entries and expected WordPress paths verified.
- Temporary production archive: created outside `public_html`, downloaded, then removed: `PASS`.
- Database export: `NOT_EXECUTED_AUTHENTICATED_DOWNLOAD_BLOCKED`; phpMyAdmin's `/export` POST was blocked with `ERR_BLOCKED_BY_CLIENT`, and the normal Chrome tab had no SiteTools-authenticated session.
- Restore rehearsal: no restore or DNS operation was executed. The missing database artifact blocker is resolved; rehearsal remains `NOT_EXECUTED` pending a non-production restore target.

The private files and database artifacts are not authorization for a production restore or public cutover. The next operator must use a non-production target for any separately authorized restore rehearsal and preserve the recorded DNS/email values before future production change.

## CP-4.1C evidence update - 2026-09-14

- Database artifact: `.auth/cp4/backups/cp4-1c-wordpress-db-20260914.sql` (ignored custody only).
- Database size: `36837793` bytes.
- Database SHA-256: `971D7DF2B1D5E1B69FD6E5698404403A605F78FF282009688F07293C2E7C6DF8`.
- Database structural integrity: `PASS`; `58` table definitions, `63` insert blocks, `58` unlock markers and a final dump marker were verified without printing SQL data.
- Remote SQL temporary file: created outside `public_html`, transferred, then removed: `PASS`.
- Temporary SSH key: created for this export, removed from SiteGround, and deleted locally: `PASS`.
- Native SiteGround preview: `BLOCKED_GITHUB_IMPORT_CONTINUE_DISABLED`; no project was created and no production domain was attached.
- Restore rehearsal: `NOT_EXECUTED`; no production restore or DNS operation was performed.
