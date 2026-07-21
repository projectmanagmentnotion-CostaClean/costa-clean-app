# Codex Universal Corrector Protocol

Prompts base para ejecutar correcciones con evidencia, alcance explícito y cierre reversible. Antes de usarlos, leer las reglas del repositorio y [UNIVERSAL_CORRECTION_SYSTEM.md](UNIVERSAL_CORRECTION_SYSTEM.md).

## Prompt 1: corregir bug

```text
Corrige este problema siguiendo docs/UNIVERSAL_CORRECTION_SYSTEM.md:

Proyecto:
Tipo:
Severidad:
Pantalla/ruta:
Descripción:
Resultado actual:
Resultado esperado:
Evidencia:
Alcance autorizado:
Zonas prohibidas:

Antes de tocar código:
1. clasifica el problema
2. identifica archivos probables
3. detecta riesgos
4. propone plan corto
5. corrige solo lo necesario
6. valida proporcionalmente
7. actualiza release log
8. commit/push
9. entrega resumen y rollback

No toques producción, datos reales, facturación, pagos, fiscalidad, auth o despliegues sin autorización explícita. Si falta evidencia o autorización crítica, detente en esa frontera y documenta el bloqueo.
```

## Prompt 2: corregir UX/UI

```text
Corrige esta pantalla siguiendo docs/UX_UI_CORRECTION_SYSTEM.md:

Proyecto:
Pantalla/ruta:
Objetivo del usuario:
Problema UX/UI:
Dispositivo principal:
Evidencia:
Alcance autorizado:

Debes revisar:
- jerarquía
- acción principal
- espaciado
- responsive
- claridad
- scroll
- botones
- estados vacíos
- accesibilidad
- diseño visual profesional

No hagas rediseño completo salvo autorización.
Haz cambios mínimos de alto impacto.
Valida y haz commit/push según las reglas del repositorio.
No declares QA visual o desplegada si solo existe evidencia de código.
```

## Prompt 3: preparar release

```text
Prepara esta actualización siguiendo docs/UNIVERSAL_RELEASE_SYSTEM.md:

Proyecto:
Tipo de release:
Cambios:
Riesgos:
Validación:
Rollback:

Actualiza changelog/release log, valida, commit/push.
No despliegues ni toques producción sin autorización explícita. Confirma el commit desplegado antes de afirmar éxito de deploy.
```

## Contrato de ejecución

Codex debe:

- leer primero las instrucciones locales del proyecto
- inspeccionar estado, versión y archivos reales
- declarar alcance, no-objetivos, riesgos y plan antes de editar
- usar el cambio mínimo suficiente
- mantener producción y dominios sensibles fuera de alcance por defecto
- ejecutar todos los gates exigidos
- revisar diff, status y archivos privados antes del commit
- registrar evidencia exacta, skips y bloqueos
- entregar commit anterior, commit final y rollback

Los prompts no conceden por sí solos autorización para producción, bases de datos, pagos, fiscalidad, secretos, despliegues o comunicaciones externas.
