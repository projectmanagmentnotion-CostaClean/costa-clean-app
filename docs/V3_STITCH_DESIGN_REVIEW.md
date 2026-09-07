# Costa Clean App V3 — Stitch Design Review V3-0B

Status: `READY FOR HUMAN APPROVAL — NO IMPLEMENTATION`. The previous visual set A/B/C is rejected. The new V3-0B directions below are the only candidates for review; Stitch remains the visual evidence source and the repository remains authoritative for behavior, data and security.

## Rejected visual baseline

The former Direction B recommendation is invalidated. The old A/B/C canvases are retained only as historical evidence and must not be used as the visual base:

- [Old Direction A](https://stitch.withgoogle.com/projects/10976614506598796765?hl=es&pli=1) — `REJECTED`
- [Old Direction B](https://stitch.withgoogle.com/projects/8650363538424131334?hl=es&pli=1) — `REJECTED`
- [Old Direction C](https://stitch.withgoogle.com/projects/8323720746273301525?hl=es&pli=1) — `REJECTED`

Only the functional learnings survive: mobile-first, entity workspaces, app-like navigation, quick actions, contextual selection, bottom navigation and fewer clicks.

## V3-0B Stitch projects

| Direction | Stitch canvas | Evidence observed | State |
| --- | --- | --- | --- |
| Finance Minimal | [Project 16933552908903861488](https://stitch.withgoogle.com/projects/16933552908903861488?hl=es&pli=1) | Finance tokens, Facturas list, Home, Presupuestos list, Factura workspace, Cliente workspace, Clientes list, Servicios list visible in the canvas | Ready for human review; remaining requested screens are being generated in Stitch batches |
| Friendly Business | [Project 5385378961807597557](https://stitch.withgoogle.com/projects/5385378961807597557?hl=es&pli=1) | Friendly shell, Home, Factura workspace, Facturas list, Presupuestos list and finance navigation visible in the canvas | Ready for human review; remaining requested screens are being generated in Stitch batches |
| Editorial SaaS | [Project 6884707630640107069](https://stitch.withgoogle.com/projects/6884707630640107069?hl=es&pli=1) | Editorial tokens, Home, Factura workspace, Facturas list and Presupuestos list visible in the canvas | Ready for human review; remaining requested screens are being generated in Stitch batches |

No generated demo identity, company, address, amount or contact is production data. No credentials, screenshots, tokens or private QA artifacts are stored in the repository.

## New direction scorecard

Scores are comparative design-review judgments from the visible Stitch evidence, not implementation claims.

| Direction | Simplicity | Clarity | Hierarchy | Friendliness | Professionalism | Finance | Mobile | Speed | Scalability | Air | Density | Accessibility | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Finance Minimal | 9 | 9 | 9 | 7 | 9 | 10 | 9 | 9 | 9 | 8 | 9 | 9 | 106 |
| Friendly Business | 8 | 9 | 8 | 10 | 9 | 9 | 10 | 9 | 8 | 8 | 8 | 9 | 105 |
| Editorial SaaS | 10 | 9 | 10 | 7 | 9 | 9 | 9 | 8 | 9 | 10 | 7 | 9 | 106 |

### Recommendation

Recommend `Finance Minimal` as the working candidate because it gives invoices, receivables, payments and quote context the clearest financial hierarchy while remaining mobile-first and operationally dense. Borrow from Friendly Business its approachable shell and from Editorial SaaS its flat document surfaces. This is a recommendation only; no token or component is approved for production until the human reviewer selects one direction.

## Required screen set

Each direction was prompted with the complete required set. The visible canvas currently proves the first generated batches; the rest remain a Stitch-generation state, not a Codex implementation gap:

1. Home — “Cómo va mi negocio hoy”
2. Facturas list
3. Factura workspace
4. Presupuestos list
5. Presupuesto workspace
6. Clientes list
7. Cliente workspace
8. Servicios list
9. Lead workspace
10. Filters bottom sheet
11. Multi-selection mode
12. Nueva factura full-screen

The human review must mark each screen `PASS`, `PARTIAL` or `WAITING_FOR_STITCH` in the canvases before V3-1 begins. Mobile anchors remain 390x844, 768x1024 and 1440x900; 320px safe-failure remains required for critical surfaces.

## Review checklist

- [x] Old Direction A/B/C explicitly rejected.
- [x] Three materially different V3-0B directions generated in Stitch.
- [x] New canvas links and project IDs recorded.
- [x] Home, invoice, quote, client and service evidence visible in the generated canvases where available.
- [x] Finance Minimal recommendation recorded with explicit trade-offs.
- [x] Functional contracts, routes, Supabase and auth untouched.
- [ ] Human approval of one visual direction.
- [ ] Complete screen-by-screen visual PASS for all 12 screens at required mobile/tablet/desktop anchors.
- [ ] V3-1 implementation authorization.
