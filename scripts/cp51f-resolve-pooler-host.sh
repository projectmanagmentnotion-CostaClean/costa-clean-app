#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly EXPECTED_USER='postgres.wfxnwfcdjainpojhbdri'
readonly EXPECTED_DATABASE='postgres'
response_file="${1:-}"

[[ -n "$response_file" && -f "$response_file" && -n "${GITHUB_ENV:-}" ]] || exit 1

if ! resolved_host="$(node - "$response_file" <<'NODE'
'use strict';
const fs = require('node:fs');

function fail(stage) {
  process.stderr.write(`CP51F_POOLER_RESOLVER_INVALID=${stage}\n`);
  process.exit(1);
}
try {
  const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!Array.isArray(payload)) fail('RESPONSE_SCHEMA');
  const primary = payload.filter((entry) =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry) && entry.database_type === 'PRIMARY'
  );
  if (primary.length !== 1) fail('PRIMARY_COUNT');
  const item = primary[0];
  const uri = typeof item.connection_string === 'string' && item.connection_string.length > 0
    ? item.connection_string
    : typeof item.connectionString === 'string' && item.connectionString.length > 0
      ? item.connectionString
      : null;
  if (uri === null || /\s/.test(uri)) fail('CONNECTION_STRING');
  const match = uri.match(/^postgres(?:ql)?:\/\/([^/?#]+)(\/[^?#]*)(?:\?[^#]*)?$/);
  if (!match || match[2] !== '/postgres') fail('URI_FORMAT');
  const authority = match[1].split('@');
  if (authority.length !== 2 || authority[0].length === 0) fail('URI_AUTHORITY');
  const hostAndPort = authority[1].match(/^([^:/@]+):([0-9]+)$/);
  if (!hostAndPort) fail('URI_HOST_PORT');
  const host = hostAndPort[1];
  if (!/^aws-[0-9]+-eu-west-1[.]pooler[.]supabase[.]com$/.test(host)) fail('HOST_VALIDATION');
  process.stdout.write(host);
} catch {
  process.stderr.write('CP51F_POOLER_RESOLVER_INVALID=JSON_OR_INPUT\n');
  process.exit(1);
}
NODE
)"; then
  exit 1
fi

[[ "$resolved_host" =~ ^aws-[0-9]+-eu-west-1[.]pooler[.]supabase[.]com$ ]] || exit 1
printf 'CP51F_POOLER_HOST=%s\nCP51F_POOLER_PORT=5432\nCP51F_POOLER_USER=%s\nCP51F_POOLER_DB=%s\n' \
  "$resolved_host" "$EXPECTED_USER" "$EXPECTED_DATABASE" >>"$GITHUB_ENV"
printf '%s\n' "$resolved_host"
