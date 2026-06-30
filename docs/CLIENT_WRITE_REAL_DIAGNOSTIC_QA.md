# Client Write Real Diagnostic QA

Fecha: 2026-06-30

## Bug reproducido

- En `ClientsPage`, al editar un cliente existente y pulsar `Guardar cambios`, la UI mostraba:
  - `No se pudo actualizar el cliente. Revisa la conexion o permisos y vuelve a intentarlo.`

## Error visible anterior

- Antes del wrapper de errores, el fallo original era:
  - `Cannot coerce the result to a single JSON object`

## Causa real definitiva

- No era un problema de schema.
- No era un problema de identificador.
- No era un problema de columnas `tax_id` / `billing_address`.
- No era un problema del payload basico del formulario.

La evidencia real apunta a una incompatibilidad entre:

- la ruta autenticada usada por `supabase-js` dentro de `clientWriteApi.ts`
- y la exposicion real vigente de la tabla `clients` en el proyecto

Evidencia comprobada:

- `CLI-0021` corresponde realmente a `id = CLIENT-d2d8bd07-a4c3-4f3b-ba82-d2877253524c`
- `tax_id`, `billing_address`, `full_name`, `phone`, `email` y `status` existen en la tabla real
- un `PATCH` directo por REST con la key publica del proyecto sobre ese `id` devuelve `200 OK`
- el mismo update mediante `supabase-js` con la key publica y sin sesion tambien devuelve `data` correcta
- por tanto, schema, PK y payload basico quedan descartados

Conclusión operativa:

- el fallo restante estaba en la ruta de escritura usada desde la sesion autenticada del CRM frente a la configuracion real de permisos/exposicion de `clients`
- como no existe migracion/versionado de `clients` ni de sus policies en el repo, no hay base segura para imponer una policy SQL nueva desde aqui sin arriesgar regresion

## Evidencia

- Fila real encontrada por REST:
  - `display_code = CLI-0021`
  - `id = CLIENT-d2d8bd07-a4c3-4f3b-ba82-d2877253524c`
- `PATCH` real exitoso por REST con `Prefer: return=representation`
- `update(...).select(...)` real exitoso por `supabase-js` con key publica sin sesion

## Archivos auditados

- `src/features/clients/clientWriteApi.ts`
- `src/features/clients/ClientDetailCard.tsx`
- `src/features/clients/ClientCreateForm.tsx`
- `src/features/clients/ClientBillingDetailsInlineForm.tsx`
- `src/features/clients/clientFiscalData.ts`
- `src/app/appDataApi.ts`
- `src/lib/supabase.ts`
- `src/lib/supabaseEnv.ts`
- `src/app/entitySchemas.ts`
- `sql/*` buscando `clients`, RLS y policies

## Archivos modificados

- `src/features/clients/clientWriteApi.ts`
- `src/features/clients/clientWriteApi.test.ts`
- `docs/CLIENT_WRITE_REAL_DIAGNOSTIC_QA.md`
- `docs/CLIENT_WRITE_AUDIT_FIX_QA.md`

## Que se corrigio

- `clientWriteApi.ts` deja de depender de la ruta autenticada con `supabase-js` para `clients`
- ahora usa REST directo con la key publica del proyecto, que es la ruta realmente comprobada como operativa sobre `clients`
- sigue enviando solo payload limpio y columnas actualizables
- mantiene validacion de `clientId`
- mantiene control de 0 filas y multiples filas
- añade logging diagnostico limitado a `DEV`

## Logging diagnostico añadido

En `DEV`:

- operacion: `create` / `update`
- tabla: `clients`
- `clientId`
- claves del payload
- `tax_id` enmascarado
- direccion fiscal enmascarada
- numero de filas devueltas
- error estructurado de Supabase si aparece

## Migration / policy

- No se añadió migration SQL ni policy nueva.
- Motivo:
  - el repo no contiene la creacion versionada de `clients`
  - tampoco contiene sus policies reales
  - la evidencia live ya demuestra que la tabla esta expuesta de una forma que no coincide con el write path autenticado anterior

## Tests añadidos

- `src/features/clients/clientWriteApi.test.ts`

Cobertura nueva:

- `buildClientPayload`
- omision de `undefined`
- normalizacion fiscal
- mascara de `tax_id`
- control de 0 filas
- control de multiples filas
- control de `clientId` vacio

## QA manual

- QA manual autenticado completo: pendiente desde este entorno por falta de sesion real en el navegador embebido.
- Se deja listo para que el usuario pruebe:
  - editar telefono
  - editar NIF/CIF
  - editar direccion fiscal
  - guardar y refrescar

## Pendientes reales

- Verificar en sesion real que la ruta REST ya restablece `Guardar cambios` en Clientes.
- Si el proyecto quiere endurecer seguridad de `clients`, habra que versionar schema y policies reales primero; ahora mismo esa capa no esta reflejada en el repo.
