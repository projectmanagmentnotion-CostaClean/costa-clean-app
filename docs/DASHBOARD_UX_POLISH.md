# Dashboard UX Polish

## Estado anterior resumido

Antes de Sprint 5, `src/pages/HomePage.tsx` ya tenia una base operativa fuerte, pero seguia abriendo con demasiadas capas de igual peso:

- `ExecutiveHeader` con CTA primaria y secundaria
- panel adicional de prioridad principal dentro del hero
- banda de dinero bloqueado
- 4 KPI de decision
- cola operativa
- cola siguiente
- quick actions partidas en dos grupos
- banda fiscal y documental

El problema no era falta de informacion, sino exceso de protagonismo simultaneo y duplicacion de acciones en el primer scroll, especialmente en movil.

## Cambios realizados

- Se compacta el header de Inicio y se elimina la duplicacion de CTA en la cabecera.
- La accion principal queda concentrada en una sola superficie dominante dentro del bloque hero.
- La banda de dinero bloqueado pasa de 4 a 3 frentes visibles.
- Los KPI iniciales se reducen a 3 tarjetas de decision real:
  - pendiente de cobro
  - trabajo sin facturar
  - servicios hoy
- La cola operativa se reduce a maximo 4 items.
- Las quick actions dejan de dividirse en dos paneles y pasan a una sola banda minima.
- Las quick actions se filtran para no repetir la accion primaria ni su consecuencia secundaria cuando ya estan visibles arriba.
- La revision fiscal y de soporte pasa a una banda final condicional:
  - solo se muestra cuando hay alertas importantes, riesgo fiscal o seguimiento auxiliar relevante
- Los empty states del dashboard se alinean con la base del design system usando `DSEmptyState`.
- La cabecera usa `DSPageHeader` como wrapper seguro sobre la pieza madura existente.

## Decisiones UX

- `Inicio` deja de comportarse como un contenedor de todo y vuelve a una lectura decision-first.
- La accion principal no compite con el header.
- Las alertas importantes quedan separadas de la cola operativa para no mezclar agenda con soporte.
- Los accesos rapidos se mantienen, pero ya no intentan representar todo el producto.
- El primer viewport prioriza:
  - una prioridad principal
  - dinero bloqueado o abierto
  - senales operativas cortas

## Que no se toco

- Supabase
- auth
- rutas
- sistema `?view=`
- `financialWriteApi`
- `appDataApi`
- logica de negocio del dashboard
- calculos y metricas
- modulos criticos como Facturas, Presupuestos, Clientes, Servicios, Cobros o Gastos

## Riesgos pendientes

- El dashboard sigue dependiendo de agregados cross-module y de acciones que abren vistas externas.
- La calidad final del Home sigue muy condicionada por la complejidad de Facturas, Servicios y Cierre fiscal, aunque no se hayan tocado.
- `src/pages/HomePage.tsx` sigue concentrando mucha composicion de bloques; la mejora de Sprint 5 es de jerarquia, no un refactor estructural.
- Sigue existiendo deuda de copy y jerarquia futura en Leads y otros modulos que desembocan en Inicio.
