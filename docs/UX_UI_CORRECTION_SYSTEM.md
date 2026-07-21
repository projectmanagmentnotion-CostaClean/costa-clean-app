# UX/UI Correction System

Guía para corregir experiencia y presentación sin convertir un ajuste localizado en un rediseño especulativo. Complementa [UNIVERSAL_CORRECTION_SYSTEM.md](UNIVERSAL_CORRECTION_SYSTEM.md) y las reglas visuales propias de cada producto.

## Principios

1. Claridad antes que decoración.
2. Una acción principal por pantalla.
3. Botones cerca de su consecuencia.
4. Menos scroll innecesario.
5. Menos capas visuales.
6. Jerarquía clara.
7. Diseño mobile-first.
8. Estados vacíos útiles.
9. Errores humanos y recuperables.
10. Lectura rápida en 5 segundos.

## Método de corrección

1. Definir el objetivo real del usuario y la acción principal.
2. Capturar el estado actual en los viewports relevantes.
3. Identificar fricción, información repetida y barreras de accesibilidad.
4. Proponer el cambio mínimo de mayor impacto.
5. Preservar contratos, comportamiento y lenguaje de marca.
6. Validar estados, responsive, teclado y consecuencia de la acción.
7. Registrar antes/después con [UX_UI_AUDIT_REPORT.md](templates/UX_UI_AUDIT_REPORT.md).

## Checklist UI

Revisar:

- alineación
- espaciado
- jerarquía tipográfica
- contraste
- tamaño táctil mínimo
- separación entre acciones
- botones primarios y secundarios
- estados hover, focus y disabled
- consistencia de cards
- consistencia de formularios
- modales no invasivos
- navegación clara
- scroll lógico
- iconos necesarios solamente
- no duplicar acciones
- no saturar con badges
- no usar sombras o bordes sin criterio

El ajuste visual debe seguir los tokens y componentes existentes. Si el problema requiere inventar un sistema paralelo, el alcance debe reevaluarse.

## Checklist UX

Revisar:

- qué quiere hacer el usuario
- cuál es la acción principal
- cuántos pasos sobran
- qué información sobra
- qué información falta
- si el flujo tiene salida clara
- si el error explica cómo resolverlo
- si hay confirmación después de guardar
- si el usuario puede volver atrás
- si el contenido está agrupado por intención
- si los estados loading, empty, error, saving, success y recovery están definidos
- si una decisión irreversible tiene revisión y consecuencia explícita

## Checklist responsive

### Mobile

- sin overflow horizontal
- botones visibles y alcanzables
- formularios cómodos
- tablas convertidas a cards o lectura equivalente cuando sea necesario
- acciones críticas accesibles
- navegación compacta
- primer campo accionable visible al abrir create/edit
- una superficie visual por intención

### Tablet

- layout equilibrado
- cards sin columnas forzadas
- filtros manejables
- sin heredar overflow del shell desktop
- acciones secundarias agrupadas antes de crear filas nuevas

### Desktop

- no estirar contenido inútilmente
- ancho máximo razonable
- jerarquía clara
- uso correcto del espacio
- soporte contextual sin competir con la decisión principal

Los viewports deben definirse por producto. En Costa Clean, las superficies visuales relevantes se validan como mínimo en `390x844`, `768x1024` y desktop cuando el sprint requiere QA viva.

## Checklist visual profesional

Corregir:

- iconos amateur
- paddings inconsistentes
- botones pegados
- cards recargadas
- texto demasiado pequeño
- CTA débiles
- jerarquía confusa
- demasiados colores
- fondos sin propósito
- exceso de bordes
- exceso de sombras
- estados vacíos pobres

## Accesibilidad mínima

- orden de foco coherente con el orden visual
- navegación por teclado completa
- foco visible
- labels asociados a controles
- errores vinculados a sus campos
- contraste legible en todos los estados
- estado comunicado sin depender solo del color
- targets táctiles adecuados
- motion compatible con `prefers-reduced-motion`
- semántica nativa antes que ARIA añadida

## Evidencia y cierre

Una corrección UX/UI no se cierra solo por inspección de código. Debe registrar:

- problema y objetivo del usuario
- viewport, navegador y versión observados
- antes y después comparables
- estados y recorridos validados
- problemas que quedan fuera de alcance
- resultado de lint, build y tests exigidos por el proyecto

Si la sesión autenticada o el entorno real no están disponibles, la validación visual se declara bloqueada o parcial. No se inventan capturas ni éxito desplegado.
