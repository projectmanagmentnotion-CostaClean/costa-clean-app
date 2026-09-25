# Migration uncertainties

| ID | Topic | Classification | Impact | Required decision |
|---|---|---|---|---|
| U-M2-001 | First tactical product objective | UNKNOWN / CONFLICT | Prevents safe execution | Human selects one bounded objective |
| U-M2-002 | Active product gate after historical V3/post-release docs | HISTORICAL_CLAIM_UNVERIFIED | Historical labels cannot drive planning | Human accepts or corrects roadmap interpretation |
| U-M2-003 | Relationship between original local HEAD `64386f1` and canonical remote `368ed1f` | CONFLICT | Original checkout is in an active rebase | Human or project owner resolves separately; M2 leaves it untouched |
| U-M2-004 | Current truth of prior QA/release PASS claims | HISTORICAL_CLAIM_UNVERIFIED | No recertification in M2 | Re-run targeted evidence only under an approved task |
| U-M2-005 | Remote Brain state | CONFIRMED_MISSING | No remote canonical context exists yet | Review local candidate before any remote publication |
| U-M2-006 | Current test/lint/build health of Costa Clean | UNKNOWN | M2 is documentation-only | Verify in a separately approved, isolated execution |

No uncertainty is silently converted into a completion claim.
