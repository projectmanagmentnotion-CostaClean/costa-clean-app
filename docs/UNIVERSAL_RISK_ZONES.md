# Universal Risk Zones

Mapa base para clasificar el radio de impacto antes de corregir o publicar. Debe combinarse con el mapa de riesgos específico del proyecto.

## Datos / Backend

- base de datos productiva
- auth
- permisos
- APIs
- migraciones
- webhooks
- jobs automáticos
- integraciones externas

Riesgos: pérdida o corrupción de datos, exposición, incompatibilidad de contratos, duplicados y efectos externos. Requieren entorno confirmado, autorización explícita, copia o rollback viable y validación de permisos.

## Finanzas / Fiscalidad

- facturas
- pagos
- cierres
- numeración fiscal
- impuestos
- cobros
- presupuestos aceptados

Riesgos: importes incorrectos, duplicidad, secuencias inválidas y obligaciones fiscales. Nunca se cambian ni prueban con escrituras reales sin alcance y autorización específicos. Un ajuste visual no autoriza alterar reglas o persistencia.

## Frontend / UX

- navegación
- formularios
- checkout
- reserva o contacto
- CTA
- responsive
- accesibilidad

Riesgos: bloqueo de conversión, pérdida de estado, acciones inaccesibles y regresiones entre viewports. Validar rutas, estados, teclado, tamaños táctiles y el flujo principal completo.

## Producción / Deploy

- variables de entorno
- DNS
- hosting
- CDN
- build
- assets
- caché
- rollback

Riesgos: desplegar el commit incorrecto, configuración divergente, caché obsoleta o caída global. Push y deploy son eventos distintos; ambos necesitan evidencia propia.

## Marca / Diseño

- logos
- tipografía
- colores
- espaciado
- imágenes
- tono visual
- consistencia

Riesgos: pérdida de reconocimiento, incoherencia, problemas de licencia y degradación de accesibilidad. Preservar sistema existente y justificar todo cambio de dirección.

## Clasificación operativa

Para cada zona afectada, registrar:

- entorno
- datos reales implicados
- severidad e impacto
- autorización disponible
- prueba mínima
- rollback
- responsable de decisión

Si una zona sensible aparece durante el diagnóstico pero queda fuera del alcance autorizado, se documenta como riesgo y se detiene cualquier mutación sobre ella.

## Reglas universales de exclusión

Nunca versionar:

- `.env` con valores reales
- tokens, cookies o claves
- perfiles de autenticación
- dumps privados
- screenshots o reportes privados
- `storageState`
- credenciales de proveedores

Nunca asumir que un entorno es sandbox solo por su nombre. Verificar su identidad antes de cualquier escritura.
