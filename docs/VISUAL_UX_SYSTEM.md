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

### Facturas

Uso recomendado futuro:
`ExecutiveHeader` + `VisualKpiCard` + `SeverityBadge` para cobro pendiente, vencidas y listas para emitir.

### Presupuestos

Uso recomendado futuro:
`ExecutiveHeader` + `VisualKpiCard` + `ActionChecklist` para seguimiento y conversion.

### Servicios

Uso recomendado futuro:
`ExecutiveHeader` + `ActionChecklist` + `WorkspaceSummary` ligero para trabajo sin facturar o sin cerrar.

### Gastos

Uso recomendado futuro:
`ExecutiveHeader` + `VisualKpiCard` + `SeverityBadge` + `ProgressMetric` para soporte, revision y riesgo.

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
