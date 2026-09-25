# Stack

React, Vite, TypeScript, Vitest, CSS, and Supabase. The repository also contains local Supabase configuration and Edge Function sources. Package scripts are the source of truth for lint, build, and test commands.

# Major components

- `src/App.tsx` application shell and auth bootstrap.
- `src/v3/` V3 presentation and domain surfaces.
- `src/features/` feature APIs, forms, and auth/operational modules.
- `src/app/` application data and public route composition.
- `src/lib/` Supabase and integration helpers.
- `supabase/migrations/` database contract history.
- `supabase/functions/` Edge Functions.

# Data boundaries

The browser uses Supabase client and REST helpers. Database schema, RLS, RPCs, storage, auth, and Edge Functions are represented by the Supabase project files. No remote environment was contacted during M2.

# External services

Supabase is detectable from dependencies, source imports, `supabase/config.toml`, and migrations. Vercel is detectable from `vercel.json` and package/deployment documentation. GitHub is the canonical Git remote. Credentials and environment values were not read or used.

# Runtime model

Vite serves the React client. Supabase supplies authentication and data services. Local Supabase configuration declares auth, storage, realtime, analytics, and Edge Runtime capabilities; this is configuration evidence, not proof that a remote service is healthy.

# Security boundaries

Production, remote writes, secrets, destructive operations, push/merge/PR, deployment, and real external side effects are forbidden in M2. All future actions must pass the extensible approval policy.

# Deployment model

Vercel configuration is present, but no deployment status is inferred. Deployment remains approval-required.

# Known architecture constraints

The canonical repository contains a large historical documentation surface and an active rebase exists in the original local checkout. Current runtime and product claims must be reverified before execution.
