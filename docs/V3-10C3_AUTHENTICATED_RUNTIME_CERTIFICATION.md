# V3-10C3 — Authenticated Runtime Certification

Status: `PASS`

This is a sanitized, read-only certification record for the final V3-10C3
runtime replay. It contains no credentials, cookies, tokens, customer records
or screenshots.

## Environment and scope

- App: `http://127.0.0.1:4178/?v3=1`
- QA project: `kpvvydthlxupjjqqdpxy`
- Auth namespace/profile: `costaclean-v3` / canonical QA browser profile
- Mode: authenticated, read-only
- C3 surfaces: Home, Clients, Leads, Properties and More/navigation
- Production: not requested or contacted

## Responsive runtime matrix

The final replay covered `320x568`, `390x844`, `430x932`, `768x1024`,
`1024x1366`, `1280x800`, `1440x900` and `1920x1080`.

All eight sessions authenticated and all 32 selected surface visits passed
direct navigation, ready-state, workspace deep-link/hard-reload/Back behavior,
and document HTTP status checks. Search match/roundtrip passed for Clients;
the standard miss/clear checks passed when data existed and reported N/A rather
than failure for empty records.

## Safety and accessibility

| Check | Result |
| --- | --- |
| Production requests | 0 |
| Non-QA Supabase requests | 0 |
| QA mutations | 0 |
| Console errors / page errors / failed requests | 0 / 0 / 0 |
| Horizontal overflow viewports | 0 |
| Broken images | 0 |
| Visible / accessible UUIDs | 0 / 0 |
| Unicode-as-icon / legacy markers | 0 / 0 |
| Contact-action minimum geometry | 54.84 × 44 CSS px |
| More open/close with Escape | PASS at all eight viewports |
| More focus restoration | PASS at 390x844, 768x1024 and 1440x900 |

The focus-restoration replay identified and corrected a shell-only issue: on
close, the More sheet now returns focus to its visible trigger after the
unmount has committed. It changes no navigation, data, financial or backend
contract.

## Visual evidence

Private ignored captures are retained locally for the 390x844, 768x1024 and
1440x900 anchors. They were inspected for hierarchy, bounded property media,
usable list density, navigation treatment, sheet composition, clipping and
responsive composition. They are intentionally excluded from Git because they
contain QA account and customer-like data.

## Independent gate record

The final evidence review reconciled the source diff, runtime summary, private
capture locations, responsive invariants, accessibility behavior and protected
contract freeze. Result: `PASS`.

## Non-goals preserved

- no Supabase schema, RPC, policy, storage or business-data changes;
- no production request, mutation or deployment;
- no client, lead, property, invoice, quote, payment, expense, service,
  alert, closing or recurring business-contract change;
- V3-10C4 and V3-10C5 product implementation remain out of scope.
