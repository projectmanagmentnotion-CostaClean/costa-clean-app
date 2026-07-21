# QA Authenticated RLS Write Verification — 2026-07-21

## Alcance y destino

- HEAD inicial: `598b2da44700eff3b6538dd392be184fb2aea88b`.
- Proyecto exclusivo de QA: `kpvvydthlxupjjqqdpxy`.
- Marcador exclusivo: `QA_AUTH_RLS_WRITE_20260721`.
- Producción, Supabase productivo, `service_role`, schema, migrations, policies, facturas, cobros, cierres y numeración fiscal: no tocados.

El runner `scripts/qa/verify-authenticated-rls-writes.mjs` ofrece `--dry-run`, `--apply`, `--cleanup` y `--verify-clean`. Exige `QA_ENV=sandbox`, fingerprint exacto, sesión real, bearer distinto de la anon key y baseline financiera `0/0/0`. La conexión privada ya existente de operador QA se usa únicamente para baseline, fixture aislada y cleanup; nunca se presenta como evidencia RLS.

## Writes probados y resultado REST/RLS

| Operación | Tabla/RPC | HTTP | Estado persistido | Resultado |
| --- | --- | ---: | --- | --- |
| Alta de cliente temporal | `clients` REST | 403 | no creado | RLS `42501` |
| Alta de propiedad temporal | `properties` REST | 403 | no creada | RLS `42501` |
| Edición de propiedad fixture | `properties` REST | 200 | cero filas; sin cambio | fallo cerrado |
| Reasignación de propiedad fixture | `reassign_property_client` RPC | 200 | `client_id` actualizado | pass |
| Alta de servicio y línea | `save_job_with_lines` RPC | 204 | job y job_line creados | pass |
| Cambio rápido de estado | `jobs` REST | 200 | cero filas; siguió `scheduled` | fallo cerrado |

La sesión se validó contra `/auth/v1/user` con HTTP 200. `Authorization` usó `session.access_token`, comprobado distinto de `VITE_SUPABASE_ANON_KEY`; `apikey` mantuvo la anon key requerida por REST. Ningún token fue impreso ni persistido en artefactos versionables.

## Error exacto y corrección aplicada

Los INSERT directos devolvieron PostgREST `42501`: `new row violates row-level security policy` para `clients` y `properties`. Los PATCH directos devolvieron HTTP 200 con representación vacía y no modificaron la base.

Se corrigió únicamente el cliente:

- los writes directos piden `Prefer: return=representation`;
- una respuesta solo se acepta si representa exactamente una fila;
- HTTP 200 con cero filas muestra un error claro y no cierra el flujo como guardado;
- 401/403 conservan su detalle de sesión/permisos;
- no se añadió fallback anon ni se tocó `financialWriteApi`.

No se modificaron policies. Conseguir INSERT/PATCH directos reales requiere un sprint de RLS separado y autorización explícita.

## Tests añadidos

- contrato de modos, fingerprint, bearer y marker del runner;
- rechazo de una respuesta HTTP 200 con cero filas persistidas;
- bloqueo si el snapshot final contiene marcador, altera el seed o toca tablas financieras;
- helper frontend: exige exactamente una fila representada y rechaza `[]`.

## Limpieza y seguridad

- máximo temporal observado con el marcador: 3 filas;
- residuos finales `QA_AUTH_RLS_WRITE_20260721`: 0;
- seed `QA_DEMO_20260721`: 15 filas intactas;
- `invoices/payments/quarterly_closings`: `0/0/0` antes y después;
- cleanup limitado a IDs deterministas y marcador exacto;
- no se ejecutó reset destructivo, `db push`, full-submit ni write financiero.

## Riesgos restantes

- Las policies actuales no habilitan INSERT directo autenticado de cliente/propiedad ni PATCH directo de propiedad/job. El frontend ahora falla de forma visible, pero esas operaciones no quedan operativas hasta revisar RLS por separado.
- Los RPC SECURITY DEFINER probados persistieron; sus grants y policies merecen auditoría dedicada antes de ampliar el alcance.
- El alta temporal de job puede avanzar una secuencia no fiscal; no se tocó `invoice_number` ni `display_code` fiscal.

## Validación final

- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run test`: 40 archivos, `190/190` tests.
- `npm run qa:sandbox:check`: pass; fingerprint `kpvvydthlxupjjqqdpxy`.
- `npm run qa:visual:auth`: `360/360` en el rerun final. El primer pase fue `359/360` por una captura intermitente de Cobros/tablet durante carga.
- `node scripts/qa/run-end-user-flow-agent.mjs --mode=dry-run`: `588/588`, 3 skips de política y 0 entidades creadas.
- `npm run qa:auth-rls:verify-clean` final: pass, marcador 0, seed intacto y finanzas `0/0/0`.

## Rollback

Revertir el commit de esta entrega con `git revert <commit>` y ejecutar lint, build y tests. El rollback de código no requiere mutación de QA: el marcador temporal ya quedó en cero. No revertir mediante reset destructivo ni cambios de policies.
