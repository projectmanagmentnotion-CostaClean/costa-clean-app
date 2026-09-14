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

The current SiteGround backup UI, DNS values, old public endpoint and provider restore actions were verified without executing restore or DNS changes. A complete rehearsal is still `NOT_READY` because the private export artifact and checksum are unavailable on the current backup plan.

