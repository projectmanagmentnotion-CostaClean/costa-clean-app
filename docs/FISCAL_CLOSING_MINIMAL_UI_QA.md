# Fiscal Closing Minimal UI QA

## Fecha

- 2026-07-08

## Alcance

- `src/pages/FiscalClosingPage.tsx`
- `src/features/closing/fiscalSemesterAudit.ts`
- `src/features/closing/fiscalSemesterAudit.test.ts`
- `scripts/ops/audit-fiscal-second-semester.mjs`

## Regla de producto validada

- el cierre fiscal no abre como informe decorativo
- la primera lectura debe resolver el importe real exacto del periodo
- el resto del detalle queda plegado o fuera del flujo principal

## Cambios validados por codigo

- `ExecutiveHeader` abre con `Importe real del segundo semestre`
- el KPI dominante del primer bloque es `Total facturado`
- `Base imponible`, `IVA`, `Facturas emitidas`, `Cobrado` y `Pendiente` se mueven a `Desglose real`
- las vistas alternativas del motor quedan en `Motor fiscal completo`
- el listado definitivo de facturas emitidas queda en una seccion colapsable independiente

## Validacion viva ejecutada

- servidor local confirmado en `http://127.0.0.1:4173/`
- respuesta HTTP `200 OK` confirmada el `2026-07-08`
- acceso vivo confirmado hasta la pantalla de auth del entorno local

## Bloqueo real encontrado

- la app viva abre primero en auth
- no fue posible completar la comprobacion visual autenticada de `?view=fiscal_closing` desde el navegador automatizado sin introducir un bypass de sesion
- por normas del repo y de seguridad, no se modifico auth ni se forzo un atajo de acceso para esta QA

## Estado de QA

- QA funcional de datos: verificada con datos reales
- QA de build: verificada
- QA visual viva autenticada del modulo: pendiente por sesion de navegador
- QA visual no autenticada: confirmada hasta pantalla de acceso local

## Fiscal Closing Tablet QA Fix

- Fallo detectado: `tablet / fiscal_closing / fiscalRealAmountVisible`
- Diagnostico final:
  - el total real ya estaba visible en el primer viewport tablet
  - la regresion estaba en el selector del harness, que tomaba el primer importe con `€` en vez del bloque fiscal real
- Cambio aplicado:
  - se anadio una marca estable al bloque `Total facturado real` del `ExecutiveHeader`
  - el harness paso a validar ese bloque concreto
- Resultado:
  - `390x844`, `768x1024` y `1366x900` pasan en `fiscal_closing`
  - `npm run qa:visual:auth` termina con `240/240`
- No cambios en datos:
  - sin tocar importes
  - sin tocar calculos
  - sin tocar contratos

## No objetivos respetados

- sin cambios en auth
- sin cambios en rutas ni `?view=`
- sin cambios en Supabase, SQL, RPC o logica fiscal critica
