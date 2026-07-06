# GSAP Motion System

## 1. Objetivo del sistema de animaciones

Crear una base profesional y reutilizable de motion para la app usando GSAP, sin introducir animaciones oportunistas dentro de componentes de negocio y sin comprometer accesibilidad, rendimiento o claridad operativa.

Esta fase no anima pantallas productivas. Solo deja la base tecnica, los presets y las reglas globales.

## 2. Reglas globales

- La animacion debe ayudar a entender, no decorar.
- La animacion debe ser rapida.
- La animacion no debe tapar datos.
- La animacion no debe ocultar errores.
- La animacion no debe cambiar la percepcion de importes, estados fiscales o numeracion.
- Toda animacion debe tener cleanup.
- Toda animacion debe respetar `prefers-reduced-motion`.
- No usar GSAP en componentes de negocio sin pasar por `src/design-system/motion/`.
- No crear timelines largas sin justificacion.
- No usar `ScrollTrigger` en modulos internos densos sin sprint especifico.
- No usar scroll hijacking.
- No usar parallax pesado.
- No bloquear clicks.
- No animar layout de forma que provoque CLS visible.
- No animar cada card de una lista larga sin control de performance.
- No animar estados criticos como si fueran decorativos.

## 3. Que se puede animar

- entradas suaves de secciones o cards compartidas
- overlays, sheets y modales
- cambios de paso en StepFlow
- stagger corto en listas pequenas o controladas
- estados `empty`, `success` o confirmaciones no criticas
- previews documentales o skeleton transitions sin retrasar la accion principal

## 4. Que NO se puede animar

- importes, totales o calculos criticos de forma que parezcan cambiar de valor
- warnings fiscales, mismatch o bloqueos como si fueran decoracion
- CTA principales con retrasos largos o efectos que escondan su disponibilidad
- formularios largos con motion repetitiva por campo
- grids o listas largas con stagger agresivo
- scroll de pagina secuestrado
- parallax pesado
- cualquier animacion que altere la confianza del dato operativo

## 5. Como usar GSAP en React

Regla base:

- usar la capa compartida de `src/design-system/motion/`
- no importar `gsap` directamente dentro de modulos de negocio salvo sprint especifico y justificado

Entradas recomendadas:

- `useGsapEntrance`
- `motionPresets`
- `useReducedMotion`
- `gsap.ts` para registro centralizado

## 6. Como usar `@gsap/react` y `useGSAP`

La capa compartida registra `useGSAP` en `src/design-system/motion/gsap.ts`.

Reglas:

- usar `useGSAP` siempre con scope o target controlado
- confiar en `context` y `revert` para cleanup automatico
- no dejar listeners, observers o triggers vivos fuera del ciclo del componente
- si en el futuro se usa `ScrollTrigger`, debe registrarse localmente y con cleanup explicito

## 7. Como respetar `prefers-reduced-motion`

La capa compartida expone:

- `REDUCED_MOTION_QUERY`
- `useReducedMotion()`
- `getInitialReducedMotionPreference()`

Regla:

- si el usuario pide reduced motion, la animacion debe omitirse o resolverse con un `set` inmediato a estado final
- reduced motion no significa romper layout; significa eliminar transicion no esencial

## 8. Como limpiar animaciones

- usar `useGSAP` desde la capa central
- mantener la animacion dentro del contexto GSAP del componente
- no crear listeners globales sin cleanup
- no dejar `ScrollTrigger`, observers o matchMedia sin revert/desuscripcion

## 9. Presets disponibles

Disponibles en `src/design-system/motion/motionPresets.ts`:

- `fadeIn`
- `fadeUp`
- `scaleIn`
- `softReveal`
- `listStagger`
- `stepTransition`
- `sheetEnter`
- `modalEnter`

Todos los presets:

- son cortos
- usan easing suave
- tienen delay minimo o nulo
- no incluyen rebotes exagerados
- tienen fallback de reduced motion

## 10. Duraciones recomendadas

- `motionDurationFast = 0.18`
- `motionDurationBase = 0.28`
- `motionDurationSlow = 0.42`

Regla:

- `fast` para micro entrada o feedback visual ligero
- `base` para secciones, cards, paneles y cambios de paso
- `slow` solo para entradas mas grandes como modales o sheets, sin superar un ritmo sobrio

## 11. Easing recomendado

- `motionEaseStandard = power2.out`
- `motionEaseExit = power2.in`
- `motionEaseEmphasized = power3.out`

Regla:

- usar easing predecible y corto
- evitar elastic, bounce o back agresivo salvo demo controlada fuera de produccion

## 12. Motion por tipo de componente

### AppShell

- solo transiciones leves de entrada o cambio de panel
- nada que retrase navegacion ni interfiera con la lectura del contexto activo

### Dashboard

- micro entradas de cards o bloques de soporte
- sin convertir el Home en un escenario animado

### StepFlow

- `stepTransition`
- `sheetEnter`
- transiciones de paso cortas y funcionales
- reduced motion obligatorio

### Listas

- `listStagger` solo en lotes pequenos, controlados y no infinitos
- evitar stagger en listas largas o cuando los datos cambian continuamente

### Cards

- `fadeUp`, `softReveal` o `scaleIn` sutil
- sin movimiento exagerado en cada render

### Modales

- `modalEnter`
- entrada corta, sin rebote

### Sheets

- `sheetEnter`
- clara, corta y sin bloquear la accion principal

### Estados empty/error/success

- solo entradas suaves
- nunca ocultar el mensaje o retrasar la comprension del estado

### Document preview

- usar motion solo para loading/entrada de preview
- nunca para sugerir cambios de contenido o de importes

## 13. Motion prohibido

- animar importes o calculos criticos de forma confusa
- ocultar warnings fiscales
- retrasar acciones principales
- animaciones largas en formularios
- scroll hijacking
- parallax pesado
- animaciones en facturas o numeracion que puedan parecer cambio de dato

## 14. Reglas para modulos criticos

### Facturas

- no animar importes, mismatch, numeracion ni estados fiscales de forma interpretativa
- cualquier motion futura debe ser estrictamente de entrada/salida de superficie, no del dato

### Numeracion

- ninguna animacion debe sugerir renumeracion, refresh optimista o cambio visual ambiguo del codigo

### Pagos

- evitar motion que convierta confirmaciones financieras en feedback decorativo

### Cierre fiscal

- motion minima, sobria y no invasiva
- nunca maquillar warnings o incertidumbre fiscal con transiciones llamativas

## 15. Checklist de QA para cada animacion

- ¿ayuda a entender una transicion real?
- ¿respeta `prefers-reduced-motion`?
- ¿tiene cleanup automatico?
- ¿no bloquea clicks ni foco?
- ¿no retrasa la accion principal?
- ¿no altera la percepcion del dato?
- ¿no provoca CLS visible?
- ¿no genera ruido en listas largas?
- ¿mantiene accesibilidad base y orden logico?

## 16. Plan de adopcion por fases

### Motion Phase 1

- GSAP foundation and manual

### Motion Phase 2

- animate shared primitives

### Motion Phase 3

- animate StepFlow and overlays

### Motion Phase 4

- animate dashboards/lists safely

### Motion Phase 5

- motion QA and performance pass
