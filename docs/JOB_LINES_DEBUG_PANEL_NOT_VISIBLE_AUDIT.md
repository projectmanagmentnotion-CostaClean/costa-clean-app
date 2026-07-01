# Job Lines Debug Panel Not Visible Audit

## Fecha

- 2026-07-01

## Hallazgo principal

- El panel visible `Debug lineas servicio` no aparecia para el usuario.
- La causa inmediata ya no es un componente equivocado.
- La pantalla real si corresponde a `src/features/jobs/JobDetailCard.tsx`.
- El bloqueo de visibilidad estaba en la condicion de render del debug:
  - antes dependia solo de `import.meta.env.DEV`
  - ahora tambien puede activarse con `?debugJobLines=1`

## Estado git verificado

- Branch: `main`
- Commit visible al abrir este sprint bloqueante:
  - `f52e10f fix: trace actual job editor line state`
- `git status` limpio en local al empezar este sprint.

## El debug existia o no

- Si, existia en codigo fuente publicado.
- El texto seguia presente en `src/features/jobs/JobDetailCard.tsx`.
- Si no aparecia en la pantalla real, el runtime del usuario no estaba entrando por la condicion `import.meta.env.DEV`.

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

1. El editor real si es `JobDetailCard`.
2. El panel anterior estaba condicionado solo por `import.meta.env.DEV`.
3. Si el usuario estaba viendo `vite preview`, un build ya generado o un proceso viejo sin reiniciar, esa condicion podia ser `false`.
4. Ademas, el panel inferior quedaba mas abajo del bloque de lineas.
5. Para bloquear esa ambiguedad se movio un trace minimo justo encima de `Concepto 1` y se anadio activacion por query string.

## Instrumentacion visible aplicada

- En `JobDetailCard.tsx` se deja ahora:
  - banner rojo inline sobre la primera linea editable:
    - `DEV TRACE ACTIVO - COMPONENTE REAL: JobDetailCard.tsx - JOB EDITOR LINES`
  - bloque JSON inline con:
    - `component`
    - `jobId`
    - `displayCode`
    - `billingLinesLength`
    - `billingLinesConcepts`
    - `editableLinesLength`
    - `editableLinesConcepts`
    - `importMetaDev`
    - `debugJobLinesFlag`
  - panel inferior:
    - `Debug lineas servicio`
    - `job.billing_lines`
    - `initialEditableLines`
    - `stateLines`
    - `renderedLines`
    - `Ultimo submit p_lines`
    - `fallbackLegacy`
    - conceptos de job/state/submit

- Condicion final:
  - `import.meta.env.DEV || window.location.search.includes('debugJobLines=1')`

## Valores que debe ver ahora el usuario

Al abrir `JOB-0052`, dentro del editor debe aparecer:

- `DEV TRACE ACTIVO - COMPONENTE REAL: JobDetailCard.tsx - JOB EDITOR LINES`
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
  - confirmar que el debug si estaba en el componente correcto
  - demostrar que el bloqueo era la condicion `import.meta.env.DEV`
  - publicar una traza visible justo encima de `Concepto 1`
  - habilitar activacion por `?debugJobLines=1`

## Tests

- No se anadieron tests nuevos solo para esta auditoria visual.
- Se mantuvieron las validaciones del repo tras instrumentar:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## Pendiente real

- Falta la comprobacion visual en el editor autenticado del usuario para leer el panel y localizar el punto exacto donde 3 lineas se convierten en 1.
- Con esta publicacion ya no dependemos de consola para ese siguiente paso.
