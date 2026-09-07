# Costa Clean App V3 — Mobile Screen Blueprint

Status: conceptual blueprint pending Stitch screenshots. This document defines decisions and content contracts, not final pixels.

## Shared shell

- Safe-area-aware top context and bottom navigation.
- One compact header title plus optional back/status context.
- Bottom nav labels: Inicio, Trabajo, Clientes, Finanzas, Más.
- No simultaneous master-detail panes.

## Home

- First viewport: greeting/context, one priority queue and one alert shortcut.
- Queue item: what it is, status, key fact, next action.
- Avoid more than one summary metric row before the first actionable item.
- Empty state explains the next useful action, not just “no data”.

## Facturas list

- Search first; filters in bottom sheet.
- Compact row: invoice reference, client, status, amount/outstanding, one primary quick action.
- Pending/partial rows expose collection action; paid rows do not.
- Download is direct and remains available without detail navigation.
- Selection mode replaces normal row actions with a contextual header and sticky bottom bar.

## Factura workspace

- Back + invoice reference + status.
- Summary: client, total, paid, outstanding and issue date.
- Primary: state-aware collection action.
- Quick actions: Descargar, Compartir (if approved), Cobros.
- More: edit, duplicate/correction, archive/cancel and other rare actions.
- Sections: payment state, client/property, service origin, lines, history, document.

## Leads list/workspace

- List emphasizes urgency/review state and requester identity.
- Workspace shows request context first, then one decision CTA: review/contact/convert/create quote.
- Keep duplicate and review state visible but secondary.

## Services list/workspace

- List emphasizes status, date, client/property and operational next action.
- Workspace shows service context, lines/notes, lifecycle and quote/invoice relation.
- Primary follows state: start/complete/invoice/open existing document.

## Filter bottom sheet

- Focus trap, clear close affordance, Apply and Reset.
- Sections: status, date, sort; only fields relevant to the module.
- Sheet never becomes a permanent mobile block.

## Multi-selection mode

- Contextual top bar: Cancel, count, Select all.
- Bottom actions are valid for the selected entity type only.
- No duplicate normal-row CTAs while active.

## Create/edit full-screen flow

- First required field visible on open.
- StepFlow order follows user decision order, not database schema.
- Review step states exact consequence and validation.
- Sticky CTA respects keyboard and safe area.

## States required for every screen

Loading, empty, error/retry, populated, disabled/busy, success confirmation and reduced-motion behavior. Visual evidence for all states is still WAITING_FOR_STITCH.
