# Invoice 2026-045 Internal Save Fix

## Objetivo

Separar de forma explicita la correccion interna de una factura emitida no enviada frente a cualquier rama de emision o reemision.

## Funcion real ejecutada por el boton

El boton `Guardar correccion interna` del overlay mayor de facturas ejecuta:

- `handleSave()` en `src/features/invoices/InvoiceEditFlow.tsx`

No ejecuta `saveInvoiceEdits()` de `InvoiceDetailCard` cuando la pagina abre el `MajorEditFlowOverlay` desde `InvoicesPage`.

## Causa exacta del bug

Habia dos problemas combinados en `InvoiceEditFlow.tsx`:

1. el flujo de correccion interna seguia apoyandose en `form.status` como superficie editable aunque la factura original ya estaba emitida
2. al marcar la confirmacion interna, el estado `error` no se limpiaba automaticamente

Efecto practico:

- la UI podia seguir mostrando el mensaje:
  - `No se puede emitir factura. Hay huecos en la numeracion fiscal: 2026-045.`
- aunque el CTA ya hubiera pasado a `Guardar correccion interna`

Ademas, el modo interno no dejaba suficientemente fijado que:

- el estado a guardar debia seguir siendo el de la factura emitida original
- no habia que abrir ninguna rama de numeracion nueva

## Cambio aplicado

Archivo principal:

- `src/features/invoices/InvoiceEditFlow.tsx`

Cambio funcional:

- se introduce `isIssuedInvoice`
- se introduce `resolvedSaveStatus`
- se mantiene `invoice.status` como estado efectivo cuando la correccion interna esta confirmada
- se mantiene `requiresNewEmissionValidation = false` en correccion interna confirmada
- se bloquea la edicion manual del `Estado administrativo` para facturas ya emitidas
- al marcar la confirmacion interna se limpia `error`
- la traza de `pricing_metadata` distingue:
  - `invoice_edit_flow`
  - `invoice_edit_flow_internal_correction`

## Lo que no se toco

- SQL
- RPC
- migrations
- `appDataApi`
- `financialWriteApi`
- numeracion global
- contratos de datos

## Estado despues del fix

- la correccion interna mantiene el mismo `invoice_number`
- la correccion interna mantiene el mismo `display_code`
- la correccion interna no debe abrir validacion de huecos de nueva emision
- el estado administrativo deja de ser una superficie ambigua dentro de esta correccion

## Riesgo residual

El write path real sigue requiriendo autenticacion para aplicar cambios en datos.
El fix corrige la rama UI/payload, pero no sustituye la necesidad de sesion o credencial autorizada para persistir la correccion real.
