# Property Creation Sync + Duplicate Guard QA

## Bug original

- En `InvoiceCreateFlow` el subflujo de propiedad podia crear un inmueble y volver al paso de facturacion sin que el selector heredase esa nueva opcion de forma inmediata.
- El guard de duplicados de propiedades vivia solo en `PropertyCreateFlow`; `PropertyCreateForm` seguia permitiendo altas repetidas sin warning.
- La deteccion de propiedades duplicadas tambien podia mezclar clientes distintos cuando compartian direccion parecida.

## Causa exacta

- `availableProperties` en [InvoiceCreateFlow.tsx](C:/Users/USUARIO/costa-clean-app/src/features/invoices/InvoiceCreateFlow.tsx) dependia solo de la prop `properties`.
- `PropertyCreateFlow` cerraba el subflujo tras `onCreatedProperty`, pero el refresco real llegaba despues; si ese refresco tardaba o fallaba, el selector no tenia una opcion local inmediata.
- `compareProperties` en [duplicateEngine.ts](C:/Users/USUARIO/costa-clean-app/src/features/duplicates/duplicateEngine.ts) no limitaba todas las razones al mismo `client_id`.
- `PropertyCreateForm` hacia `POST` directo sin duplicate review previo.

## Archivos modificados

- [InvoiceCreateFlow.tsx](C:/Users/USUARIO/costa-clean-app/src/features/invoices/InvoiceCreateFlow.tsx)
- [PropertyCreateFlow.tsx](C:/Users/USUARIO/costa-clean-app/src/features/properties/PropertyCreateFlow.tsx)
- [PropertyCreateForm.tsx](C:/Users/USUARIO/costa-clean-app/src/features/properties/PropertyCreateForm.tsx)
- [duplicateEngine.ts](C:/Users/USUARIO/costa-clean-app/src/features/duplicates/duplicateEngine.ts)
- [propertyDuplicateGuard.ts](C:/Users/USUARIO/costa-clean-app/src/features/properties/propertyDuplicateGuard.ts)
- [propertyOptionSync.ts](C:/Users/USUARIO/costa-clean-app/src/features/properties/propertyOptionSync.ts)
- [propertyDuplicateGuard.test.ts](C:/Users/USUARIO/costa-clean-app/src/features/properties/propertyDuplicateGuard.test.ts)

## Solucion aplicada

- La creacion de propiedad ahora pide `Prefer: return=representation` y reutiliza la fila devuelta para trabajar con el `id` real persistido.
- `InvoiceCreateFlow` mantiene una cola local de propiedades sincronizadas para inyectar la nueva opcion en el selector sin recarga completa.
- El mismo flujo deja la propiedad creada seleccionada automaticamente y muestra feedback inline dentro del paso de facturacion.
- Si el refresh posterior falla, el flujo ya no depende de exito falso: queda feedback visible y accion `Reintentar`.
- `PropertyCreateForm` gana duplicate review previo, igual que `PropertyCreateFlow`.
- La comparativa de propiedades duplicadas queda estrictamente acotada al mismo cliente.

## Duplicados existentes

- No se borran ni se fusionan automaticamente.
- Siguen visibles desde `PropertiesPage` mediante `DuplicateNotice` y `DuplicateReviewOverlay`.
- En creacion, el usuario puede usar la propiedad existente o crear de todos modos de forma explicita.

## Lo que no se hizo

- no se toco Supabase schema
- no se toco SQL
- no se toco RPC
- no se tocaron migrations
- no se toco auth productivo
- no se tocaron rutas ni `?view=`
- no se toco `financialWriteApi`
- no se tocaron numeracion, `invoice_number`, `display_code`, fiscalidad global ni calculos de factura
- no se borraron propiedades ni se fusionaron duplicados automaticamente

## Pruebas ejecutadas

- `npm run lint` OK
- `npm run build` OK
- `npm run test` OK

## QA autenticada

- `npm run qa:visual:auth` ya no queda bloqueado por `ERR_CONNECTION_REFUSED` porque la app local estaba levantada en `http://127.0.0.1:4173/`.
- La pasada del `2026-07-16` sigue devolviendo findings reales fuera del alcance de este sprint en varias vistas (`home`, `clients`, `quotes`, `jobs`, `invoices`, `payments`, `invoices-debug`), asi que no debe leerse como `green` global del producto.
- En navegador autenticado se verifico la carga real de `?view=invoices` y la apertura de `Nueva factura` sin submit final.

## Deuda pendiente

- Queda extender la sincronizacion local inmediata a todos los consumidores legacy de `PropertyCreateForm` y `PropertyCreateFlow` que todavia calculan `availableProperties` solo desde props.
- Queda una reproduccion viva completa del caso de creacion real sin mutar datos productivos; en esta pasada no se ejecuto un alta real desde navegador por la restriccion explicita de no mutar datos reales sin autorizacion operativa.
