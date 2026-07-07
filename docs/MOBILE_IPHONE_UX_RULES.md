# Mobile iPhone UX Rules

## Objetivo

Definir la capa explicita de densidad iPhone para que la app deje de comportarse como un informe largo en mobile.

## Breakpoints

- `mobile-xs`: `320px` a `374px`
- `mobile`: `375px` a `430px`
- `mobile-lg`: `431px` a `480px`
- `tablet`: `768px+`

## Tokens base

- `--ds-mobile-page-padding`
- `--ds-mobile-card-padding`
- `--ds-mobile-gap`
- `--ds-mobile-title-size`
- `--ds-mobile-card-title-size`
- `--ds-mobile-body-size`
- `--ds-mobile-helper-size`
- `--ds-mobile-kpi-size`
- `--ds-mobile-button-height`
- `--ds-mobile-chip-height`
- `--ds-mobile-bottom-nav-safe-space`

## Tipografia

- Titulo de pantalla: `20px` a `22px`
- Titulo de card: `15px` a `16px`
- Texto base: `13px` a `14px`
- Texto helper: `12px`
- Labels caps: `10px` a `11px`
- KPI principal visible: `24px` a `30px`

## Espaciado y targets

- Padding de pagina: `12px`
- Padding de card: `12px`
- Gap principal: `8px` a `12px`
- Boton minimo: `44px` a `48px`
- Chip compacto: `32px` a `36px`
- Safe space inferior obligatorio si existe bottom nav sticky

## Home

- El primer viewport debe resolver header corto, KPI dominante, KPIs secundarios y acciones.
- No abrir con textos explicativos largos.
- No mostrar listas largas ni colas operativas dentro de Inicio.
- Charts secundarios deben quedar compactos y debajo del cockpit principal.

## Listas y filtros

- Una lista = una barra compacta.
- Busqueda primero.
- En mobile solo deben verse 2 chips rapidos como maximo antes de abrir filtros.
- Orden y filtros avanzados deben vivir en sheet.
- Metadata secundaria debe truncarse o resumirse antes de crecer en altura.

## Factura detalle

- Hero y cobro primero.
- Gestion y contexto bajo colapso o `Mas`.
- No repetir documento, servicio, estado y notas en varias cards abiertas.
- Si una accion no es primaria, no debe competir visualmente con cobro.

## Cierre fiscal

- Arriba solo estado, periodo, indicadores clave y CTA.
- Selector de periodo compacto.
- Checklist, base documental, snapshot e informe integral: colapsados por defecto.
- Copy prudente: nunca vender cierre definitivo desde mobile.

## StepFlow

- Header maximo corto.
- Descripcion visible solo si aporta contexto inmediato.
- Stepper compacto horizontal.
- Resumen lateral bajo colapso.
- Footer sticky compacto con safe area.

## Anti-patrones prohibidos

- Cards gigantes en mobile
- Filtros largos abiertos debajo del buscador
- Dos acciones primarias visibles en una card compacta
- Informe completo antes de la decision principal
- Scroll infinito dentro de Home o detalle
- Bottom nav tapando contenido

## Checklist iPhone

- Primer viewport con decision clara
- Sin scroll horizontal accidental
- Sin texto desbordado
- Sin numeros truncados
- Sin chips o botones inflando altura innecesaria
- Sin bloques largos abiertos por defecto en factura o cierre fiscal
