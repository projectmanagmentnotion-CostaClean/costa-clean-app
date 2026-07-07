# Mobile Scroll Reduction QA

## Contexto

Sprint ejecutado a partir de capturas reales de iPhone del `2026-07-07`.

Problemas observados:

- Home seguia viendose alto y con demasiada lectura visible.
- Clientes y propiedades mostraban demasiada metadata por card.
- Facturas mantenia detalle demasiado abierto y acciones muy presentes.
- Cierre fiscal seguia entrando como informe largo.
- StepFlow conservaba demasiado header/contexto/footer.

## Superficies auditadas

- `Home`
- `DSListControlBar` y listas operativas
- `ClientsList`
- `PropertiesList`
- `InvoicesList`
- `InvoiceDetailCard`
- `FiscalClosingPage`
- `FiscalPeriodSelector`
- `FullscreenStepFlow`
- capas compartidas de shell, cards y visual system

## Cambios aplicados

- Se añaden tokens moviles iPhone y safe space inferior.
- Se compactan cards, toolbar, KPI cards, headers visuales y footers sticky.
- `ClientsList` y `PropertiesList` pasan a lectura operativa compacta.
- `InvoiceDetailCard` deja visible la lectura principal y mueve detalle/gestion/contexto bajo colapso.
- `FiscalClosingPage` mueve base, checklist, snapshot e informe integral a secciones plegadas.
- `FiscalPeriodSelector` gana selector compacto para mobile.
- `FullscreenStepFlow` reduce header, copy, contexto y footer en narrow screens.

## Que se colapso

- Detalle adicional de cobro en factura
- Documento y gestion en factura
- Contexto de factura
- Base del periodo en cierre fiscal
- Checklist y fuentes en cierre fiscal
- Configuracion y snapshot en cierre fiscal
- Informe integral del periodo

## Que se movio a lectura secundaria

- metadata extra de clientes
- metadata extra de propiedades
- warning/detail de cobro no dominante
- contexto documental y notas largas

## Pendiente

- QA visual real autenticada en viewport `390x844`
- ajuste fino de algunos textos con encoding heredado en modulos legacy
- confirmar con navegador que la nueva compactacion no deja una regresion puntual de spacing en desktop

## Limitacion de QA

En este sprint hubo auditoria real por screenshots y auditoria de codigo/CSS, pero no QA visual autenticada end-to-end en navegador local sobre todos los modulos. Si aparece desviacion puntual en una superficie no abierta en estas capturas, debe tratarse como follow-up de ajuste fino, no como cambio de dominio.

## QA visual autenticada iPhone 390x844

### Pantallas revisadas

- `Home`
- `Clientes`
- `Propiedades`
- `Facturas` listado operativo
- `Facturas` StepFlow de nueva factura
- `Gastos`
- `Cierre fiscal`
- bottom nav y header/shell movil compartido

### Problemas encontrados

- La cabecera movil superior heredaba anchos de acciones de desktop y podia desbordarse visualmente en la parte derecha.
- El StepFlow real de `Nueva factura` seguia mostrando progreso horizontal con scroll lateral en `390x844`.
- No se reprodujo scroll horizontal global en `Home`, `Clientes`, `Propiedades`, `Facturas`, `Gastos` ni `Cierre fiscal`.

### Correcciones aplicadas

- Se compacta la cabecera `.cc-mobile-shell-header` para fijar ancho real de theme toggle y alertas en mobile y eliminar el desborde superior.
- El progreso movil de `FullscreenStepFlow` pasa a una cuadricula compacta de dos columnas en narrow screens para eliminar el scroll lateral.

### Problemas pendientes

- El detalle profundo de factura sigue dependiendo de una superficie larga y sensible; en esta pasada se verifico la lectura compacta del modulo y del StepFlow, pero no se rediseño el workspace.
- Queda repetir smoke visual breve en `375x812` y `430x932` si se abre un bloque exclusivo de QA cross-device.

### Limitaciones reales

- La QA autenticada se hizo en navegador local sobre sesion real y viewport principal `390x844`.
- No se tocaron Supabase, SQL, RPC, migrations, auth, rutas, `?view=`, `appDataApi`, `financialWriteApi`, numeracion, fiscalidad, calculos, persistencia ni contratos.

### Screenshots

- Capturas reales en sesion autenticada tomadas durante la QA local del `2026-07-07` sobre `http://127.0.0.1:5173/`.

## Guardrail de desencapsulacion

- Si una seccion puede vivir en la misma superficie, no crear otra card interna.
- En mobile/iPad, el ancho util debe reservarse para contenido y accion, no para wrappers.
- Si aparecen cajas dentro de cajas para explicar un mismo detalle, la vista falla QA y debe simplificarse antes de escalar.

## Actualizacion cross-module 2026-07-07

- La validacion viva ahora incluye `payments`, `clients`, `properties`, `dashboard` y `fiscal_closing`.
- `Registrar cobro` confirma visibilidad inmediata del primer campo en mobile e iPad.
- Se detecta y resuelve un overflow horizontal real del shell en iPad; el problema no estaba en los modulos sino en la capa superior compartida.
