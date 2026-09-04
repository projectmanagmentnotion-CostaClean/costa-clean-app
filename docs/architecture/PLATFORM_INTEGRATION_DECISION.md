# Platform Integration Decision

Decision date: 2026-09-04

## Evidence

- The internal CRM and client portal already live in `costa-clean-app` and pass the current repository baseline.
- The public website is an existing WordPress/SiteGround installation, not a discovered `costa-clean-web` repository.
- Portal security contracts, RLS-oriented migrations, Edge Functions, and private-document rules are already coupled to the current Supabase/CRM application.
- A one-bundle Next.js rewrite would require a framework migration and would increase blast radius without solving the existing WordPress/public-web reality.

## Options

| Criterion | A: one Next.js app | B: monorepo web/portal/admin | C: separated surfaces/contracts |
|---|---:|---:|---:|
| Security isolation | 3 | 4 | 5 |
| SEO/public flexibility | 4 | 5 | 5 |
| Migration risk | 2 | 3 | 5 |
| Reuse of current portal | 2 | 4 | 5 |
| Auth/Supabase boundary | 3 | 4 | 5 |
| Independent rollback | 2 | 4 | 5 |
| Testing blast radius | 2 | 3 | 5 |
| Operational cost now | 3 | 3 | 4 |
| Total | 21 | 30 | 39 |

## Selected architecture: C

Keep the public marketing surface separate from the authenticated CRM/portal runtime, and unify them through shared contracts, analytics taxonomy, visual tokens, and controlled lead-intake boundaries. Do not create a new public web repository or perform a merge during this forensic slice.

### Public website

Existing WordPress at `costacleanbcn.com`. WordPress/SiteGround remains the deployment and tracking integration boundary until a separately authorized migration proves a better target.

### Client portal

Current portal surface in `costa-clean-app`, retaining its isolated bootstrap and membership-based Supabase contracts. A future public entry point may be `/portal` or an equivalent deployment route only after deployment and SEO gates are certified.

### Internal CRM

Current authenticated CRM surface in `costa-clean-app`, not exposed through public or portal navigation and not indexable.

### Supabase

One governed backend with explicit trust boundaries: public ingress only through narrow contracts, CRM through staff authorization, and portal through active client membership plus portal Edge/RPC contracts. No service-role browser code and no remote schema changes in this decision slice.

### Shared UI and analytics

Share design tokens and an event taxonomy only where it does not couple security boundaries. Marketing events may include page/service/CTA/lead lifecycle signals; authenticated portal data must not send invoices, private addresses, services, identities, or financial data to ad platforms.

## Gate result

PASS for U1/U2/U3 documentation and preservation. NOT AUTHORIZED for a framework rewrite, public-web creation, production cutover, Supabase remote changes, domain/DNS changes, or paid advertising.

## Next slice

`U4 Unified repository/platform foundation`: define shared contracts and design tokens without moving portal behavior, changing auth, changing routes, or changing Supabase. It should start only as a separately reviewable implementation block.

