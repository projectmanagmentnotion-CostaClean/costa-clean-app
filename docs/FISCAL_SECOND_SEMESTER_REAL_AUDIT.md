# Fiscal Second Semester Real Audit

## Fecha

- 2026-07-08

## Objetivo

Convertir `FiscalClosingPage` en una pantalla de decision para el segundo semestre: primero el importe real exacto del periodo y despues, solo bajo colapso, el resto del contexto fiscal.

## Fuente usada

- `src/features/closing/fiscalSemesterAudit.ts`
- `scripts/ops/audit-fiscal-second-semester.mjs`
- datos reales leidos desde Supabase con el mismo contrato publico de la app

## Criterio de inclusion

- periodo fijo: `YYYY-07-01` a `YYYY-12-31`
- se cuentan facturas con `issue_date` dentro del rango
- se cuentan solo estados emitidos reales: `issued`, `paid`
- se excluyen canceladas, archivadas, borradas y registros fuera de rango

## Resultado real actual

### Segundo semestre 2026

- facturas emitidas incluidas: `0`
- base imponible: `0,00 €`
- IVA: `0,00 €`
- total facturado real: `0,00 €`
- cobrado: `0,00 €`
- pendiente: `0,00 €`

## Decision de UX derivada

- el primer viewport no debe abrir como informe largo
- el bloque dominante debe ser `Total facturado real`
- base, IVA, facturas emitidas, cobrado y pendiente pasan a `Desglose real`
- mes, trimestre, anio y rango personalizado quedan fuera del flujo principal bajo `Motor fiscal completo`

## Confirmacion de discrepancia externa abril-junio 2026

Se reviso tambien la discrepancia reportada en correo para abril-junio 2026.

- base imponible real: `12.406,50 €`
- IVA real: `2.605,35 €`
- total facturado real: `15.011,85 €`
- facturas emitidas incluidas: `27`

Conclusiones:

- `12.406,50 €` coincide con la base, no con el total facturado.
- `14.902,95 €` tampoco es correcto como total emitido.
- la diferencia entre `15.011,85 €` y `14.902,95 €` es `108,90 €`.
- esa diferencia coincide con la factura `2026-041` de `Miguel Angel Flores Castillo`, fechada el `2026-06-01`, con base `90,00 €`, IVA `18,90 €` y total `108,90 €`.

## Riesgos y limites

- la verificacion del dato es real; la verificacion visual autenticada del shell sigue dependiendo de sesion valida en navegador
- no se tocaron rutas, auth, Supabase, SQL, numeracion ni write paths

## Fiscal Closing Tablet QA Fix

- El fix del `2026-07-08` no altera este audit ni sus importes.
- La correccion fue solo de deteccion visual estable del bloque `Total facturado real` en tablet.
