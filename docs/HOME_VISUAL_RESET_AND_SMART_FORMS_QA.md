# Home Visual Reset And Smart Forms QA

## Problemas detectados en screenshots

- `Home` seguia comportandose como informe largo.
- `En marcha hoy` y `Alertas y revision` ocupaban demasiado scroll.
- `Caja por mover` seguia siendo un panel textual pesado.
- varias cards de Home seguian demasiado altas para un cockpit.
- el alta de cliente seguia sintiendose como panel largo con direccion poco estructurada.
- el autocomplete de conceptos seguia consumiendo demasiada altura.

## Bloques eliminados o sacados de Home

- hero grande con CTA principal y texto largo
- `Caja por mover` como panel textual largo
- `En marcha hoy` como cola operativa extensa
- `Alertas y revision` como listas largas
- repeticiones de alertas y servicios en la misma portada

## Estructura final de Home

1. Header minimo con titulo corto y estado.
2. Cockpit principal con:
   - KPI strip
   - quick actions dock
3. Grid de charts SVG/GSAP compactos.
4. Alerts summary compacto, sin lista larga.

## KPIs finales

- `Facturado`
- `Cobrado`
- `Gasto`
- `Revisar`

Todos quedan en cards compactas, con microestado y selector de periodo solo cuando el dato actual lo soporta sin tocar backend.

## Graficos finales

- `Facturado vs cobrado`
- `Carga inmediata`
- `Revision y soporte`

Reglas aplicadas:

- maximo 3 charts
- SVG ligero
- reveal corto GSAP
- sin parrafos largos
- empty states compactos

## Selector de periodo

Implementado mediante `HomePeriodSelector`.

Superficies con periodo seguro:

- KPI de `Facturado`
- KPI de `Cobrado`
- KPI de `Gasto`
- chart `Facturado vs cobrado`

Limitacion documentada:

- no todos los KPI/charts pueden ofrecer `Hoy / Semana / Mes / Trimestre / Ano` porque el repo no expone esas agregaciones de forma segura sin tocar logica de calculo o capas de datos
- donde no existe dato seguro, la vista se queda en `actual`, `mes`, `trimestre` o `total` segun el caso

## Sistema local de alert acknowledgements

Archivo:

- `src/features/alerts/alertAcknowledgements.ts`

Comportamiento:

- almacenamiento local en `costa-clean:alert-acknowledgements`
- estados:
  - `seen`
  - `snoozed`
  - `dismissed`
- afecta solo al ruido visual de `Home`
- no cambia el estado real de alertas
- no borra alertas reales
- alertas criticas no desaparecen por completo de Home mediante `dismissed`

## Formularios actualizados

- `ClientCreateForm`
- `PublicQuoteRequestForm`
- `PropertyCreateFlow`

Mejoras:

- `DSSmartLocationFields` como primitive oficial de CP/ciudad/provincia
- composicion mas corta de direccion fiscal en cliente sin cambiar el contrato persistido
- helpers y copy mas cortos
- autocomplete de conceptos con dropdown mas compacto

## CP / ciudad separado

Aplicado donde era seguro:

- intake publico
- alta de cliente
- alta de propiedad StepFlow

Limitacion:

- `PropertyCreateForm` legacy no se migro en esta fase para evitar mezclar esta pasada con otra superficie create legacy no prioritaria

## Concept autocomplete minimalista

Archivos base:

- `src/design-system/components/DSConceptAutocomplete.tsx`
- `src/design-system/components/DSInlineSuggestionList.tsx`
- `src/features/concepts/useRecentConceptSuggestions.ts`

Reglas aplicadas:

- maximo 5 sugerencias
- overlay compacto
- sin cards largas
- `Guardar frecuente` solo si el texto es razonable
- no se guardan conceptos sensibles o demasiado largos

## Que no se toco

- Supabase
- SQL
- RPC
- migrations
- auth
- rutas
- `?view=`
- `appDataApi`
- `financialWriteApi`
- numeracion de facturas
- fiscalidad
- calculos
- persistencia critica
- contratos de datos
- reglas de negocio

## Riesgos pendientes

- `Home` sigue dependiendo de agregados cross-module, aunque ya no los muestra como listas largas.
- el sistema local de acknowledgements reduce ruido en portada, pero no sustituye un sistema real de workflow o ownership de alertas.
- el cliente sigue persistiendo una sola cadena `billing_address`; la separacion visual es UX local, no modelo nuevo.
- `PropertyCreateForm` legacy queda pendiente de absorcion o retiro controlado.

## Recomendaciones futuras

- si en el futuro existe dato seguro semanal o anual, ampliar `HomePeriodSelector` sin tocar backend en el mismo sprint visual
- seguir retirando surfaces legacy create/edit antes de volver a introducir nuevos panels en Home
- mantener la regla: detalle dentro del modulo, no en portada
