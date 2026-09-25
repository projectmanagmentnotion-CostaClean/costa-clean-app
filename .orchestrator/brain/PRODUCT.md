# Users

Costa Clean is a CRM and operational application for a professional cleaning business. The repository describes a product branded as CostaClean CRM, with authenticated internal users and separate public/portal surfaces.

# Core use cases

- Authenticate staff users.
- Manage leads, clients, properties, jobs, quotes, invoices, payments, expenses, alerts, recurring plans, and portal interactions.
- Support public quote or quiz entry points and client/member portal flows.
- Maintain audit and operational notification records.

# Product scope

The product scope is derived from the canonical repository structure, `README.md`, `AGENTS.md`, Supabase migrations, and the V3 feature modules. The exact priority and release gate are not asserted by this migration.

# Out of scope

- Treating historical roadmap prose as proof of current completion.
- Production operations, remote database writes, deployment, billing, DNS, secrets, or real email.
- Selecting the next product sprint without human review of this Brain.

# Domain concepts

Lead, client, property, job, quote, invoice, payment, expense, recurring plan, alert, portal member, audit record, and media attachment are repository-visible domain concepts.

# Major workflows

Authentication; CRM navigation; lead-to-client and client/property workflows; quote and invoice workflows; payment and expense workflows; portal service and invoice actions; alert and audit workflows.

# Success criteria

Success for M2 is a valid, traceable, reviewable Brain. Product success criteria and the next tactical objective remain to be accepted separately.
