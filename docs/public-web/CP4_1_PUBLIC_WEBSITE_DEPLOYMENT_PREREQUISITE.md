# CP-4.1 Public Website Deployment Prerequisite

**Audit date:** 2026-09-14  
**Status:** `PARTIAL_DB_EXPORT_BLOCKED_SITEGROUND_PREVIEW_UPLOAD_BLOCKED`
**Scope:** read-only source, production, DNS and hosting audit. No production or DNS change was made.

## Decision

CP-4.1 is not closed. The current public website, its hosting account and its DNS boundary are identified, the preferred Next.js source is reproducible locally, and an isolated Vercel preview is ready. A private WordPress files export is now held and hashed, but the database export remains blocked by the authenticated phpMyAdmin download path and a new SiteGround preview upload returned a provider error. CP-4.2 remains `NOT_STARTED`.

The exact next block is **CP-4.1A: private WordPress export and isolated preview/deployment proof**. It must be separately authorized before any export download, staging mutation or deployment preparation that can create remote state.

## Verified ownership and runtime map

| Boundary | Evidence | Result |
|---|---|---|
| Public runtime | `https://costacleanbcn.com` responds from nginx and exposes WordPress/Astra/Elementor/WPForms/Complianz markers | Current production is WordPress on SiteGround |
| Hosting account | Authenticated SiteGround account opened in the existing browser session; account lists `costacleanbcn.com` as active | SiteGround account access is available to the owner/operator |
| Site Tools | Site Tools opened for `costacleanbcn.com`; site IP `34.175.186.33`, nameservers `ns1.siteground.net` and `ns2.siteground.net` | Hosting control boundary verified read-only |
| DNS | `costacleanbcn.com` and `www.costacleanbcn.com` resolve to `34.175.186.33`; nameservers are SiteGround | DNS is delegated to SiteGround |
| Registrar | RDAP reports NameCheap, Inc. and `client transfer prohibited` | Registrar is Namecheap; registrar account access was not assumed |
| Email DNS | MX records use `mailspamprotection.com`; SPF is present; no MX/SPF/DKIM/DMARC changes were made | Email boundary preserved |

The SiteGround account showed 9 active websites and 9 domains. This proves account visibility, not that the account is the legal owner of the domain or that a future Next.js deployment is already configured.

## Backup and recovery evidence

SiteGround Site Tools > Copias de seguridad was inspected for `costacleanbcn.com` in read-only mode:

- Automated system backups were listed daily from 25/08/2026 through 13/09/2026.
- SiteGround states that daily automated backups are retained for up to 30 days, depending on plan.
- The UI reported `Backups manuales disponibles 5`.
- The available recovery actions were visible for the latest backup: restore all files and databases, restore files, restore databases, restore emails, and download.
- No backup was created, downloaded, restored or deleted.

This is provider capability evidence only. No private backup artifact, checksum, retention location, encryption record or restoration rehearsal is yet held by the project. Therefore backup recoverability is not accepted as a CP-4.1 closeout criterion.

## Source repository audit

Preferred source repository:

- Repository: `projectmanagmentnotion-CostaClean/costa-clean-web`
- Local clone: `C:\Users\USUARIO\costa-clean-web`
- Remote: `https://github.com/projectmanagmentnotion-CostaClean/costa-clean-web.git`
- Branch: `main`
- Audited commit: `ac2b6736f020577ba08780a7c792fbfa4e0a3140`
- Remote `HEAD`: matched the audited commit.

The source is a Next.js 16.3.4 App Router application with TypeScript and no checked-in Vercel, Docker or CI deployment configuration. It has no production credentials or Supabase client boundary. The source repository had a pre-existing untracked `qa-reports/` directory; it was preserved and not committed or deleted.

Source verification completed without source edits:

| Check | Result |
|---|---|
| `npm test` | PASS, 12 passed |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS, static generation completed |

The source is therefore a reproducible candidate, not yet a verified production deployment artifact.

## Production read-only audit

### Runtime and content

Production is a WordPress installation using Astra, Elementor, WPForms and Complianz. The public home page was inspected through the integrated browser. It includes the Costa Clean branding, service claims, phone link, WhatsApp calls-to-action, lead form, cookie banner and legal links.

Important production observations:

- Home, `/nosotros/`, `/residencial/`, `/comercial/`, `/contacto/` and legal pages responded successfully.
- `/servicios/`, `/presupuesto/`, `/zonas/`, `/guias/` and `/casos-de-exito/` returned 404 in the read-only route sample.
- `/sitemap.xml` redirected to the WordPress sitemap index.
- The source application has corresponding new routes for services, quote, zones, guides and case studies, so explicit migration/redirect decisions are required.
- Production legal pages are not yet represented as equivalent source routes; content must be preserved and reviewed before any future migration.
- Production WordPress media and review/social-proof claims need an export, asset map and verification decision. The source intentionally uses only authorized/local assets and avoids unverified claims.
- Home WhatsApp calls-to-action contained the canonical number, but the footer contained an incomplete `api.whatsapp.com/send?phone=` link. This is a production finding for a later authorized implementation block, not fixed here.

### Headers and tracking

- `www` redirected to the apex with `X-Redirect-By: WordPress`.
- `X-Cache-Enabled: True` was observed.
- `X-Content-Type-Options: nosniff` and Permissions-Policy were present.
- HSTS, CSP, X-Frame-Options and Referrer-Policy were not observed in the sampled HEAD response.
- Complianz consent UI was present.
- No GTM ID, GA4 property, Meta pixel, Clarity, Hotjar or Matomo marker was found in the sampled production HTML.
- A Complianz `gtag` marker was present with an empty configuration ID; no production tracking activation was made.

### Content and route comparison

| Surface | Production | Next.js source | Required future decision |
|---|---|---|---|
| Home | Legacy WordPress home, service claims and forms | New App Router home | Preserve verified facts; approve content migration |
| Services | `/residencial/`, `/comercial/` | `/servicios` and service slugs | Define redirects and canonical URLs |
| Contact | WordPress page/form | `/contacto` and `/api/quote` preview contract | Preserve form ownership and define intake integration |
| Quote | `/presupuesto/` returned 404 | `/presupuesto` exists | Decide launch route and non-production form behavior |
| Zones/guides/cases | Sampled routes returned 404 | Source routes exist | Confirm whether these are new pages or migration targets |
| Legal | WordPress legal pages respond | No equivalent complete source set found | Preserve, review and version before CP-4.2 |

## Deployment and rollback readiness

| Criterion | Status | Exact gap |
|---|---|---|
| Versioned source | `PASS` | Next.js repo and audited commit are identified |
| Current runtime identified | `PASS` | WordPress/Astra/Elementor/WPForms/Complianz on SiteGround |
| Hosting access | `PASS` | Authenticated SiteGround account and Site Tools were inspected |
| Private full export | `NOT_READY` | No versioned WordPress files/database export and checksum |
| Backup custody | `NOT_READY` | No approved private destination, retention or encryption record |
| Isolated staging/preview | `PASS_PREVIEW` | Vercel preview has no environment variables, production domain or WordPress/CRM connection |
| Next.js deployment path | `PASS_PREVIEW_ONLY` | Owned Vercel project and explicit preview deployment are verified; production promotion remains unauthorized |
| Rollback procedure | `PARTIAL` | Runbook is documented and provider controls are visible, but private artifact rehearsal is blocked |
| Production visual certification | `PASS_390_768_1440` | Read-only baseline completed at all required viewports |
| Public production runtime changes | `PASS` | Zero DNS, WordPress, tracking, domain or content changes |

## Security and non-goals

- No SiteGround password, session token or private credential was copied into the repository or reports.
- No DNS record, MX, SPF, DKIM or DMARC record was modified.
- No WordPress page, plugin, theme, form, cookie setting or cache was modified.
- No public production-domain deployment, backup creation/download/restore or migration was executed. One Vercel deployment with `target=production` was created accidentally by the initial CLI invocation; it has no Costa Clean production domain and is documented as an open review item.
- No Supabase, CRM, portal, OAuth, email provider or advertising configuration was changed.

## Acceptance decision

CP-4.1 remains:

`PARTIAL_PRIVATE_EXPORT_UNAVAILABLE_AND_VERCEL_PRODUCTION_TARGETS_REVIEW_PENDING`

The block can close only after a separately authorized CP-4.1A remediation proves:

1. a private, hashed and recoverable WordPress files/database export;
2. documented backup custody and retention;
3. resolution of the Vercel production-target review item;
4. an exact rollback procedure with non-destructive evidence; and
5. the required production-versus-preview visual baseline reconciled against the approved migration content.

Until those conditions pass, CP-4.2 is `NOT_STARTED` and no public website redesign or production migration should begin.

## CP-4.1A - Private Export and Isolated Preview Proof

**Execution date:** 2026-09-14
**Authorization:** CP-4.1A owner authorization in the task prompt.
**Result:** `PARTIAL_PRIVATE_EXPORT_UNAVAILABLE_AND_VERCEL_PRODUCTION_TARGETS_REVIEW_PENDING`

### Repository precheck

| Repository | Branch | Commit | Worktree |
|---|---|---|---|
| `costa-clean-app` | `codex/ux-operational-mobile-v2` | `97fdb60ed39182d439057392354d3293adc69928` | clean after governance commit |
| `costa-clean-web` | `main` | `f1dcaf2` | clean except preserved pre-existing `qa-reports/` |

The web repository remote remains `https://github.com/projectmanagmentnotion-CostaClean/costa-clean-web.git`. The Vercel project was linked to this repository. `.vercel/`, `.auth/`, `qa-reports/` and test output are excluded from deployment or Git as appropriate; the existing `qa-reports/` directory was not deleted or committed.

### Private export result

| Criterion | Result | Evidence |
|---|---|---|
| Private export artifact | `BLOCKED` | SiteGround `Descargar` opened a Premium Backups offer; no download started |
| Artifact count | `0` | No file was downloaded |
| SHA-256 | `NOT_AVAILABLE` | No artifact exists to hash |
| Integrity | `NOT_EXECUTED` | No archive/database artifact exists to test |
| Private custody | `NOT_READY` | `.auth/cp4/backups/` is ignored, but contains no export |
| Export in Git | `PASS` | `0`; no backup or customer data was staged or committed |
| Production restore | `0` | No restore action was clicked |

Existing SiteGround system backups remain visible, including daily entries from 25/08/2026 through 13/09/2026, and the UI reports 5 manual backups available. The provider offered restore actions, but downloadable custody is not available on the current plan without Premium Backups. No purchase or plan change was made.

### WordPress role

`WORDPRESS_ROLE = ROLLBACK_AND_MIGRATION_SOURCE_ONLY`

WordPress remains the current production runtime and a migration/rollback source. It is not the future canonical source; the preferred canonical source remains `costa-clean-web`.

### Isolated Next.js preview

| Field | Evidence |
|---|---|
| Provider | Vercel, Hobby team `projectmanagmentnotion-costaclean` |
| Project | `costa-clean-web` |
| Project ID | `prj_pOwhnuDamDWa0DnDoLfa3r0ZYOvN` |
| Deployment ID | `dpl_6VBmKmnn1othArph1babKHfVmvh2` |
| Preview URL | `https://costa-clean-dwtphhebs.vercel.app` |
| Source commit | `f1dcaf2` |
| Deployment command | `vercel deploy --target preview --yes --format json` |
| Ready state | `READY` |
| Environment variables | none configured in the Vercel project |
| Production domain attached | `NO`; no `costacleanbcn.com` or `www.costacleanbcn.com` association found |
| WordPress DB/customer data | none connected |
| Supabase service role | not present in source or preview environment |
| Real leads | `0`; no POST/form submission was sent |

The preview is protected by Vercel deployment protection. With the authenticated CLI bypass, all smoke routes returned HTML successfully: `/`, `/servicios`, `/contacto`, `/presupuesto`, `/zonas`, `/guias`, `/casos-de-exito` and a not-found route. The home HTML contains the canonical WhatsApp link and noindex metadata. `/robots.txt` returns `User-agent: *` and `Disallow: /`. The preview source contains no production tracking IDs or private secrets.

### Vercel target incident

The first unqualified `vercel --yes` invocation created `dpl_5A4mQ5XB21zyCv99d2vWBwBNHNJP` with Vercel `target=production`. It has no `costacleanbcn.com` or `www.costacleanbcn.com` alias and did not change SiteGround, DNS or the public production runtime. It was not promoted or connected to the production domain. After the web commit was pushed to `main`, the connected GitHub integration also created `dpl_D8S8abHTQ3g2AruoEksooHzAkxGF` with `target=production` and `readyState=BLOCKED`, with no Costa Clean domain alias. This proves the current `main` integration can create production-target deployments automatically. Both are explicit review items because the CP-4.1A gate requires zero unauthorized production-target deployments. The canonical preview remains `dpl_6VBmKmnn1othArph1babKHfVmvh2`.

### Production visual baseline

Read-only Playwright checks against `https://costacleanbcn.com/` completed at the exact required viewports:

| Viewport | HTTP | Overflow X | Header | Primary CTA | WhatsApp | Footer | Cookie banner |
|---|---:|---:|---|---|---|---|---|
| `390x844` | 200 | false | present | present | present | present | present |
| `768x1024` | 200 | false | present | present | present | present | present |
| `1440x900` | 200 | false | present | present | present | present | present |

Screenshots were kept only in ignored local `test-results/cp4-1a-production/`; none are in Git.

### Deployment, DNS and email safety

The repeatable non-production path is:

`GitHub main at f1dcaf2 -> Vercel preview target -> noindex/protection -> QA -> owner approval`

Production promotion and domain cutover are not authorized by this block and were not executed. Future DNS planning is deliberately unresolved until the Vercel domain is separately verified:

| Record | Current | Future plan | Rollback |
|---|---|---|---|
| Apex A | `34.175.186.33` | Use provider-assigned verified Vercel apex value only after approval | restore `34.175.186.33` |
| `www` A | `34.175.186.33` | Use provider-assigned verified Vercel alias/value only after approval | restore `34.175.186.33` |
| Nameservers | `ns1.siteground.net`, `ns2.siteground.net` | keep SiteGround delegation unless separately approved | keep current values |
| HTTPS | SiteGround certificate/redirect | provision and validate on the approved target | validate SiteGround HTTPS |

TTL reduction, apex/www redirect behavior and certificate provisioning must be planned immediately before any future authorized cutover. No DNS record was changed.

`EMAIL DNS CHANGE REQUIRED FOR WEB MIGRATION = NO` based on the current architecture. MX, SPF, DKIM and DMARC remain frozen.

### Rollback and security

- Rollback reference is documented in [`CP4_1_ROLLBACK_RUNBOOK.md`](./CP4_1_ROLLBACK_RUNBOOK.md).
- Provider restore actions and old endpoint availability were verified non-destructively.
- `ROLLBACK_REHEARSAL = NOT_READY_PRIVATE_EXPORT_MISSING`.
- Source secret scan across `src/`, `public/`, `next.config.ts`, `package.json` and `.env.example` returned no credential-pattern matches.
- No private key, service role, production credential, customer database or real email destination is configured in the preview.
- Preview browser protection and `noindex, nofollow` were verified through the authenticated CLI response.

### CP-4.1A acceptance matrix

The following matrix is the historical CP-4.1A snapshot from before CP-4.1B. The current CP-4.1B result is recorded below and supersedes its open-export labels.

| Criterion | Result |
|---|---|
| Private export | `FAIL_PLAN_DOWNLOAD_UNAVAILABLE` |
| Hash and integrity | `NOT_EXECUTED_NO_ARTIFACT` |
| Private custody | `NOT_READY_NO_ARTIFACT` |
| Isolated Next.js preview | `PASS` |
| Preview noindex | `PASS` |
| Deployment path | `PASS_PREVIEW_ONLY`; production-target incident remains open |
| Rollback runbook | `PASS_DOCUMENTED` |
| Non-destructive rehearsal | `NOT_READY_PRIVATE_EXPORT_MISSING` |
| Production visual baseline | `PASS_390_768_1440` |
| Public production runtime changes | `0` |
| DNS/email changes | `0` |

`CP-4.1 = PARTIAL_PRIVATE_EXPORT_UNAVAILABLE_AND_VERCEL_PRODUCTION_TARGETS_REVIEW_PENDING`

`CP-4.2 = NOT_STARTED`

The next action is to obtain an approved private database export/download capability from SiteGround and, if required, retry the isolated SiteGround preview upload. Do not promote the preview, connect the production domain or begin CP-4.2.

## CP-4.1B - SiteGround target proof, private export and Vercel containment

**Audit date:** 2026-09-14
**Authorization:** CP-4.1B task authorization.
**Result:** `PARTIAL_DB_EXPORT_BLOCKED_SITEGROUND_PREVIEW_UPLOAD_BLOCKED`

### Private WordPress file export

- Production target was `costacleanbcn.com` in SiteGround Site Tools; no WordPress content, DNS record, cache, email setting or restore action was changed.
- A temporary archive was created outside `public_html`, downloaded, and then removed from the production file manager: `cp4-1b-wordpress-files-20260914.zip`.
- The downloaded artifact is held only in ignored local custody at `.auth/cp4/backups/`; it is not tracked, committed or pushed.
- Size: `226739508` bytes.
- SHA-256: `4F5036EEE2A5EC770B45C77984E5C0F55FBB4F07E8E3E01E8BB208AC2D2EB81E`.
- Structural verification passed with `32294` entries and the expected `public_html/`, `public_html/wp-content/` and `public_html/wp-config.php` paths.

`PRIVATE_WORDPRESS_FILES_EXPORT = PASS`
`PRIVATE_CUSTODY = PASS`
`TEMP_PRODUCTION_ARCHIVE_REMOVED = PASS`

### Database export limitation

The authenticated phpMyAdmin session reached database `dbianszo0zelq1` and exposed the SQL export form for the 58-table, 45.7 MB production database. The export POST endpoint `route=/export` was blocked by the Codex in-app browser with `ERR_BLOCKED_BY_CLIENT`; the normal Chrome phpMyAdmin tab was unauthenticated and showed `Please login through your SiteTools`. No SQL file was produced, no rows were changed and no admin SQL context was used as a substitute.

`PRIVATE_WORDPRESS_DATABASE_EXPORT = NOT_EXECUTED_AUTHENTICATED_DOWNLOAD_BLOCKED`
`DATABASE_HASH = NOT_AVAILABLE`
`ROLLBACK_REHEARSAL = NOT_READY_DATABASE_EXPORT_MISSING`

### SiteGround hosting proof

The authenticated SiteGround account is on `GrowBig` and reports up to five Node.js projects. A Next.js preview was previously deployed from a manual archive at `vilmatibisayg.sg-host.com` with Node `22.23.2` and npm `10.9.8`; it was intentionally removed after the source asset fix so the final evidence would not point at stale remote WordPress media. A new upload of the corrected package returned the provider message `Error. Por favor, inténtalo más tarde o contacta con soporte.` and did not create a project. No production domain was attached or altered.

The corrected web source remains reproducible and pushed at `costa-clean-web` commit `4a72d93`, with the official logo served locally from `/media/costa-clean-logo.svg`. A fresh Vercel preview was created only as a fallback preview proof: `dpl_82ggYVFNQd3YwDtq4AfifycLyypy`, `https://costa-clean-cskbwyncm.vercel.app`, `READY`, target `preview`. Its protected response was checked through `vercel curl`: local logo asset present and `noindex, nofollow` present.

`SITEGROUND_NEXT_PREVIEW = NOT_EXECUTED_PROVIDER_UPLOAD_ERROR`
`VERCEL_PREVIEW = PASS_PREVIEW_ONLY`

### Vercel containment and unrelated-project audit

Project `costa-clean-web` is connected to GitHub, but its Vercel Ignored Build Step is now persisted as `Only build pre-production`, with command `if [ "$VERCEL_ENV" == "preview" ]; then exit 1; else exit 0; fi`. This prevents production builds from the connected Git flow while preserving preview builds. No custom production domain is attached and production requests remain `0`.

Existing target-production deployments `dpl_5A4mQ5XB21zyCv99d2vWBwBNHNJP` and `dpl_D8S8abHTQ3g2AruoEksooHzAkxGF` remain historical, unaliased and not promoted. The non-Costa-Clean projects `_coachx_sync_1`, `coachx` and `ridaos` each have recent ready production deployments, so none met the conclusive-unused threshold and none was deleted.

### CP-4.1B acceptance matrix

| Criterion | Result |
|---|---|
| WordPress files export | `PASS` |
| Private custody and SHA-256 | `PASS` |
| Archive structural integrity | `PASS_32294_ENTRIES` |
| WordPress database export | `NOT_EXECUTED_AUTHENTICATED_DOWNLOAD_BLOCKED` |
| Complete files plus database rollback package | `NOT_READY` |
| SiteGround Next.js preview | `NOT_EXECUTED_PROVIDER_UPLOAD_ERROR` |
| Vercel preview-only deployment | `PASS` |
| Vercel production-build containment | `PASS_ONLY_BUILD_PRE_PRODUCTION` |
| Unrelated Vercel deletion | `NONE_CONCLUSIVE_UNUSED` |
| Production WordPress/DNS/email changes | `0` |
| CP-4.2 | `NOT_STARTED` |

`CP-4.1 = PARTIAL_DB_EXPORT_BLOCKED_SITEGROUND_PREVIEW_UPLOAD_BLOCKED`
