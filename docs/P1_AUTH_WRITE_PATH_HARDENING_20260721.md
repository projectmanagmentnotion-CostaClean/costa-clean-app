# P1 Authenticated Write Path Hardening - 2026-07-21

## Objetivo y limites

Corregir los writes REST directos de propiedades y servicios para que la identidad de autorizacion sea la sesion real del usuario, sin alterar contratos de payload, rutas, RPC, schema, migrations, auth, facturacion, cobros, cierres, numeracion fiscal ni `financialWriteApi`.

HEAD inicial: `a7d28fc7a872c92ad5d7f9b202d9259e031fb859`.

Produccion y Supabase productivo no se usaron para validar este cambio. No se ejecutaron `full-submit`, facturas, cobros ni writes financieros.

## Patron inseguro encontrado

Cuatro superficies construian writes protegidos con esta combinacion:

```text
apikey: <anon key>
Authorization: Bearer <anon key>
```

La anon key identifica la aplicacion ante Supabase, pero no representa la sesion de un usuario. Bajo RLS autenticada el write podia fallar o depender de policies demasiado permisivas.

El patron estaba presente en:

- alta StepFlow de propiedad (`POST properties`)
- alta legacy de propiedad (`POST properties`)
- edicion y reasignacion de propiedad (`PATCH properties` y RPC `reassign_property_client`)
- cambio rapido de estado de servicio (`PATCH jobs`)

El alta y la edicion profunda de servicios mediante `save_job_with_lines` ya obtenian `session.access_token`. Las acciones lifecycle usan el cliente Supabase autenticado. Esas rutas se conservaron.

## Archivos afectados

- `src/lib/authenticatedSupabaseWrite.ts`
- `src/lib/authenticatedSupabaseWrite.test.ts`
- `src/features/properties/PropertyCreateFlow.tsx`
- `src/features/properties/PropertyCreateForm.tsx`
- `src/features/properties/PropertyDetailCard.tsx`
- `src/features/jobs/JobDetailCard.tsx`
- `docs/P1_AUTH_WRITE_PATH_HARDENING_20260721.md`
- `docs/UNIVERSAL_RELEASE_LOG.md`

## Correccion aplicada

`fetchAuthenticatedSupabaseWrite` centraliza el contrato para estos REST writes:

1. obtiene el cliente Supabase existente
2. consulta `client.auth.getSession()`
3. aborta antes de `fetch` si falta `session.access_token`
4. conserva la anon key unicamente en `apikey`
5. usa `Authorization: Bearer <session.access_token>`
6. mantiene metodo, URL, payload, RPC, `Prefer` y callbacks existentes

Mensaje sin sesion:

```text
Tu sesion ha caducado o no esta disponible. Inicia sesion de nuevo antes de guardar.
```

Los HTTP `401` y `403` reciben copy de recuperacion claro, pero conservan `REST 401/403` y el cuerpo devuelto por Supabase. El `catch` de cada superficie muestra ese error sin reemplazarlo por un generico.

## Tests anadidos

La cobertura nueva comprueba:

- property write: anon key solo en `apikey` y token de sesion en bearer
- service/job status write: anon key solo en `apikey` y token de sesion en bearer
- sesion ausente: rechazo antes de invocar `fetch`
- sesion presente: uso efectivo de `session.access_token`
- errores 401/403: status y detalle preservados en el mensaje UX

La suite existente de `jobWriteApi` sigue cubriendo el RPC autenticado `save_job_with_lines`.

La proteccion de facturas/cobros se valida ademas por alcance de diff: no hay cambios en `src/features/invoices`, `src/features/payments`, `src/features/financial`, `invoice_number` ni `display_code` fiscal.

## Validacion

- tests focalizados: `2` archivos, `11/11` tests
- `npm run lint`: pass
- `npm run build`: pass
- `npm run test`: `39` archivos, `183/183` tests
- `npm run qa:sandbox:check`: pass; fingerprint sandbox valido, separado del proyecto local de referencia y full-submit bloqueado
- `npm run qa:visual:auth`: `360/360` checks sobre `390x844`, `768x1024` y `1366x900`
- `node scripts/qa/run-end-user-flow-agent.mjs --mode=dry-run`: tres ejecuciones `587/588`; el unico check fallo cada vez en una combinacion distinta y desaparecio en el siguiente run (`service-from-client/mobile firstFieldVisible`, `service-from-property/desktop firstFieldVisible`, `job-create/desktop headerVisible`)
- acciones peligrosas omitidas por politica: `3` por ejecucion
- entidades creadas: `0`
- cleanups ejecutados: `0`

## Riesgos restantes

- La correccion no demuestra por si sola que todas las policies RLS permitan cada operacion; 401/403 quedan visibles para diagnostico.
- Existen bearers anonimos fuera del alcance en clientes, leads y scripts operativos/QA. No se modificaron para evitar ampliar dominios sin un sprint dedicado.
- No se ejecuto write-and-clean: el sprint prohibe submits y solo valida fuente, tests y navegacion dry-run.
- El agente dry-run mantiene un check visual intermitente: tres reruns terminaron `587/588`, pero el fallo migro entre flujo, viewport y tipo de check. La evidencia no apunta a una regresion determinista de este cambio de headers; no se rebajo cobertura ni se modifico el harness fuera de alcance.

## Rollback

- Commit anterior: `a7d28fc7a872c92ad5d7f9b202d9259e031fb859`
- Commit nuevo: se informa en el cierre.
- Reversion segura: `git revert <commit-de-esta-entrega>`
- Revertir si el alta/edicion de propiedades o el cambio de estado de servicios deja de construir el mismo endpoint/payload, o si una sesion valida no llega como bearer.
- Tras revertir: ejecutar lint, build, tests, sandbox check, QA visual autenticada y dry-run.

No existen cambios de datos, schema o infraestructura que requieran rollback externo.
