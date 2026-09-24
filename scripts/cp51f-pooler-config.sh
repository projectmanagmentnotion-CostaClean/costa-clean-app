#!/usr/bin/env bash

# Validate only the non-secret Session Pooler coordinates captured from the
# Supabase Dashboard. This performs no network or database operation.
cp51f_validate_pooler_config() {
  local host="${1:-}" port="${2:-}" user="${3:-}" database="${4:-}" project_ref="${5:-}"

  [[ "$project_ref" == "wfxnwfcdjainpojhbdri" ]] || return 1
  [[ "$host" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]\.pooler\.supabase\.com$ ]] || return 1
  [[ "$port" == "5432" ]] || return 1
  [[ "$user" == "postgres.wfxnwfcdjainpojhbdri" ]] || return 1
  [[ "$database" == "postgres" ]] || return 1
}
