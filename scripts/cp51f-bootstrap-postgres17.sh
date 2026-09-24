#!/usr/bin/env bash
set -Eeuo pipefail

[[ -r /etc/os-release ]] || { echo 'STOP_UNSUPPORTED_RUNNER_OS'; exit 1; }
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 24.04 ]] || { echo 'STOP_UNSUPPORTED_RUNNER_OS'; exit 1; }

sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gnupg \
  jq \
  coreutils \
  age \
  postgresql-common

sudo install -d -m 0755 /usr/share/postgresql-common/pgdg
curl --fail --silent --show-error --location \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo tee /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc >/dev/null
echo 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt noble-pgdg main' \
  | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null

sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends postgresql-17 postgresql-client-17

readonly PG_BIN_DIR=/usr/lib/postgresql/17/bin
readonly REQUIRED_TOOLS=(pg_dump pg_dumpall psql initdb pg_ctl)
for tool in "${REQUIRED_TOOLS[@]}"; do
  tool_path="$PG_BIN_DIR/$tool"
  [[ -x "$tool_path" ]] || { echo "CP51F_POSTGRES17_BOOTSTRAP=FAIL missing:$tool"; exit 1; }
  "$tool_path" --version | grep -Eq ' 17([.]|$)' || {
    echo "CP51F_POSTGRES17_BOOTSTRAP=FAIL version:$tool"
    exit 1
  }
done

echo 'CP51F_POSTGRES17_BOOTSTRAP=PASS'
