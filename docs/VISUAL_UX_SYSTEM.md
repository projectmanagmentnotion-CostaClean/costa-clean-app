# Visual UX System

## 1. Principio general

"Menos lectura. Mas senal. Mas accion."

El sistema visual no busca decorar la app. Busca que cada pantalla responda rapido:

- Que pasa.
- Que implica.
- Que hago ahora.

## 2. Reglas de pantalla

- Una prioridad principal por vista.
- 3-5 KPIs maximos en primer nivel. Excepcionalmente 6 si el modulo ya necesita esa lectura y sigue siendo claro.
- Los detalles largos van bajo demanda.
- La accion debe vivir cerca del problema.
- Visual primero, texto despues.
- El primer scroll debe enseñar decision, no contexto sobrante.

## 3. Componentes creados

### `ExecutiveHeader`

Objetivo:
Unificar la cabecera ejecutiva de los modulos con una prioridad principal clara.

Props principales:
`title`, `eyebrow`, `summary`, `statusLabel`, `statusTone`, `primaryAction`, `secondaryAction`, `metricLabel`, `metricValue`, `metricHint`, `children`.

Cuando usarlo:
En cabeceras de modulo que necesiten una lectura corta, una accion dominante y un estado visible.

Cuando no usarlo:
En directorios simples o vistas tecnicas donde una cabecera grande solo añadiria ruido.

### `VisualKpiCard`

Objetivo:
Estandarizar KPIs con tono, prioridad y posible accion.

Props principales:
`label`, `value`, `hint`, `tone`, `priority`, `badgeLabel`, `progress`, `action`, `children`.

Cuando usarlo:
Cuando el KPI cambia una decision real o dirige la siguiente accion.

Cuando no usarlo:
Para contadores decorativos o metricas que no cambian nada.

### `SeverityBadge`

Objetivo:
Unificar criticidad y estado compacto en Home, Alertas, Cierre fiscal y futuros warnings.

Props principales:
`label`, `tone`.

Cuando usarlo:
Para severidad, readiness, confianza, riesgo o estados muy cortos.

Cuando no usarlo:
Para explicar contenido largo o sustituir texto necesario.

### `ActionChecklist`

Objetivo:
Mostrar avance, bloqueo o siguientes pasos en lectura ejecutiva.

Props principales:
`items`, `compact`.

Cada item soporta:
`id`, `state`, `label`, `description`, `action`.

Cuando usarlo:
Para preparar cierres, revisar alertas o enseñar que falta para avanzar.

Cuando no usarlo:
Como sustituto de una tabla larga o de un historial completo.

### `ProgressMetric`

Objetivo:
Mostrar cobertura o avance con una barra simple y semantica.

Props principales:
`label`, `value`, `max`, `percent`, `tone`, `hint`.

Cuando usarlo:
Para cobertura documental, readiness o avance con dato real.

Cuando no usarlo:
Con porcentajes inventados o graficas que aparenten precision falsa.

### `InsightPanel`

Objetivo:
Reducir bloques largos de texto a una lectura ejecutiva corta.

Props principales:
`title`, `insight`, `implication`, `action`, `tone`.

Cuando usarlo:
Para explicar una decision, una alerta o una interpretacion asistiva.

Cuando no usarlo:
Para volcar textos largos o narrativas completas.

### `CollapsibleDetailSection`

Objetivo:
Normalizar detalles bajo demanda sin mantener listas abiertas por defecto.

Props principales:
`title`, `count`, `defaultOpen`, `tone`, `children`.

Cuando usarlo:
Para incidencias, revisadas, desgloses y detalles que no deben competir con el primer nivel.

Cuando no usarlo:
En contenido critico que deba verse siempre sin interaccion.

## 4. Reglas de color

- `success`: listo, correcto, controlado.
- `warning`: requiere revision o seguimiento.
- `critical`: bloqueo real o riesgo fuerte.
- `info`: contexto operativo util.
- `neutral`: contexto secundario o estado base.

El color comunica estado. No debe usarse como decoracion gratuita.

## 5. Reglas de KPIs

- KPI solo si cambia una decision.
- No KPIs decorativos.
- Maximo recomendado: 3-5 en primer nivel.
- Si una vista ya tiene 6 y sigue siendo clara, debe ser la excepcion, no la norma.
- Cada KPI debe tener una etiqueta corta y un hint breve.

## 6. Reglas de checklist

- Usarlo para avance, preparacion o bloqueo.
- No usarlo como tabla larga.
- Maximo recomendado visible: 5-7 items.
- Si hay mas, compactar o enlazar a detalle.

## 7. Reglas de progress bars

- Usarlas para cobertura, readiness y avance real.
- Sin librerias de chart nuevas.
- Sin datos falsos ni mock no marcado.
- Si el porcentaje es una aproximacion interna, debe quedar claro en el hint.

## 8. Reglas de IA e insights

- La IA interpreta, no calcula.
- Siempre mostrar confianza o limites cuando aplique.
- No vender verdad fiscal definitiva.
- No afirmar IVA definitivo, deducibilidad definitiva, margen neto definitivo ni cierre definitivo sin validacion profesional.

## 9. Ejemplos de uso por modulo

### Home

- `ExecutiveHeader` para prioridad principal.
- `VisualKpiCard` para 4 KPIs de decision.
- `InsightPanel` para resumir prioridad sin volver a cargar copy largo.

### Alertas

- `ExecutiveHeader` para explicar la cola.
- `VisualKpiCard` para resumen corto.
- `SeverityBadge` para buckets y tarjetas.
- `ActionChecklist` para lectura ejecutiva.
- `CollapsibleDetailSection` para revisadas.

### Cierre fiscal

- `ExecutiveHeader` para readiness del periodo.
- `VisualKpiCard` para facturado, cobrado, pendiente, gastos, IVA neto estimado e incidencias.
- `ProgressMetric` para cobertura y preparacion.
- `ActionChecklist` para pendientes reales.
- `CollapsibleDetailSection` para desglose e incidencias.

## Invoices and Payments Pattern

### Facturas

Uso recomendado:
`ExecutiveHeader` + `VisualKpiCard` + `ActionChecklist` para pendiente de cobro, cobrado registrado, facturas abiertas y borradores por emitir.

Reglas:

- La prioridad principal es el cobro pendiente real, no el volumen decorativo.
- Maximo 4 KPIs arriba.
- No elevar `vencidas`, morosidad ni previsiones de caja si no existe `due_date` fiable ni reconciliacion real.
- La accion dominante debe abrir cobro o seguimiento de una factura abierta.
- La emision directa puede existir, pero en segundo nivel visual.

### Pagos

Uso recomendado:
`ExecutiveHeader` ligero + `VisualKpiCard` compactas para auditoria de cobros registrados.

Reglas:

- `Pagos` es modulo auxiliar y no debe competir con `Facturas`.
- Mostrar solo trazabilidad real: cobros registrados, facturas con cobro y origen manual/automatico si existe.
- No presentar conciliacion bancaria, previsiones ni salud de caja si el sistema no lo soporta de forma fiable.

## Quotes Pattern

### Presupuestos

Uso recomendado:
`ExecutiveHeader` + `VisualKpiCard` + `ProgressMetric` + `ActionChecklist`.

Reglas:

- La prioridad principal es convertir aceptados reales a operativa.
- Estados reales usados: `draft`, `sent`, `accepted`, `rejected`, `expired`.
- Solo elevar `aceptados sin convertir`, `aceptados sin factura` o `enviados por seguir` cuando existan con dato real.
- El valor destacado puede ser `potencial bloqueado` solo sobre aceptados sin servicio o total aceptado visible.
- No inventar forecast comercial, scoring ni tasa de conversion global si la base no es madura.

## Jobs Pattern

### Servicios

Uso recomendado:
`ExecutiveHeader` + `VisualKpiCard` + `ActionChecklist`.

Reglas:

- La lectura principal es agenda de hoy, operativa abierta y trabajo completado sin facturar.
- Estados reales usados: `scheduled`, `in_progress`, `completed`, `cancelled`.
- `Trabajo sin facturar` solo si existe `invoice_id` o ausencia fiable de factura vinculada.
- `Servicios de hoy` solo si `scheduled_date` existe y es util.
- No inventar horas reales, coste laboral, payroll ni margen por servicio.

## Expenses Pattern

### Gastos

Uso recomendado:
`ExecutiveHeader` + `VisualKpiCard` + `ProgressMetric` + `ActionChecklist`.

Reglas:

- La prioridad principal es soporte documental y revision fiscal interna.
- Los indicadores superiores deben salir de `document_support_status`, `fiscal_review_status`, `fiscal_risk_level` y resumen determinista.
- Copy prudente: `deducible estimado`, `requiere revision`, `riesgo fiscal interno`.
- No afirmar deducibilidad definitiva, IVA definitivo ni cierre validado.

## Clients and Properties Pattern

### Clientes

Uso recomendado:
`ExecutiveHeader` compacto + `VisualKpiCard` compactas solo si empujan una accion real.

Reglas:

- Es un directorio operativo, no un dashboard principal.
- Solo elevar saldo pendiente, planes recurrentes vencidos o volumen operativo si cambian la accion siguiente.
- La CTA principal puede abrir un workspace con pendiente real o crear cliente nuevo.

### Propiedades

Uso recomendado:
`ExecutiveHeader` compacto + `VisualKpiCard` compactas.

Reglas:

- La pantalla debe actuar como acceso rapido a workspace, no como tablero decorativo.
- Solo elevar servicios, presupuestos, facturas o saldo pendiente si ya existen relaciones reales.
- Evitar KPIs que no cambian una accion.

## Fiscal Integral Report Pattern

Uso recomendado:
Bloque interno dentro de `FiscalClosingPage` apoyado en `VisualKpiCard` + `ActionChecklist`.

Reglas:

- El informe integral usa datos deterministas, readiness, warnings, `missingDataFlags` y notas IA bajo demanda.
- La IA interpreta, no recalcula importes.
- Debe incluir aviso de validacion profesional.
- Si la exportacion externa no soporta una nueva salida sin riesgo, se mejora la vista interna antes que forzar PDF nuevo.

## Simple Trends Pattern

Uso recomendado:
Solo cuando hay series historicas reales y la visualizacion aporta una decision clara.

Reglas:

- Sin librerias nuevas.
- Sin prediccion, forecast ni causalidad asistiva.
- Si la serie no es suficientemente robusta para una lectura operativa, documentar el limite y no pintar graficos falsos.

## Fiscal Closing Pattern

Estructura recomendada:

- Header ejecutivo en dos columnas.
- Tres cards principales maximo: estado del paquete, IVA a ingresar estimado, elementos por revisar.
- Metricas secundarias compactas debajo.
- Checklist y warnings en un segundo nivel claro.
- IA asistiva y detalles colapsables mas abajo.

Cards principales:

- `Estado del paquete`: readiness label, preparacion interna, hint corto y severidad.
- `IVA a ingresar estimado`: cifra dominante, badge `Estimado` y copy prudente.
- `Elementos por revisar`: volumen de pendientes y CTA real a la revision.

Cards secundarias:

- IVA repercutido.
- IVA deducible estimado.
- Cobertura documental.
- Facturas incluidas.
- Cobros incluidos.
- Gastos incluidos.
- Soportes IVA pendientes, si aplica.

Uso de `ProgressMetric`:

- Preparacion interna del cierre.
- Cobertura documental.
- Solo con datos reales o con indicador interno explicitamente marcado como tal.

Uso de `ActionChecklist`:

- Facturas incluidas.
- Cobros incluidos.
- Gastos incluidos.
- Soportes descargables.
- Soportes pendientes.
- Validacion IVA pendiente.
- Snapshot o paquete preparado cuando exista una accion real.

Uso de `CollapsibleDetailSection`:

- Datos insuficientes.
- Desglose trimestral.
- Incidencias completas.
- Riesgos o detalles largos de IA.

Copy prudente fiscal:

- Usar `IVA a ingresar estimado`.
- Usar `preparacion interna`.
- Usar `requiere validacion profesional`.
- Presentar la IA como `ayuda interna de preparacion`.

No debe afirmarse:

- IVA definitivo.
- Deducibilidad definitiva.
- Cierre fiscal definitivo.
- Margen neto definitivo.
- Payroll real, horas reales o coste laboral completo.
