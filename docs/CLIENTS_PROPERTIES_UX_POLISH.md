# Clients Properties UX Polish

## Estado anterior

Antes de Sprint 9, clientes y propiedades ya tenian base operativa buena, pero seguian con tres problemas visibles:

- las portadas mezclaban directorio y contexto sin una lectura tan clara de acceso rapido
- los listados no dejaban una lectura breve de filtro/resultado y sus empty states eran correctos pero austeros
- el workspace de cliente seguia escondiendo demasiado pronto la identidad y el contexto util, mientras propiedades tenia una cabecera correcta pero menos informativa de lo necesario

## Archivos auditados

- `src/pages/ClientsPage.tsx`
- `src/features/clients/ClientsList.tsx`
- `src/features/clients/ClientWorkspace.tsx`
- `src/features/clients/ClientDetailCard.tsx`
- `src/features/clients/ClientCreateForm.tsx`
- `src/features/clients/ClientBillingDetailsInlineForm.tsx`
- `src/features/clients/useClientWorkspaceNavigation.ts`
- `src/features/clients/client-workspace.css`
- `src/pages/PropertiesPage.tsx`
- `src/features/properties/PropertiesList.tsx`
- `src/features/properties/PropertyWorkspace.tsx`
- `src/features/properties/PropertyDetailCard.tsx`
- `src/features/properties/PropertyCreateFlow.tsx`
- `src/features/properties/PropertyCreateForm.tsx`
- `src/features/properties/usePropertyWorkspaceNavigation.ts`
- `src/components/WorkspaceScaffold.tsx`

## Cambios UX aplicados

- `ClientsPage` y `PropertiesPage` pasan a usar `DSPageHeader` como wrapper seguro sobre la cabecera ejecutiva existente.
- La seccion de directorio se vuelve mas explicita: se refuerza que la portada es una entrada a workspace y no un dashboard paralelo.
- `ClientsList` y `PropertiesList` muestran un resumen corto de resultados visibles tras la busqueda.
- Los estados `empty` y `error` de ambos listados se alinean con el design system usando `DSEmptyState` y `DSErrorState`.
- `WorkspaceScaffold` vuelve a mostrar una meta card visible en cabecera para no ocultar demasiado pronto el primer dato clave del cliente.
- `ClientWorkspace` mejora el estado vacio de propiedades vinculadas y automatizaciones recurrentes.
- `PropertyWorkspace` gana una segunda meta card en hero para dejar visible antes el documento o agenda dominante.
- El CSS compartido del workspace mejora tabs horizontales en movil, respiracion del bloque de siguiente paso y microcopy visual de lista/empty states.

## Acciones sensibles preservadas

- Alta de cliente:
  - `src/features/clients/ClientCreateForm.tsx`
- Edicion de cliente:
  - `src/features/clients/ClientDetailCard.tsx`
  - `src/features/clients/clientWriteApi.ts`
- Alta de propiedad:
  - `src/features/properties/PropertyCreateFlow.tsx`
  - `src/features/properties/PropertyCreateForm.tsx`
- Edicion / reasignacion de propiedad:
  - `src/features/properties/PropertyDetailCard.tsx`
- Acciones relacionadas desde workspace:
  - crear presupuesto
  - registrar servicio
  - crear factura
  - registrar cobro
  - abrir propiedad, presupuesto, servicio o factura existente

## Logica preservada

Se mantiene intacto:

- `updateClientRecord`
- `ClientCreateForm`
- `PropertyCreateFlow`
- `PropertyCreateForm`
- `PropertyDetailCard` y su write path actual
- callbacks de apertura hacia presupuestos, facturas y servicios
- navegacion de workspace por query param/tab
- contratos de datos, validaciones y persistencia

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
- logica de facturas
- numeracion de facturas
- logica de presupuestos
- logica de servicios
- persistencia
- conversion lead -> cliente

## Riesgos pendientes

- `PropertyDetailCard.tsx` sigue teniendo un write path directo por REST/RPC sobre Supabase y no conviene mezclarlo con rediseño amplio.
- `ClientCreateForm.tsx` todavia no usa StepFlow y sigue siendo un alta corta pero lineal.
- `ClientDetailCard.tsx` mantiene mucha informacion relacional en un solo bloque de detalle clasico.
- `ClientWorkspace.tsx` y `PropertyWorkspace.tsx` siguen siendo archivos grandes con bastante orquestacion cross-module.

## Recomendaciones futuras

1. tratar el onboarding de cliente como futuro candidato StepFlow cuando se quiera separar identidad, contacto, fiscal y relaciones
2. aislar el write path de propiedad antes de cualquier rediseño profundo del detalle editable
3. seguir compactando summary/detail en cliente si el workspace vuelve a crecer con mas automatizaciones o historico
