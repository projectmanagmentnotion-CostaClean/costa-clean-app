# Job Editor Live Save UX QA

## Fecha

- 2026-07-01

## Objetivo

- Hacer que el editor de servicios se sienta vivo al editar `job_lines`.
- Evitar que el usuario dependa de un hard refresh para ver lineas nuevas tras guardar.
- Mostrar feedback claro de guardado, refresco pendiente y warnings de validacion.

## Problema real

- `JobDetailCard` guardaba correctamente por `save_job_with_lines`, pero luego esperaba a `onJobUpdated()`.
- `onJobUpdated()` disparaba el refresh global, que podia resolver sin error aunque `jobs` siguiera momentaneamente desfasado.
- Cuando ese refresh devolvia un `job` viejo, la card reseteaba el formulario y podia volver a mostrar menos lineas o estado legacy.
- El resultado visible era mala UX:
  - la linea añadida si aparecia localmente
  - tras guardar podia desaparecer o quedarse en duda
  - el usuario sentia que debia refrescar la pagina manualmente

## Causa exacta

- `src/features/jobs/JobWorkspace.tsx`
  - no tenia una capa local viva para mantener el `job` optimista tras guardar
- `src/features/jobs/JobDetailCard.tsx`
  - resincronizaba estado interno cada vez que cambiaba `job`
  - mezclaba feedback de guardado con cierre/reseteo del editor
  - no separaba:
    - guardado correcto
    - refresco correcto
    - refresco pendiente o stale

## Fix aplicado

### 1. Estado vivo del servicio en workspace

- Nuevo helper: `src/features/jobs/jobEditorLiveState.ts`
- `JobWorkspace` ahora mantiene una version local/optimista del `job`.
- Si el refresh remoto llega stale, la UI conserva la version local en vez de retroceder.

### 2. Reconciliacion optimista vs remota

- `resolveJobAfterRefresh(...)` compara:
  - campos editables del servicio
  - `billing_lines`
  - cantidades, precios y subtotales
- Si la version remota todavia no refleja el guardado:
  - el resultado pasa a `refresh_warning`
  - la vista sigue mostrando la version local

### 3. Feedback visible del guardado

- `JobDetailCard` ahora distingue:
  - `saving`
  - `refreshing`
  - `saved`
  - `refresh_warning`
  - `error`
- El usuario ve alerts claras sin cerrar el editor automaticamente.

### 4. Warnings de lineas y subtotal

- Cada linea invalida muestra warning propio.
- Si el subtotal total queda en `0`, aparece warning global.
- El bloqueo de guardado sigue siendo estricto para lineas invalidas.

### 5. UX inmediata al añadir linea

- Añadir linea sigue haciendo append local inmediato.
- La nueva linea gana foco automaticamente.
- El boton queda bloqueado mientras el guardado esta en curso.

### 6. Debug preservado sin exponerlo de mas

- El panel debug sigue visible solo en:
  - `import.meta.env.DEV`
  - `?debugJobLines=1`

## Archivos modificados

- `src/features/jobs/JobWorkspace.tsx`
- `src/features/jobs/JobDetailCard.tsx`
- `src/features/jobs/jobEditorLiveState.ts`
- `src/features/jobs/jobEditorLiveState.test.ts`

## Tests

- `src/features/jobs/jobEditorLiveState.test.ts`
  - append local de lineas
  - warnings y bloqueo de validacion
  - preferencia por estado optimista si el refresh remoto esta stale
  - preferencia por remoto cuando ya refleja el guardado
  - reconstruccion del snapshot optimista
  - visibilidad del debug solo en DEV o query flag

## Validacion automatizada

- `npm run lint`
- `npm run test`
- `npm run build`

## QA manual recomendada

1. Abrir un servicio con varias lineas.
2. Entrar en `Editar servicio`.
3. Añadir una linea nueva.
4. Confirmar que aparece al instante y recibe foco.
5. Guardar.
6. Confirmar uno de estos resultados visibles:
   - `Servicio guardado y refrescado correctamente.`
   - `Guardado correcto, pero el refresco aun no devolvio las lineas nuevas. Se mantiene la version local.`
7. Sin recargar la pagina, comprobar que la linea sigue visible.
8. Cerrar y reabrir el editor del mismo servicio.
9. Confirmar que las lineas siguen vivas si el backend ya devolvio el estado correcto.

## Limitaciones reales

- No se hizo QA autenticada en navegador dentro de este turno.
- La reconciliacion protege contra refresh stale del frontend, pero no sustituye un problema real de DB/RLS si el backend no devuelve nunca las lineas correctas.

## Referencias

- `docs/JOB_LINES_APPDATA_TO_EDITOR_FIX_QA.md`
- `docs/JOB_FORM_STATE_LINES_FINAL_FIX_QA.md`
- `docs/JOB_SAVE_AUTH_FIX_QA.md`
