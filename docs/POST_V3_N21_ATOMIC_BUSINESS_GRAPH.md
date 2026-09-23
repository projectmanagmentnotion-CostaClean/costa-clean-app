# POST-V3 N2.1 — Atomic Business Graph Closeout

Status: certified on QA; no Production migration, deployment, or business mutation.

## Scope and canonical contracts

N2.1 keeps the internal Costa Clean graph coherent for new invoice writes:

`client → property → quote (optional) → job/service → invoice → payment`.

The canonical invoice write is `save_invoice_business_graph(jsonb)`. It validates client/property and quote compatibility, resolves `AUTO_CREATE`, `EXISTING_JOB`, or `FROM_QUOTE`, creates or reuses one job, copies owned invoice lines to job lines, records provenance, and commits atomically. The canonical settlement is `settle_invoice_business(jsonb)`; paid state is derived from payment evidence and is protected by idempotency and row locking.

N2.1 does not replay the historical recurring, Hotel Las Vegas, or historical-property migrations. The applied N2.1 migration remains immutable. No corrective migration was required.

## Service origins and ambiguity

- `AUTO_CREATE`: creates exactly one service/job using the explicit service date or invoice issue date and preserves one-to-one line parity.
- `EXISTING_JOB`: reuses only a compatible job and never overwrites its operational lines.
- `FROM_QUOTE`: preserves quote lineage; zero compatible jobs creates one, one reuses it, and more than one fails closed.

The authenticated multi-job UI proof used two compatible jobs. The review step displayed: “El presupuesto tiene varios servicios compatibles. Selecciona uno explícitamente.” No invoice was created and the fixture teardown completed cleanly.

## Settlement and fiscal behavior

Drafts remain unnumbered. Issue and settlement reuse the certified N3 allocator. `settle_invoice_business` locks the invoice, calculates the exact outstanding balance, creates at most one payment per operation, and refreshes the invoice state. Repeated or concurrent settlement is idempotent; cancelled invoices and overpayments are blocked.

Direct paid-status writes are not used for normal invoice settlement. Manual invoice creation routes through the canonical business graph.

## UI and lineage

The invoice StepFlow is:

1. Cliente e inmueble
2. Servicio
3. Conceptos
4. Facturación
5. Revisar

The review step exposes client, property, service origin, quote, lines, totals, and the ambiguity error when applicable. Invoice detail includes compact relation context for client, property, quote, service, and payments. Existing V3 shell, one-logo, responsive, and N1 reset/invalidation contracts are preserved.

## QA evidence

- Existing certified cases retained: AUTO_CREATE; EXISTING_JOB 28/28; FROM_QUOTE zero-job 28/28; FROM_QUOTE one-job 28/28; Mark Paid; idempotency; failure injection; settlement; N1; N3; recurring compatibility.
- Cross-run recovery: runs `1313…` and `2626…` were classified as one synthetic connected component and removed transactionally with the fiscal guard active. No external or real QA rows were changed.
- Runner regression: run `3737…` created its own client/property before UI, selected exact IDs after rerenders, completed authenticated mobile write-and-clean at `390x844` with 28/28 checks, and left zero residue.
- Authenticated responsive write-and-clean reruns also passed at `820x1180` (run `5252…`) and `1440x900` (run `5353…`).
- Multi-job ambiguity: runs `4848…` and `4949…`; two compatible jobs were verified, UI failed closed, zero invoice was created, and teardown plans returned zero.
- Realtime: run `5151…`; observer context B was open before writer context A. Supabase Realtime invalidation caused REST refetch activity in invoice and job views, with observed refreshes at approximately 21.6s and 21.3s from observer arming. The payment view also received post-mutation REST refetch activity; no manual reload was used.
- Final QA database state: `qa_n2_residue=0`; relational invariants are zero; fiscal mapping hash is `c9cdfdbdde0b7b50fd0451dd24987724`; sequence state remains `109 / is_called=true`.
- Automated gates: 561 tests passed, 0 skipped; agents 294/294; lint, TypeScript, build, and diff check passed.

All synthetic fixtures were removed through the certified QA teardown path. Production was not queried, migrated, mutated, or deployed.

## Final recommendation

N2.1 is ready for the next authorized sprint: **POST-V3 GLOBAL RELEASE CERTIFICATION**.
