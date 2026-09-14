# CP-4.1 Public Website Deployment Prerequisite

**Audit date:** 2026-09-14  
**Status:** `PARTIAL_HOSTING_ACCESS_VERIFIED_EXPORT_AND_STAGING_PENDING`  
**Scope:** read-only source, production, DNS and hosting audit. No production or DNS change was made.

## Decision

CP-4.1 is not closed. The current public website, its hosting account and its DNS boundary are now identified, and the preferred Next.js source is reproducible locally. The required recoverable export, isolated preview/staging identity, deployment procedure and rollback rehearsal are not yet established. CP-4.2 remains `NOT_STARTED`.

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
| Isolated staging/preview | `NOT_READY` | No staging identity or proof that it is isolated from production data |
| Next.js deployment path | `NOT_READY` | No owned Vercel/SiteGround target, project link or CI procedure verified |
| Rollback procedure | `NOT_READY` | Provider restore actions are available, but no exact artifact/runbook rehearsal exists |
| Production visual certification | `PARTIAL` | Home was inspected read-only; exact 390x844, 768x1024 and 1440x900 production certification was not completed in this audit |
| Production changes | `PASS` | Zero DNS, WordPress, tracking, deployment and content changes |

## Security and non-goals

- No SiteGround password, session token or private credential was copied into the repository or reports.
- No DNS record, MX, SPF, DKIM or DMARC record was modified.
- No WordPress page, plugin, theme, form, cookie setting or cache was modified.
- No production deployment, preview deployment, backup creation/download/restore or migration was executed.
- No Supabase, CRM, portal, OAuth, email provider or advertising configuration was changed.

## Acceptance decision

CP-4.1 remains:

`PARTIAL_HOSTING_ACCESS_VERIFIED_EXPORT_AND_STAGING_PENDING`

The block can close only after a separately authorized CP-4.1A proves:

1. a private, hashed and recoverable WordPress files/database export;
2. documented backup custody and retention;
3. an isolated preview/staging identity with no production database or customer data exposure;
4. an owned deployment path for the selected source artifact;
5. an exact rollback procedure with non-destructive evidence; and
6. the required production-versus-preview visual baseline.

Until those conditions pass, CP-4.2 is `NOT_STARTED` and no public website redesign or production migration should begin.

