#!/usr/bin/env bash
set -Eeuo pipefail

FILTER='
  def valid_page:
    if type != "object" then false
    elif (has("workflow_runs") | not) then false
    else (.workflow_runs | type) == "array"
    end;
  def valid_run:
    if type != "object" then false
    elif (has("id") | not) then false
    elif (has("head_branch") | not) then false
    elif (has("head_sha") | not) then false
    elif (has("event") | not) then false
    else ((.id | type) == "number" and
          (.head_branch | type) == "string" and
          (.head_sha | type) == "string" and
          (.event | type) == "string")
    end;
  if type != "array" then
    error("invalid history page set")
  elif length == 0 then
    error("empty history page set")
  elif any(.[]; (valid_page | not)) then
    error("invalid history page")
  elif any(.[].workflow_runs[]; (valid_run | not)) then
    error("invalid workflow run record")
  else
    ([.[].workflow_runs[] |
      select(.head_branch == $expected_tag and
             .head_sha == $expected_sha and
             .event == "push" and
             ((.id | tostring) != $current_run_id))] | length)
  end
'

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

run_pass() {
  local case_name="$1" expected="$2" payload="$3" output
  output="$(printf '%s\n' "$payload" | jq -er \
    --arg expected_tag 'cp51f-run-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
    --arg expected_sha '386d2f8f233eac9847a64d0e05f12d8cfdd269a3' \
    --arg current_run_id '1002' \
    "$FILTER")" || { printf 'HISTORY_SCHEMA_TEST=FAIL:%s\n' "$case_name" >&2; exit 1; }
  [[ "$output" == "$expected" ]] || { printf 'HISTORY_SCHEMA_TEST=FAIL:%s expected=%s actual=%s\n' "$case_name" "$expected" "$output" >&2; exit 1; }
}

run_reject() {
  local case_name="$1" payload="$2"
  if printf '%s\n' "$payload" | jq -er \
    --arg expected_tag 'cp51f-run-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
    --arg expected_sha '386d2f8f233eac9847a64d0e05f12d8cfdd269a3' \
    --arg current_run_id '1002' \
    "$FILTER" >"$tmp_dir/$case_name.out" 2>"$tmp_dir/$case_name.err"; then
    printf 'HISTORY_SCHEMA_TEST=FAIL:%s accepted malformed history\n' "$case_name" >&2
    exit 1
  fi
}

valid_run='{"id":1001,"head_branch":"cp51f-run-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","head_sha":"386d2f8f233eac9847a64d0e05f12d8cfdd269a3","event":"push"}'
current_run='{"id":1002,"head_branch":"cp51f-run-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","head_sha":"386d2f8f233eac9847a64d0e05f12d8cfdd269a3","event":"push"}'
other_run='{"id":1003,"head_branch":"other-tag","head_sha":"other-sha","event":"push"}'

# A-E: valid history, previous-run matching, current-run exclusion, filters, and pagination.
run_pass A 0 "[{\"workflow_runs\":[]}]"
run_pass B 1 "[{\"workflow_runs\":[$valid_run]}]"
run_pass C 0 "[{\"workflow_runs\":[$current_run]}]"
run_pass D 0 "[{\"workflow_runs\":[$other_run]}]"
run_pass E 1 "[{\"workflow_runs\":[]},{\"workflow_runs\":[$valid_run]}]"

# F-J: top-level/page shape failures.
run_reject F '{"unexpected":[]}'
run_reject G '[]'
run_reject H '[null]'
run_reject I '[{"unexpected":[]}]'
run_reject J '[{"workflow_runs":{}}]'

# K-R: run shape and field/type failures, including malformed later-page records.
run_reject K '[{"workflow_runs":[null]}]'
run_reject L '[{"workflow_runs":[{"head_branch":"x","head_sha":"y","event":"push"}]}]'
run_reject M '[{"workflow_runs":[{"id":"1001","head_branch":"x","head_sha":"y","event":"push"}]}]'
run_reject N '[{"workflow_runs":[{"id":1001,"head_branch":7,"head_sha":"y","event":"push"}]}]'
run_reject O '[{"workflow_runs":[{"id":1001,"head_branch":"x","head_sha":7,"event":"push"}]}]'
run_reject P '[{"workflow_runs":[{"id":1001,"head_branch":"x","head_sha":"y","event":7}]}]'
run_reject Q '[{"workflow_runs":[{"id":1001,"head_branch":"x","head_sha":"y"}]}]'
run_reject R "[{\"workflow_runs\":[]},{\"workflow_runs\":[{\"id\":1004,\"head_branch\":\"x\",\"head_sha\":\"y\",\"event\":null}]}]"

printf 'CP51F_HISTORY_SCHEMA_TESTS=PASS\n'
