#!/usr/bin/env bash

set -Eeuo pipefail

request_method=""
output_path=""
url=""
while (($#)); do
  case "$1" in
    --request)
      request_method="${2:-}"
      shift 2
      ;;
    --output)
      output_path="${2:-}"
      shift 2
      ;;
    --write-out)
      shift 2
      ;;
    https://*)
      url="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Consume the curl config (including the synthetic auth header) without logging it.
cat >/dev/null
[[ "$request_method" == GET ]] || exit 90
[[ "$url" == 'https://api.supabase.com/v1/projects/wfxnwfcdjainpojhbdri/jit-access' ]] || exit 91
[[ -n "$output_path" ]] || exit 92
printf '%s' "${CP51F_PROBE_FIXTURE_BODY:-}" >"$output_path"

if [[ "${CP51F_PROBE_FIXTURE_NETWORK_ERROR:-NO}" == YES ]]; then
  printf '%s' 'synthetic curl stderr secret marker' >&2
  printf '%s' '000'
  exit 7
fi
printf '%s' "${CP51F_PROBE_FIXTURE_STATUS:-200}"
