# N5.2 provider options — decision gate

This is a local comparison only. No account, secret, paid request or deployment was created.

| Option | Spanish invoices/receipts | Multi-VAT and JSON | Privacy/latency | Cost/control | Fit now |
| --- | --- | --- | --- | --- | --- |
| OpenAI vision + structured output | Strong document understanding; quality depends on prompt and image | Strong schema control; explicit validation still required | External transfer; variable latency | Flexible, usage-based; requires server secret | Candidate for later adapter |
| Google Document AI / Invoice Parser | Strong invoice/OCR specialization and localization | Strong invoice fields; provider schema adapter required | External transfer; regional configuration required | Usage-based; vendor lock-in | Candidate for later adapter |
| Azure Document Intelligence | Strong OCR and prebuilt invoice model | Good invoice extraction; adapter required | External transfer; regional configuration required | Usage-based; enterprise controls | Candidate for later adapter |
| AWS Textract + custom normalization | Strong OCR primitives | More application normalization work | External transfer; pipeline latency | Usage-based; more moving parts | Candidate for later adapter |
| Local OCR engine | Maximum data locality and predictable boundary | Requires custom parsing and validation | Local processing; operational maintenance | Infrastructure cost rather than API cost | Candidate where privacy dominates |

## Recommendation for a future authorized runtime

Run a bounded bake-off using representative Spanish invoices, receipts, photographed documents, PDFs and multi-VAT cases. The initial candidate to evaluate first is a server-side invoice-specialized provider (Google Document AI or Azure Document Intelligence) against the same versioned contract, with OpenAI vision as a flexible comparison. Selection must consider accuracy, raw-data retention, EU processing, latency, cost, failure behavior and human-review workload. This is not an integration decision and no provider is integrated in N5.2.

Any future adapter must be server-side, owner-checked, schema-validated, timeout-bounded, secret-free in the browser, and unable to create financial records.
