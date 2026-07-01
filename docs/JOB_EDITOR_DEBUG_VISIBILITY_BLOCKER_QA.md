# Job Editor Debug Visibility Blocker QA

## Fecha

- 2026-07-01

## Captura reportada por el usuario

- El usuario abrio el editor real de `JOB-0052`.
- La pantalla visible incluia:
  - `Accion guiada`
  - `Editar servicio`
  - `Microacciones`
  - `Concepto 1`
  - `Guardar cambios`
- No aparecia:
  - `DEV TRACE - componente: JobDetailCard/EditForm`
  - `Debug lineas servicio`

## Commit local actual verificado

```bash
git status
git branch --show-current
git log --oneline -10
```

Resultado:

- `git status`: limpio
- `git branch --show-current`: `main`
- `git log --oneline -10` incluye:
  - `f52e10f fix: trace actual job editor line state`
  - `5ed738d chore: force visible job editor line trace`

## Resultado de grep del debug

```bash
rg -n "DEV TRACE|Debug lineas servicio|Debug lineas servicio|JobDetailCard/EditForm" src
```

Resultado:

- `src/features/jobs/JobDetailCard.tsx:513`
  - `DEV TRACE - componente: JobDetailCard/EditForm`
- `src/features/jobs/JobDetailCard.tsx:681`
  - `Debug lineas servicio`
- `src/features/jobs/JobDetailCard.tsx:682`
  - `Componente: JobDetailCard/EditForm`

## Componente real que pinta la pantalla

Busqueda textual:

```bash
rg -n "La edicion mayor se trabaja fuera de la card|Microacciones|Añadir linea|Guardar cambios|Concepto 1|Editar servicio|Accion guiada" src
```

Hallazgo:

- `src/components/ActionFlowOverlay.tsx`
  - pinta `Accion guiada`
- `src/features/jobs/JobWorkspace.tsx`
  - abre `MajorEditFlowOverlay`
  - `title="Editar servicio"`
  - `description="La edicion mayor se trabaja fuera de la card..."`
- `src/features/jobs/JobDetailCard.tsx`
  - pinta `Microacciones`
  - pinta `Concepto {index + 1}`
  - pinta `Guardar cambios`

Conclusion:

- La pantalla real si es `JobDetailCard.tsx`.
- No se detecto un segundo editor duplicado para ese flujo.

## Por que no aparecia el panel anterior

- El texto publicado existia en el componente correcto.
- En `JobDetailCard.tsx` estaba condicionado por `import.meta.env.DEV`.
- Si el usuario abre una sesion con `vite preview`, un build ya compilado o un proceso sin reiniciar, `import.meta.env.DEV` puede ser `false` aunque el codigo local ya este en `f52e10f`.
- Por tanto, el problema bloqueante de visibilidad no apuntaba a Supabase ni a un editor equivocado; apuntaba a la condicion de render del debug.
- Ademas, el usuario estaba validando `https://app.costacleanbcn.com`, no el runtime local.
- En 2026-07-01 quedo confirmado que el dominio online podia ir por detras del repo local si el ultimo build no estaba publicado o no era el que el usuario tenia abierto.

## Marca visible anadida

Archivo modificado:

- `src/features/jobs/JobDetailCard.tsx`

Se anadio justo encima de la primera linea editable:

- banner rojo inline:
  - `DEV TRACE ACTIVO - COMPONENTE REAL: JobDetailCard.tsx - JOB EDITOR LINES`
- JSON inline:
  - `component`
  - `jobId`
  - `displayCode`
  - `billingLinesLength`
  - `billingLinesConcepts`
  - `editableLinesLength`
  - `editableLinesConcepts`
  - `importMetaDev`
  - `debugJobLinesFlag`

Queda en la misma zona donde hoy se ve `Concepto 1`.

## Como activarlo si import.meta.env.DEV es false

Condicion nueva:

```ts
const showJobLineDebug = import.meta.env.DEV || window.location.search.includes('debugJobLines=1')
```

URL de activacion:

```text
http://localhost:5173/?debugJobLines=1
```

O la URL real que este usando el usuario, anadiendo:

```text
?debugJobLines=1
```

Separacion repo vs deploy:

- Para comprobar que el dominio sirve el build correcto se anadio tambien una marca global por `?debugBuild=1`.
- Ver seguimiento de publicacion en:
  - `docs/ONLINE_DEPLOY_VERSION_QA.md`
- Una vez visible el panel en produccion, el siguiente diagnostico de lectura de `job_lines` quedo documentado en:
  - `docs/JOB_LINES_APPDATA_TO_EDITOR_FIX_QA.md`

## Valores que debe copiar el usuario

Al abrir el editor real, debe copiar:

- el banner rojo visible
- `billingLinesLength`
- `billingLinesConcepts`
- `editableLinesLength`
- `editableLinesConcepts`
- `importMetaDev`
- `debugJobLinesFlag`

## Validaciones

Comandos a ejecutar:

```bash
npm run lint
npm run test
npm run build
```

Despues, reiniciar el runtime que use el usuario:

- desarrollo:
  - `npm run dev`
- preview:
  - `npm run preview`

Si sigue sin verse el panel, abrir la URL con `?debugJobLines=1`.

## Commit

- Pendiente hasta terminar validaciones y push de este sprint.
