# Client Fiscal Manual Backfill Applied QA

Fecha: 2026-06-30

## Fuente manual usada

- Tabla manual incluida en el sprint del usuario.
- No se uso OCR.
- No se parsearon imagenes.
- No se uso texto libre fuera de esa tabla manual.

## Estado

- Backfill manual ejecutado y persistido.
- API de escritura usada: `src/features/clients/clientWriteApi.ts`
- Script interno usado: `scripts/apply-manual-client-fiscal-backfill.ts`

## Clientes encontrados

- Clientes encontrados con match seguro: 8
  - `CLI-0016` `Pink Elephant SL`
  - `CLI-0015` `D. DAVID MOLINA BOZA`
  - `CLI-0014` `CARLOS ENRIQUE MARQUEZ RIDAO`
  - `CLI-0005` `GILFIT SPORTS SLU`
  - `CLI-0007` `GURI, TEIXIDO I ASSOCIATS SL` en tabla manual, cliente real `GURI, TEIXIDO I ASSOCIATS SL`
  - `CLI-0009` `FUSTERIA PINEDA MAR SL`
  - `CLI-0008` `FUNDACION PRIVADA GENTIS`
  - `CLI-0006` `FLEXICAR INTERNACIONAL SL`

## Clientes actualizados

- Clientes actualizados: 8
- Campos aplicados:
  - `CLI-0016`: `tax_id`, `billing_address`
  - `CLI-0015`: `tax_id`, `billing_address`
  - `CLI-0014`: `tax_id`, `billing_address`
  - `CLI-0005`: `tax_id`, `billing_address`
  - `CLI-0007`: `tax_id`, `billing_address`
  - `CLI-0009`: `tax_id`, `billing_address`
  - `CLI-0008`: `tax_id`, `billing_address`
  - `CLI-0006`: `tax_id`, `billing_address`

## Clientes puestos en active

- Clientes puestos en `active`: 0
- Motivo: los 8 clientes ya estaban en `active` antes del backfill.

## Clientes sin cambios

- Clientes sin cambios: 0

## Clientes no encontrados

- `ALCLAPA SPORT SL`
  - No se aplico por no cumplir la regla de match exacto normalizado contra el cliente real `ALCAPA SPORT SL`.
  - No se corrigio automaticamente el posible typo del dato manual.
- `JOSEFA LLAS GRANOT`
  - No existe match seguro con clientes actuales.
  - No se reutilizo `Josefa Mas Grassot` por no ser el mismo nombre.

## Conflictos detectados

- Conflictos de `tax_id`: 0
- Conflictos de `billing_address`: 0
- Conflictos de match ambiguo: 0

## Confirmaciones de seguridad

- No se modifico ningun `full_name`.
- No se crearon clientes nuevos.
- No se sobrescribio ningun `tax_id` existente con un valor distinto.
- No se sobrescribio ninguna `billing_address` existente con un valor distinto.
- Todos los updates pasaron por `clientWriteApi.ts`.

## Verificacion posterior

Lectura posterior confirmada en `clients`:

- `CLI-0016` `Pink Elephant SL` -> `B44857639`
- `CLI-0015` `D. DAVID MOLINA BOZA` -> `46134579Y`
- `CLI-0014` `CARLOS ENRIQUE MARQUEZ RIDAO` -> `Y7108903P`
- `CLI-0005` `GILFIT SPORTS SLU` -> `B67102970`
- `CLI-0007` `GURI, TEIXIDO I ASSOCIATS SL` -> `B08966095`
- `CLI-0009` `FUSTERIA PINEDA MAR SL` -> `J63973721`
- `CLI-0008` `FUNDACION PRIVADA GENTIS` -> `G17679267`
- `CLI-0006` `FLEXICAR INTERNACIONAL SL` -> `B09758327`

## Validaciones ejecutadas

- `npm run lint`
- `npm run build`
- `npm run test`
