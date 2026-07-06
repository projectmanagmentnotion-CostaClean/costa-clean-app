# GSAP Plugin Matrix

## Tabla de plugins

| Plugin | Utilidad para Costa Clean | Estado | Riesgo | Donde se puede usar | Donde no se puede usar |
| --- | --- | --- | --- | --- | --- |
| `ScrollTrigger` | reveals controlados, entradas de bloques y activacion por viewport | recomendado / preparado | medio | dashboard, secciones informativas, bloques no criticos, landings publicas | facturas, numeracion, pagos, cierre fiscal sensible, listas densas con mucho recambio |
| `DrawSVGPlugin` | trazado progresivo de iconografia o SVG de apoyo | recomendado / preparado con fallback | medio | ilustraciones, lineas decorativas controladas, onboarding visual corto | graficos criticos, datos fiscales, superficies donde el fallback no este previsto |
| `MorphSVGPlugin` | transiciones SVG puntuales entre estados visuales simples | preparado | medio | iconos o ilustraciones no criticas | datos criticos, warnings, cualquier estado que pueda parecer cambio de valor |
| `SplitText` | revelar titulares cortos de forma sobria | preparado | medio | hero titles, titulares cortos, mensajes de exito controlados | formularios, tablas, datos criticos, textos largos |
| `Flip` | reordenacion suave de cards o listas pequenas | preparado | medio | cards pequenas, mini grids, overlays o modales controlados | listas largas, facturas, numeracion, grids grandes, modulos densos |
| `ScrollToPlugin` | scroll guiado a paso, error o bloque concreto | preparado | bajo | StepFlow, saltos dirigidos a errores, secciones internas claras | scroll hijacking, navegacion interna del shell como sustituto de routing |
| `MotionPathPlugin` | recorrido SVG decorativo o tutorial controlado | preparado | medio | demos aisladas, SVG decorativo, onboarding grafico puntual | datos criticos, modulos fiscales, layouts productivos densos |
| `Observer` | gestos o input avanzado controlado | preparado con restriccion | alto | overlays especificos, interacciones aisladas con sprint propio | shell general, modulos criticos, handlers globales sin sprint especifico |
| `Draggable` | drag controlado en microinteracciones concretas | preparado con restriccion | alto | demos aisladas, builders pequenos, paneles no criticos | flujos criticos, facturas, pagos, cierre fiscal, listas operativas principales |
| `ScrollSmoother` | suavizado global de scroll | pospuesto / prohibido por ahora | alto | ninguno en esta fase | app interna completa |
| `InertiaPlugin` | fisica/inercia avanzada | pospuesto / prohibido por ahora | alto | ninguno en esta fase | flujos productivos y modulos de negocio |
| `Physics2DPlugin` | fisica 2D decorativa | pospuesto / prohibido por ahora | alto | ninguno en esta fase | toda la app productiva |
| `PhysicsPropsPlugin` | fisica por propiedades | pospuesto / prohibido por ahora | alto | ninguno en esta fase | toda la app productiva |
| `PixiPlugin` | motion sobre Pixi/canvas | pospuesto / prohibido por ahora | alto | ninguno en esta fase | toda la app productiva |
| `EaselPlugin` | motion sobre EaselJS | pospuesto / prohibido por ahora | alto | ninguno en esta fase | toda la app productiva |
| `GSDevTools` | depuracion de timelines | pospuesto / prohibido por ahora | medio | debug local aislado futuro, si se aprueba | bundle/runtime productivo |
| `ScrambleTextPlugin` | texto scramble decorativo | pospuesto / prohibido por ahora | medio | ninguno en esta fase | copy operativo, datos, formularios, modulos productivos |
| `TextPlugin` | tween de texto | pospuesto / prohibido por ahora | medio | ninguno en esta fase | importes, labels, datos operativos, formularios |

## Plugins recomendados

- `ScrollTrigger`
- `DrawSVGPlugin` con fallback
- `MorphSVGPlugin`
- `SplitText`
- `Flip`
- `ScrollToPlugin`
- `MotionPathPlugin`
- `Observer`
- `Draggable`

## Plugins pospuestos/prohibidos

- `ScrollSmoother`
- `InertiaPlugin`
- `Physics2DPlugin`
- `PhysicsPropsPlugin`
- `PixiPlugin`
- `EaselPlugin`
- `GSDevTools`
- `ScrambleTextPlugin`
- `TextPlugin`

## Reglas

- No usar GSAP directamente en modulos de negocio.
- No usar `ScrollTrigger` fuera de helpers compartidos.
- No usar `DrawSVGPlugin` sin fallback.
- No usar `SplitText` en formularios.
- No usar `Flip` en listas largas.
- No usar `Draggable` en flujos criticos.
- No usar `Observer` sin sprint especifico.
- No usar `ScrollSmoother` en la app interna sin aprobacion.
- No usar efectos decorativos en datos fiscales, facturas, numeracion, pagos o cierre fiscal.

## Plan de instalacion / adopcion

- Phase 1B: preparar plugins
- Phase 2: Home GSAP dashboard
- Phase 3: StepFlow motion
- Phase 4: list/card microinteractions
- Phase 5: QA performance/accessibility
