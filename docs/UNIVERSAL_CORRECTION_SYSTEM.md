# Universal Correction System

## 1. Propósito

Sistema para corregir productos digitales de forma profesional, rápida y segura. Convierte un problema observable en un cambio acotado, verificable, publicable y reversible, evitando pruebas ambiguas, sprints infinitos y cambios sin dirección.

Aplica a:

- bugs funcionales
- errores visuales
- problemas UX/UI
- problemas responsive
- errores backend
- errores frontend
- problemas de rendimiento
- errores de conversión
- problemas de SEO técnico
- problemas de accesibilidad
- inconsistencias de diseño
- regresiones de producción

Puede utilizarse en CRM, ecommerce, webs corporativas, landings, apps internas y proyectos React, Vite, Next, WordPress, GSAP u otros stacks. Las reglas específicas del repositorio siempre prevalecen sobre esta guía general.

## 2. Tipos de corrección

### Functional Fix

Errores donde una capacidad no funciona o produce un resultado incorrecto.

### Backend Fix

Errores de API, persistencia, permisos, cálculos, autenticación o datos.

### Frontend Fix

Errores de estado, rutas, formularios, componentes o renderizado.

### UX Fix

Errores de flujo, claridad, jerarquía, exceso de pasos o fricción.

### UI Fix

Errores visuales de alineación, espaciado, contraste, tamaños o botones.

### Responsive Fix

Errores mobile, tablet o desktop: overflow, scroll, layouts rotos o acciones inaccesibles.

### Performance Fix

Carga lenta, bundles pesados, imágenes sin optimizar o animaciones costosas.

### Accessibility Fix

Contraste, foco, navegación por teclado, labels, ARIA o tamaño táctil.

### Conversion Fix

Problemas que reducen reservas, ventas, formularios, leads o llamadas.

### Content/Copy Fix

Textos confusos, errores ortográficos, CTA débiles o mensajes inconsistentes.

Una incidencia puede tener un tipo principal y tipos secundarios. El tipo principal determina la validación y la persona responsable del cierre.

## 3. Severidades

### P0 — Crítico

- app caída
- login roto
- pérdida de datos
- facturación rota
- pagos rotos
- formulario principal no funciona
- producción inutilizable

Requiere contención inmediata, autorización explícita para cualquier acción productiva, evidencia continua y rollback preparado antes de publicar.

### P1 — Alto

- flujo principal roto
- cliente no puede reservar, comprar o contactar
- módulo clave no funciona
- error visual grave en mobile

Requiere un bloque corto, prioritario y validación completa del flujo afectado.

### P2 — Medio

- fallo parcial
- inconsistencia UX clara
- bug visual visible pero no bloqueante
- problema responsive localizado

Debe resolverse con alcance localizado y evidencia específica.

### P3 — Bajo

- polish UI
- microcopy
- pequeños ajustes visuales
- mejoras de claridad

No justifica reestructurar el producto ni tocar lógica crítica.

### P4 — Deuda

- documentación
- limpieza técnica
- refactor seguro
- mejora interna no urgente

Debe entrar en un sprint propio si crece más allá de un cambio pequeño y aislado.

## 4. Entrada mínima de un problema

Todo bug o corrección debe recibirse con:

- proyecto
- pantalla o ruta
- módulo
- síntoma
- severidad estimada
- evidencia, si existe
- resultado actual
- resultado esperado
- dispositivo
- navegador
- riesgo de datos, facturación o pagos
- alcance autorizado

Si falta información no crítica, se registra como supuesto verificable. Si falta una autorización que cambia el riesgo —producción, datos reales, pagos, fiscalidad, autenticación o despliegue— el trabajo se detiene antes de esa frontera.

La entrada se registra con [UNIVERSAL_BUG_REPORT.md](templates/UNIVERSAL_BUG_REPORT.md).

## 5. Diagnóstico

Antes de tocar código:

1. reproducir o localizar el fallo
2. identificar la versión y entorno observados
3. identificar archivos probables y contratos implicados
4. clasificar si es backend, frontend, UX, UI, responsive, performance u otro tipo
5. revisar las zonas críticas en [UNIVERSAL_RISK_ZONES.md](UNIVERSAL_RISK_ZONES.md) y las reglas locales
6. separar causa, síntoma y efectos colaterales
7. definir alcance, no-objetivos y plan corto
8. capturar una evidencia base reproducible

No se corrige por intuición si el comportamiento real puede inspeccionarse. Los riesgos fuera de alcance se documentan, no se arreglan oportunistamente.

## 6. Corrección

Reglas:

- aplicar el cambio mínimo suficiente
- no hacer refactor global salvo autorización
- preservar el diseño base del proyecto
- preservar datos y contratos API
- preservar rutas y navegación
- preservar responsive y accesibilidad
- no introducir dependencias sin necesidad aprobada
- mantener estados de error y recuperación explícitos
- trabajar en cambios pequeños, legibles y fáciles de revertir

Cada bloque debe tener una condición de salida: resultado esperado demostrado o bloqueo concreto documentado. Los descubrimientos nuevos solo amplían el sprint con autorización si cambian materialmente el alcance.

## 7. Validación proporcional

### P0/P1

- lint
- build
- tests
- flujo afectado
- smoke en preproducción o producción solo con autorización
- rollback listo
- monitorización posterior definida

### P2

- lint
- build
- test específico si existe
- captura o revisión visual cuando corresponda
- comprobación del flujo adyacente de mayor riesgo

### P3/P4

- validación mínima relevante
- revisión visual o manual
- build sin regresiones

Las reglas del repositorio pueden exigir gates adicionales. Un comando verde no sustituye la verificación del comportamiento afectado y una auditoría de código no sustituye QA visual o desplegada cuando se reclama ese resultado.

## 8. Publicación

La publicación sigue [UNIVERSAL_RELEASE_SYSTEM.md](UNIVERSAL_RELEASE_SYSTEM.md):

1. confirmar autorización y entorno objetivo
2. actualizar changelog o release log
3. revisar diff y archivos versionados
4. crear un commit claro
5. hacer push a la rama autorizada
6. verificar el deploy si forma parte del alcance
7. ejecutar smoke checks autorizados
8. registrar resultado, riesgo residual y rollback

No se toca producción, base de datos productiva, facturación, pagos, fiscalidad o datos sensibles sin autorización explícita y separada.

## 9. Rollback

Cada corrección debe indicar:

- commit anterior
- commit nuevo
- comando de reversión, normalmente `git revert <commit>`
- cuándo revertir
- cómo validar el rollback
- si existen cambios no reversibles de datos o infraestructura

El rollback se diseña antes de publicar. Nunca se presenta `git reset --hard`, el borrado de datos o la reescritura de historial compartido como rollback estándar.

## 10. Cierre operativo

Una corrección termina únicamente cuando:

- el resultado esperado tiene evidencia
- los gates aplicables pasan o el bloqueo queda documentado
- el diff contiene solo el alcance autorizado
- no hay secretos ni artefactos privados versionados
- el release log está actualizado
- commit y push se completan cuando el flujo los exige
- el rollback es ejecutable y comprobable

Si falta estado externo, credenciales, autorización o una build desplegada vigente, el resultado se clasifica como bloqueado o parcial; nunca como completado por aproximación.
