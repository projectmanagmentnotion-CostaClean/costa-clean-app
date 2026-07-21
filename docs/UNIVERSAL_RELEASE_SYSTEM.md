# Universal Release System

Sistema para convertir cambios verificados en releases trazables, autorizadas y reversibles. Se usa junto con [UNIVERSAL_CORRECTION_SYSTEM.md](UNIVERSAL_CORRECTION_SYSTEM.md) y las reglas de entrega del repositorio.

## Tipos de release

### hotfix

- bug urgente
- cambio pequeño
- validación rápida pero suficiente
- rollback inmediato preparado

### patch

- correcciones pequeñas
- UX/UI menores
- bugs no críticos

### minor

- mejora funcional
- nuevo bloque de UX
- nuevo módulo pequeño

### major

- cambio estructural
- rediseño
- migración
- cambio de arquitectura

La etiqueta describe impacto y riesgo, no el tiempo invertido. Un cambio corto sobre pagos o datos puede exigir controles de release más estrictos que una mejora visual amplia.

## Flujo

1. Intake
2. Clasificación
3. Plan
4. Corrección
5. Validación
6. Changelog
7. Commit
8. Push
9. Deploy check
10. Rollback plan

### 1. Intake

Registrar proyecto, objetivo, entorno, versión base, alcance autorizado y zonas prohibidas.

### 2. Clasificación

Definir tipo de release, severidad, riesgo de datos y responsables de aprobación y validación.

### 3. Plan

Usar [RELEASE_PLAN.md](templates/RELEASE_PLAN.md) para declarar incluidos, excluidos, gates y condiciones de parada.

### 4. Corrección

Trabajar en cambios pequeños. No mezclar refactors, deuda o dominios que no sean necesarios para el resultado.

### 5. Validación

Ejecutar los gates del repositorio y la validación proporcional a severidad. Distinguir código local, entorno desplegado y producción.

### 6. Changelog

Actualizar el changelog propio del proyecto o [UNIVERSAL_RELEASE_LOG.md](UNIVERSAL_RELEASE_LOG.md) con fecha, proyecto, tipo, resumen, commit, validación, riesgo y rollback.

### 7. Commit

El commit debe ser atómico, descriptivo y libre de secretos o artefactos privados.

### 8. Push

Subir únicamente a la rama y remoto autorizados. Confirmar que el remoto contiene el commit esperado.

### 9. Deploy check

Solo si está autorizado: verificar que el despliegue corresponde al commit, que arranca y que el smoke check relevante pasa. Un push exitoso no demuestra un deploy exitoso.

### 10. Rollback plan

Registrar commit anterior, nuevo commit, comando o procedimiento, señales para revertir y verificación posterior.

## Naming commits

- `fix:` corrección funcional o técnica
- `ux:` corrección de flujo o comprensión
- `ui:` corrección visual
- `perf:` rendimiento
- `docs:` documentación
- `qa:` cobertura o evidencia de calidad
- `release:` preparación de versión
- `hotfix:` corrección urgente

Ejemplos:

- `fix: resolve client creation crash`
- `ux: simplify invoice detail actions`
- `ui: polish mobile navigation spacing`
- `perf: optimize hero image loading`
- `docs: update production correction protocol`

## Gates por entorno

### Local

- diff revisado
- lint, build y tests aplicables
- comportamiento afectado validado
- ningún secreto versionado

### Preproducción

- build identificada por commit
- configuración esperada
- smoke del flujo afectado
- integraciones aisladas o explícitamente permitidas
- rollback disponible

### Producción

- autorización explícita
- ventana y responsable definidos
- versión y entorno confirmados
- monitorización activa
- no ejecutar escrituras, migraciones, pagos o acciones fiscales fuera del alcance aprobado

## Reglas de parada

La release se detiene si:

- falla un gate obligatorio
- el diff contiene archivos inesperados
- faltan credenciales o autorizaciones necesarias
- la build desplegada no coincide con el commit
- aparece riesgo no evaluado de datos, pagos, auth o fiscalidad
- el rollback no es viable
- la evidencia solo demuestra fuente local pero se pretende afirmar éxito desplegado

## Estrategia de rollback

Para cambios solo de código, el camino preferido es `git revert <commit>` y un nuevo despliegue controlado. Para migraciones, datos, infraestructura o integraciones, el plan debe ser específico y aprobado antes del release; revertir código no garantiza revertir efectos externos.

Después del rollback se repiten el build, el arranque y el smoke que demuestran la recuperación. El evento y su causa se registran en el release log.
