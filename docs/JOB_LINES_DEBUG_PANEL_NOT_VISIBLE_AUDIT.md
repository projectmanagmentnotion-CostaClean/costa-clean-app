# Job Lines Debug Panel Not Visible Audit

## Fecha

- 2026-07-01

## Hallazgo principal

- El panel visible `Debug lineas servicio` no aparecia para el usuario.
- La causa inmediata no era CSS ni un helper equivocado: el panel no estaba publicado en `origin/main`.
- El ultimo commit publicado seguia siendo `df66cd6`, y el panel estaba solo como cambio local sin commitear en `src/features/jobs/JobDetailCard.tsx`.

## Estado git verificado

- Branch: `main`
- Commit visible al iniciar este sprint:
  - `df66cd6 fix: keep editable job line state expanded`
  - `5d18ff5 fix: load real job lines in editor`
  - `268213c fix: preserve job lines in forms and billing`
  - `c356c27 fix: authenticate job line save rpc`
- Habia cambios sin commitear en:
  - `src/features/jobs/JobDetailCard.tsx`

## El debug existia o no

- Si, existia en codigo local.
- No existia en el build publicado que el usuario estaba probando.

## Archivo y componente real identificados

- Ruta visible real:
  - `src/features/jobs/JobWorkspace.tsx`
  - `MajorEditFlowOverlay`
  - `src/features/jobs/JobDetailCard.tsx`
- El editor de la captura no corresponde a `JobCreateForm` ni a `JobCreateFlow`.
- El componente real visible es `JobDetailCard` en modo edicion dentro del overlay mayor.

## Evidencia textual usada para identificarlo

- `ActionFlowOverlay` renderiza:
  - `Accion guiada`
  - boton `Cerrar`
- `JobWorkspace` abre:
  - `title="Editar servicio"`
  - `description="La edicion mayor se trabaja fuera de la card..."`
- `JobDetailCard` renderiza:
  - `Detalle del servicio`
  - `Microacciones`
  - `Guardar cambios`

## Si habia componente duplicado

- No para esta pantalla concreta.
- Hay otros formularios de servicio (`JobCreateForm`, `JobCreateFlow`), pero no son el editor visible de la captura.
- La ruta real del editor es unica para este caso: `MajorEditFlowOverlay -> JobDetailCard`.

## Por que no se veia el debug

1. El panel estaba solo en cambios locales, no en el ultimo commit publicado.
2. Por tanto, el usuario seguia viendo un build sin ese panel.
3. Ademas, la marca visible estaba mas abajo del formulario; para evitar otra duda se anadio una traza DEV imposible de pasar por alto al inicio del form.

## Instrumentacion visible aplicada

- En `JobDetailCard.tsx` se deja ahora:
  - banner superior:
    - `DEV TRACE - componente: JobDetailCard/EditForm`
    - `DEV: true | job.billing_lines: N | stateLines: M`
  - panel inferior:
    - `Debug lineas servicio`
    - `job.billing_lines`
    - `initialEditableLines`
    - `stateLines`
    - `renderedLines`
    - `Ultimo submit p_lines`
    - `fallbackLegacy`
    - conceptos de job/state/submit

## Valores que debe ver ahora el usuario

Al abrir `JOB-0052` en entorno DEV, dentro del editor debe aparecer:

- `DEV TRACE - componente: JobDetailCard/EditForm`
- `Debug lineas servicio`

Y dentro del panel:

- `job.billing_lines`
- `initialEditableLines`
- `stateLines`
- `renderedLines`
- `Ultimo submit p_lines`

## Fix aplicado en este sprint

- No se aplico otro fix funcional de lineas todavia.
- Este sprint cerro la auditoria de visibilidad:
  - confirmar componente real
  - confirmar que el debug estaba sin publicar
  - publicar una traza visible en el componente correcto

## Tests

- No se anadieron tests nuevos solo para esta auditoria visual.
- Se mantuvieron las validaciones del repo tras instrumentar:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## Pendiente real

- Falta la comprobacion visual en el editor autenticado del usuario para leer el panel y localizar el punto exacto donde 3 lineas se convierten en 1.
- Con esta publicacion ya no dependemos de consola para ese siguiente paso.
