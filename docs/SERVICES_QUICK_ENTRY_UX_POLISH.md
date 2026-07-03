# Services Quick Entry UX Polish

## Estado anterior

Antes de Sprint 10, `Servicios` ya tenia una base operativa potente:

- `JobsPage` con hero, KPIs, duplicados, alta en overlay y listado
- `JobsList` con toolbar reutilizable
- `JobWorkspace` con tabs de resumen, operativa, facturacion y actividad
- `JobCreateFlow` ya montado sobre `FullscreenStepFlow`

La deuda real no era ausencia de flujo, sino exceso de protagonismo simultaneo:

- el CTA principal del modulo podia competir con prioridades operativas cambiantes
- la lista no usaba todavia filtros tan directos para agenda diaria
- el alta estaba ya en StepFlow, pero el modulo no dejaba una salida de exito tan clara al volver
- el workspace podia mostrar antes cliente, propiedad, agenda y situacion de cobro sin obligar a abrir contexto extra

## Archivos auditados

- `src/pages/JobsPage.tsx`
- `src/features/jobs/JobsList.tsx`
- `src/features/jobs/JobWorkspace.tsx`
- `src/features/jobs/JobDetailCard.tsx`
- `src/features/jobs/JobCreateFlow.tsx`
- `src/features/jobs/JobCreateForm.tsx`
- `src/features/jobs/jobCreatePrefill.ts`
- `src/features/jobs/jobBilling.ts`
- `src/features/jobs/jobWriteApi.ts` solo para auditar y confirmar zona protegida
- `src/features/jobs/useJobWorkspaceNavigation.ts`
- `src/features/jobs/types.ts`

## Mapa de acciones sensibles

- Crear servicio:
  - `src/pages/JobsPage.tsx`
  - `src/features/jobs/JobCreateFlow.tsx`
  - `src/features/jobs/JobCreateForm.tsx`
  - write path protegido en `src/features/jobs/jobWriteApi.ts`

- Editar servicio:
  - `src/features/jobs/JobWorkspace.tsx`
  - `src/features/jobs/JobDetailCard.tsx`
  - `src/features/jobs/jobWriteApi.ts`

- Cambiar estado:
  - `src/features/jobs/JobCreateFlow.tsx`
  - `src/features/jobs/JobDetailCard.tsx`

- Preparar base de facturacion:
  - `src/features/jobs/JobCreateFlow.tsx`
  - `src/features/jobs/JobDetailCard.tsx`
  - `src/features/jobs/jobBilling.ts`

- Conectar con presupuesto:
  - `src/features/jobs/jobCreatePrefill.ts`
  - `src/features/jobs/JobsList.tsx`
  - `src/features/jobs/JobWorkspace.tsx`

- Conectar con factura:
  - `src/features/jobs/JobWorkspace.tsx`
  - prefill hacia `InvoiceCreateFlow`

- Conectar con cobro:
  - `src/features/jobs/JobWorkspace.tsx`
  - flujo delegado a `PaymentCreateFlow`

- Revisar duplicados:
  - `src/pages/JobsPage.tsx`
  - `src/features/jobs/JobCreateFlow.tsx`
  - `src/features/duplicates/*`

## Decision tecnica

Decision tomada: **StepFlow existente refinado, con launcher rapido desde el modulo**.

No se crea un segundo QuickFlow paralelo.

Motivo:

- `JobCreateFlow.tsx` ya usa `FullscreenStepFlow`
- el alta de servicio ya tiene varias decisiones reales: contexto, agenda, base de facturacion y revision
- crear un formulario corto paralelo duplicaria reglas, estado y contexto
- el riesgo del modulo esta en sus relaciones con presupuesto, factura, cobro y lineas de facturacion, no en el shell visual del flujo

Resultado:

- el alta sigue sobre el StepFlow oficial
- la portada del modulo enfatiza mejor `Registrar servicio`
- el modulo gana una salida de exito corta al volver del flujo
- el workspace muestra mejor el siguiente paso sin tocar persistencia

## Cambios UX aplicados

- `JobsPage` deja una accion primaria mas clara para alta rapida:
  - `Registrar servicio`

- La accion secundaria queda subordinada a la prioridad operativa real:
  - abrir listo para facturar
  - abrir agenda de hoy
  - o ver pendientes

- La banda KPI se simplifica y deja fuera el bloque menos critico de `Proximos servicios` para reducir ruido.

- El modulo ahora muestra un success state corto tras crear servicio:
  - confirma el registro
  - permite abrir el servicio recien creado
  - o seguir operando sin reabrir el flujo

- `JobsList` mantiene la barra unificada, pero ajusta filtros mas operativos:
  - `Todos`
  - `Activos`
  - `Hoy`
  - `Pendientes`
  - `En curso`
  - `Completados`
  - `Con alerta`
  - `Sin facturar`
  - `Cancelado`
  - `Archivados`

- `JobsList` alinea estados `empty` y `error` con el design system usando `DSEmptyState` y `DSErrorState`.

- `JobsList` anade una lectura breve de resultados visibles con copy mas centrada en agenda diaria.

- `JobWorkspace` deja visible antes:
  - cliente
  - propiedad
  - fecha/agenda
  - situacion actual
  - estado de facturacion / cobro

- El toggle de contexto ampliado del workspace queda mas explicito sobre origen, propiedad y facturacion extendida.

- `JobCreateFlow` mantiene el StepFlow oficial pero afina la lectura:
  - pasos con labels mas cortos
  - copy mas directa de salida rapida
  - CTA final mas clara: `Guardar y volver`
  - paso de base de cobro con subtotal mas visible antes del guardado

## Logica preservada

Se mantiene intacto:

- `saveJobWithLines`
- `buildJobBillingSummary`
- `jobWriteApi`
- `jobBilling`
- `jobCreatePrefill`
- deteccion de duplicados
- navegacion de workspace por query params `job` y `jobTab`
- relaciones servicio -> presupuesto
- relaciones servicio -> factura
- relaciones servicio -> cobro
- lineas de facturacion persistidas
- validaciones funcionales del flujo y del detalle

## Que no se toco

- Supabase
- SQL
- RPC
- migrations
- auth
- rutas
- sistema `?view=`
- `appDataApi`
- `financialWriteApi`
- facturas
- numeracion de facturas
- logica fiscal
- persistencia
- contratos de datos
- reglas de negocio de servicios
- reglas de horas
- reglas de pagos
- reglas de salarios
- reglas de facturacion

## Riesgos pendientes

- `JobDetailCard.tsx` sigue siendo una superficie grande y sensible porque mezcla edicion, lifecycle y lineas persistidas.
- El modulo sigue conectado a presupuesto, factura y cobro dentro del mismo workspace; la mejora de Sprint 10 es de jerarquia, no de desacople estructural.
- No se detecto una UI dedicada de horas en `src/features/jobs`; si existe el dominio fuera de esta superficie, merece auditoria separada antes de introducir copy o resumenes engañosos.
- Sigue habiendo un backup versionado en `src/features/jobs/JobDetailCard.tsx.bak-20260325-release-polish`, que solo se documenta y no se elimina en este sprint.

## Recomendaciones futuras

1. Si servicios vuelve a crecer, separar mejor `agenda`, `edicion` y `facturacion` en superficies aun mas cortas.
2. Si aparece una captura real de horas/equipo, tratarla como flujo propio y no mezclarla de forma oportunista en este mismo workspace.
3. Reusar el patron de salida de exito corta en pagos y gastos para mantener continuidad operacional en Sprint 11.
