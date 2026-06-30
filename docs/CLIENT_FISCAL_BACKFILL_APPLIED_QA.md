# Client Fiscal Backfill Applied QA

Fecha: 2026-06-30

## Resumen ejecutivo

- Se auditaron las facturas `issued`/`paid` reales accesibles por la app.
- No se aplico ningun update en `clients`.
- Motivo real: el historico actual no contiene snapshot fiscal estructurado en `pricing_metadata`.
- No se inventaron datos, no se parseo texto libre y no se sobrescribio ningun campo existente.

## Fuente usada

- `clients` via REST de Supabase con la misma configuracion publica del repo.
- `invoices` via REST de Supabase con `status` real y `pricing_metadata` real.
- Utilidades revisadas:
  - `src/features/clients/clientFiscalData.ts`
  - `src/features/clients/clientFiscalBackfill.ts`
  - `src/features/clients/clientWriteApi.ts`
  - `src/app/appDataApi.ts`

## Facturas revisadas

- Total de facturas revisadas: 43
- Facturas `issued` o `paid`: 43
- Facturas `issued` o `paid` con `client_id`: 43
- Facturas `issued` o `paid` con snapshot fiscal estructurado: 0
- Facturas `issued` o `paid` sin snapshot fiscal estructurado: 43

## Clientes actualizados

- Clientes actualizados: 0
- Campos aplicados por cliente: ninguno

## Clientes omitidos

- `CLI-0019` `Miguel Da Costa`
  - Motivo: `no_issued_invoices`
- `CLI-0018` `Patricia`
  - Motivo: `no_issued_invoices`
- `CLI-0016` `Pink Elephant SL`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0026`
- `CLI-0010` `MOTORWAGEN SPAIL SL`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0007`
- `CLI-0011` `ESTRUCTURAS PINEDA S.L.`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0008`
- `CLI-0014` `CARLOS ENRIQUE MARQUEZ RIDAO`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0024`
- `CLI-0004` `ALCAPA SPORT SL`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0040`, `INV-0027`, `INV-0014`, `INV-0021`, `INV-0001`
- `CLI-0012` `Josefa Mas Grassot`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0034`, `INV-0033`, `INV-0009`, `INV-0023`
- `CLI-0015` `D. DAVID MOLINA BOZA`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0025`
- `CLI-0005` `GILFIT SPORTS SLU`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0039`, `INV-0028`, `INV-0013`, `INV-0022`, `INV-0002`
- `CLI-0006` `FLEXICAR INTERNACIONAL SL`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0037`, `INV-0029`, `INV-0012`, `INV-0017`, `INV-0003`
- `CLI-0007` `GURI, TEIXIDO I ASSOCIATS SL`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0036`, `INV-0030`, `INV-0004`, `INV-0020`, `INV-0015`
- `CLI-0008` `FUNDACION PRIVADA GENTIS`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0042`, `INV-0035`, `INV-0031`, `INV-0005`, `INV-0016`, `INV-0018`
- `CLI-0009` `FUSTERIA PINEDA MAR SL`
  - Motivo: `no_structured_fiscal_data`
  - Facturas: `INV-0038`, `INV-0032`, `INV-0019`, `INV-0006`, `INV-0011`

## Conflictos detectados

- Conflictos detectados: 0

## Facturas sin snapshot fiscal estructurado

- Todas las 43 facturas `issued`/`paid` revisadas quedaron en este grupo.
- Muestras verificadas manualmente:
  - `INV-0048`
  - `INV-0042`
  - `INV-0041`
  - `INV-0040`
  - `INV-0039`

## No sobrescritura confirmada

- No se sobrescribio ningun `tax_id` existente.
- No se sobrescribio ninguna `billing_address` existente.
- No se altero ningun `full_name` existente.
- No se aplicaron conflictos automaticamente.

## Estado activo confirmado

- No hubo clientes actualizados, asi que no hubo cambios de estado efectivos.
- La utilidad de backfill quedo preparada para forzar `status: active` solo en clientes realmente actualizados.

## Casos conocidos verificados

- `CLI-0021` `Miguel Angel Flores Castillo`
  - Ya estaba completo y activo con `tax_id` `52755379A`.
- `CLI-0020` `Miguel Angel Flores Novoa`
  - Ya estaba completo y activo con `tax_id` `45962701F`.
- Ninguno de los dos requirio backfill.

## Limitaciones

- El historico actual de facturas no trae `client_fiscal_snapshot` ni campo estructurado equivalente visible en `pricing_metadata`.
- Por esa limitacion, el sprint no podia completar clientes historicos sin inventar datos.
- La corrida real se cerro en modo seguro: auditada, no destructiva y sin cambios sobre datos productivos.

## Referencia posterior

- Ver tambien `docs/CLIENT_FISCAL_MANUAL_BACKFILL_APPLIED_QA.md`.
- Ese sprint posterior completo manualmente 8 clientes existentes usando una tabla fiscal aportada por el usuario, sin tocar nombres ni crear clientes nuevos.

## Validaciones ejecutadas

- `npm run lint`
- `npm run build`
- `npm run test`
