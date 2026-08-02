# Codex Continuation Prompt — Stitch Full Visual Parity

Copy the prompt below into Codex from the local repository.

```text
Actúa como Senior Product Designer, Senior React Frontend Architect y especialista en migraciones visuales de Google Stitch/Figma a aplicaciones reales.

REPOSITORIO:
projectmanagmentnotion-CostaClean/costa-clean-app

RAMA OBLIGATORIA:
prototype/stitch-full-visual-parity

PR DE TRABAJO:
#13

OBJETIVO:
Continuar el prototipo que traslada literalmente la interfaz original de Google Stitch a Costa Clean CRM sin cambiar datos, lógica, navegación, autenticación, Supabase, cálculos, documentos ni consecuencias operativas.

No quiero un cambio superficial de colores. Deben trasladarse shell, navegación, proporciones, tipografía, avatares, assets, listas, KPI, Workspaces, StepFlows y módulos master-detail.

# 1. PREPARACIÓN GIT

Ejecuta:

git fetch origin
git switch prototype/stitch-full-visual-parity
git pull --ff-only origin prototype/stitch-full-visual-parity
git status --short
git log -1 --oneline

Detente si el árbol no está limpio o si necesitas trabajar en main.
No añadas commits a la rama de la PR #12.
No fusiones ninguna PR.

# 2. LECTURA OBLIGATORIA

Lee completos y en este orden:

1. AGENTS.md
2. docs/STITCH_SOURCE_SET_CORRECTION_20260802.md
3. docs/FRONTEND_GLOBAL_BLUEPRINT.md
4. docs/STITCH_FRONTEND_REALITY_ROADMAP_20260731.md
5. docs/STITCH_FE_01_REAL_FRONTEND_AUDIT_20260802.md
6. docs/STITCH_FE_02_THEME_TOKENS_20260802.md
7. docs/STITCH_VISUAL_PARITY_MASTER_SPEC_20260802.md
8. docs/STITCH_FULL_VISUAL_PARITY_IMPLEMENTATION_PLAN_20260802.md
9. src/design-system/stitch/README.md
10. scripts/stitch/README.md
11. docs/UX_APP_MANUAL.md
12. docs/CODEX_WORKFLOW.md
13. docs/APP_QUALITY_GATES.md

La corrección de fuente tiene prioridad sobre cualquier documento anterior que mencione seis ZIP.

# 3. FUENTE DEFINITIVA DE STITCH

El usuario confirmó que el handoff definitivo contiene exactamente cuatro ZIP:

- stitch_costa_clean_crm_system.zip
- stitch_costa_clean_crm_system (1).zip
- stitch_costa_clean_crm_system (2).zip
- stitch_costa_clean_crm_system (3).zip

No esperes paquetes (4) ni (5).
No pidas al usuario stitch-source-report.json: el script lo genera automáticamente.

Verifica que los cuatro archivos existan en:

.project-agent/private/stitch-source/

Ejecuta desde la raíz del repositorio:

powershell -ExecutionPolicy Bypass -File .\scripts\stitch\prepare-stitch-source.ps1 -SourceFolder .project-agent\private\stitch-source

El script debe generar:

.project-agent/private/stitch-source/stitch-source-report.json

Acepta la fuente únicamente cuando el informe confirme exactamente:

- 4 ZIP
- 58 code.html
- 59 screen.png
- 7 DESIGN.md
- content_inventory_complete = true

Si el conteo no coincide, detente y comunica el déficit exacto por paquete. No inventes paquetes adicionales.

Extrae temporalmente en:

.project-agent/private/stitch-extracted/

No subas ZIP, HTML, capturas ni el informe privado a GitHub.
No copies el HTML completo a src/.

# 4. DIAGNÓSTICO ANTES DE EDITAR

Audita todos los exports y entrega primero:

- inventario por paquete;
- pantallas canónicas;
- duplicados;
- versiones corregidas;
- pantallas descartadas por dominio inventado;
- mapa Stitch → componente React real;
- archivos que se tocarán;
- riesgos;
- lógica protegida;
- orden del bloque actual.

Después implementa sin esperar otra confirmación salvo un bloqueo real.

# 5. ESTADO ACTUAL

La rama ya contiene:

- especificación visual canónica;
- plan de implementación;
- CSS Stitch activado bajo cc-stitch-prototype;
- manifiesto de assets;
- StitchAvatar;
- assets fallback locales;
- integración inicial de splash, login y cuenta;
- ajustes de contraste y alineación.

No declares paridad completa.
No vuelvas a limitarte a tokens o contraste.

# 6. PRÓXIMO BLOQUE OBLIGATORIO

Transforma visualmente estas superficies:

1. Inicio / Dashboard.
2. Directorio de Clientes.
3. Workspace de Cliente.
4. Shell y navegación estrictamente necesarios para esas superficies.

## Inicio

Debe reproducir la composición Stitch:

- header compacto;
- CTA dominante;
- KPI pequeños;
- prioridades;
- servicios del día;
- alertas necesarias;
- primera información útil visible;
- menos texto;
- menos wrappers;
- menos tarjetas anidadas;
- sin gran tarjeta exterior.

Mantén métricas, datos, callbacks, filtros y acciones.

## Directorio de Clientes

Implementa:

- título y Nuevo cliente alineados;
- buscador dominante;
- filtros secundarios compactos;
- KPI pequeños;
- filas densas;
- avatar, iniciales o icono de empresa;
- nombre, código, ubicación, actividad, estado y chevron;
- lista compacta en escritorio;
- cards ligeras en móvil.

No cambies búsqueda, filtros, creación, duplicados, IDs ni navegación al Workspace.
No inventes fotografías de clientes.

## Workspace de Cliente

Implementa:

- identidad compacta;
- avatar de 64–80 px;
- nombre, código y estado;
- próxima acción;
- KPI strip;
- tabs compactas;
- propiedades, servicios, presupuestos, facturas, cobros y actividad;
- una superficie por intención;
- menos nested cards;
- adaptación móvil equivalente al export corregido.

Mantén tabs reales, relaciones, callbacks, navegación y guard de cambios sin guardar.

## Shell

Desktop:

- rail de 64–80 px;
- topbar de 64 px;
- avatar visible;
- active tile cian;
- navegación silenciosa;
- contenido como protagonista.

Mobile:

- header 56–64 px;
- dock 68–76 px;
- Inicio, Clientes, Servicios, Facturas y Más;
- safe-area;
- cero solapamientos.

Mantén AppView, destinos, props, handlers, alertas, tema, cuenta y logout.

# 7. INVARIANCIA FUNCIONAL

Se permite:

- CSS;
- assets locales;
- JSX presentacional;
- wrappers;
- componentes visuales;
- layout;
- responsive;
- iconos;
- avatar;
- orden visual sin cambiar consecuencias.

Está prohibido cambiar:

- Supabase;
- SQL, RLS o RPC;
- queries o mutaciones;
- auth o sesión;
- rutas o AppView;
- props y callbacks públicos;
- validaciones;
- estados de dominio;
- datos;
- importes;
- impuestos;
- numeración;
- documentos;
- cálculos financieros o fiscales;
- dependencias;
- mocks sustituyendo datos reales;
- refactors ajenos.

INVARIANTE:
MISMAS ENTRADAS + MISMOS DATOS + MISMAS ACCIONES = MISMOS RESULTADOS FUNCIONALES.

# 8. QA

No uses producción para validar esta rama.
Usa exclusivamente servidor local de la rama o Preview de la PR #13 asociado al HEAD exacto.
No realices escrituras reales.

Viewports:

- 390x844
- 430x932
- 768x1024
- 1024x768
- 1366x900
- 1440x900

Dark y light.

Comprueba:

- cero overflow horizontal;
- cero solapamientos;
- 44 px touch targets;
- safe-area;
- focus-visible;
- primer contenido útil visible;
- avatar correcto;
- CTA dominante;
- listas densas;
- misma acción = misma consecuencia.

# 9. VALIDACIÓN

Ejecuta:

pnpm exec eslint <todos-los-ts-tsx-modificados>
pnpm exec vitest run src/design-system/stitch/stitchAssets.test.ts --config vitest.config.mjs
pnpm exec vitest run src/app/theme.test.ts --config vitest.config.mjs
pnpm run build
git diff --check
git status --short
git diff --stat

Ejecuta tests focalizados adicionales de shell, navegación y clientes.
Reproduce fallos globales preexistentes sin corregir deuda ajena.
No cierres con FAIL_NEW.

# 10. COMMIT Y PUSH

Cierra el bloque con commit y push en la misma rama.

Mensaje recomendado:

prototype(frontend): apply Stitch parity to home and clients

Mantén la PR #13 en borrador y con base:

agent/stitch-fe-02-token-theme-fundamentals

No apuntes a main.
No fusiones.

# 11. INFORME FINAL

Entrega:

- HEAD inicial;
- HEAD final;
- commit;
- inventario de los cuatro ZIP;
- conteos 58/59/7;
- archivos modificados;
- componentes creados;
- cambios de Inicio;
- cambios de Clientes;
- cambios de Workspace;
- cambios de shell;
- assets y avatares;
- URL Preview;
- SHA exacto desplegado;
- QA por viewport;
- dark/light;
- pruebas;
- limitaciones;
- diferencias pendientes frente a Stitch;
- veredicto de invariancia funcional.

Detente después de publicar el Preview del bloque.
```
