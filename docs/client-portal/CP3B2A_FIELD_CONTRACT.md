# CP-3B.2A Field Contract

Date: 2026-07-28

State: `FROZEN_SOURCE_ONLY`

Payloads are JSON objects with 1–5 exact keys and string values. Unknown keys,
nulls, other types, nested values, empty strings, control characters and
`<`/`>` are rejected. Values are trimmed before persistence and comparison.

## Profile allowlist

| Public key | Canonical comparison | Maximum | Normalization |
|---|---|---:|---|
| `fullName` | `clients.full_name` | 200 | trim |
| `phone` | `clients.phone` | 40 | trim |
| `email` | `clients.email` | 320 | trim, lowercase, basic email validation |
| `taxId` | `clients.tax_id` | 80 | trim, uppercase |
| `billingAddress` | `clients.billing_address` | 320 | trim |

## Property allowlist

| Public key | Canonical comparison | Maximum | Normalization |
|---|---|---:|---|
| `name` | `properties.name` | 200 | trim |
| `propertyType` | `properties.property_type` | 80 | trim |
| `address` | `properties.address` | 320 | trim |
| `city` | `properties.city` | 120 | trim |
| `postalCode` | `properties.postal_code` | 32 | trim |

Normalized `jsonb` is persisted and compared for idempotency. If any submitted
field equals its normalized canonical value, the whole request is rejected.

Status, tenant/requester identity, IDs, ownership, deletion/archive timestamps,
internal/fiscal administration fields, notes, relationships, review/audit data
and timestamps are forbidden. Receipts expose field names, never values.
