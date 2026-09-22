#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly PROJECT_REF='wfxnwfcdjainpojhbdri'
readonly EXPECTED_USER='postgres.wfxnwfcdjainpojhbdri'
readonly EXPECTED_DATABASE='postgres'
response_file="${1:-}"

[[ -n "$response_file" && -f "$response_file" && -n "${GITHUB_ENV:-}" ]] || exit 1

# Keep the URI and any embedded credential entirely inside jq. Only the
# validated host is ever returned to the caller.
if ! resolved_host="$(jq -er --arg project_ref "$PROJECT_REF" '
  def connection_string:
    if has("connection_string") then
      if (.connection_string | type) == "string" and (.connection_string | length) > 0
      then .connection_string else error("invalid primary connection string") end
    elif has("connectionString") then
      if (.connectionString | type) == "string" and (.connectionString | length) > 0
      then .connectionString else error("invalid primary connection string") end
    else error("missing primary connection string") end;

  if type != "array" then error("invalid response root") else . end
  | map(select(type == "object" and .database_type == "PRIMARY"))
  | if length != 1 then error("invalid primary count") else .[0] end
  | connection_string as $uri
  | if ($uri | test("^postgres(ql)?://")) then $uri else error("invalid URI scheme") end
  | split("@") as $parts
  | if ($parts | length) != 2 or ($parts[0] | length) == 0
    then error("invalid URI authority") else $parts[1] end
  | capture("^(?<host>[^:/@]+):(?<port>[0-9]+)/[^/?#]+([?].*)?$")
  | if (.host | test("^aws-[0-9]+-eu-west-1[.]pooler[.]supabase[.]com$"))
    then .host else error("invalid pooler host") end
' "$response_file" 2>/dev/null)"; then
  exit 1
fi

[[ "$resolved_host" =~ ^aws-[0-9]+-eu-west-1[.]pooler[.]supabase[.]com$ ]] || exit 1
printf 'CP51F_POOLER_HOST=%s\nCP51F_POOLER_PORT=5432\nCP51F_POOLER_USER=%s\nCP51F_POOLER_DB=%s\n' \
  "$resolved_host" "$EXPECTED_USER" "$EXPECTED_DATABASE" >>"$GITHUB_ENV"
printf '%s\n' "$resolved_host"
