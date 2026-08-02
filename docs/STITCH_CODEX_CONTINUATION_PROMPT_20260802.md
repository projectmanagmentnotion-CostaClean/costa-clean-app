# Codex Continuation Prompt — Stitch Full Visual Parity

Copy the prompt below into Codex from the local repository.

```text
Actúa como Senior Product Designer, Senior React Frontend Architect y especialista en migraciones visuales de Google Stitch/Figma a aplicaciones reales.

REPOSITORIO:
projectmanagmentnotion-CostaClean/costa-clean-app

RAMA OBLIGATORIA:
prototype/stitch-full-visual-parity

BASE DE LA RAMA:
agent/stitch-fe-02-token-theme-fundamentals

OBJETIVO:
Continuar la implementación del prototipo visual que traslada literalmente la interfaz original de Google Stitch a Costa Clean CRM, manteniendo intactos datos, lógica, navegación, autenticación, Supabase, cálculos, documentos y consecuencias operativas.

No quiero un cambio superficial de colores. Quiero shell, navegación, proporciones, tipografía, avatares, assets, listas, KPI, Workspaces, StepFlows y módulos master-detail visualmente equivalentes a los exports originales.

# 1. PREPARACIÓN GIT

Ejecuta:

git fetch origin
git switch prototype/stitch-full-visual-parity
git pull --ff-only origin prototype/stitch-full-visual-parity
git status --short
git log -1 --oneline

Detente si:

- la rama no está limpia;
- existen cambios locales no relacionados;
- la rama no parte de `agent/stitch-fe-02-token-theme-fundamentals`;
- la PR #12 fue fusionada o modificada de forma inesperada;
- necesitas trabajar directamente sobre `main`.

No añadas commits a la rama de la PR #12.
No fusiones ninguna PR.

# 2. DOCUMENTOS OBLIGATORIOS

Lee completos y en este orden:

1. AGENTS.md
2. docs/FRONTEND_GLOBAL_BLUEPRINT.md
3. docs/STITCH_FRONTEND_REALITY_ROADMAP_20260731.md
4. docs/STITCH_FE_01_REAL_FRONTEND_AUDIT_20260802.md
5. docs/STITCH_FE_02_THEME_TOKENS_20260802.md
6. docs/STITCH_VISUAL_PARITY_MASTER_SPEC_20260802.md
7. docs/STITCH_FULL_VISUAL_PARITY_IMPLEMENTATION_PLAN_20260802.md
8. src/design-system/stitch/README.md
9. docs/UX_APP_MANUAL.md
10. docs/CODEX_WORKFLOW.md
11. docs/APP_QUALITY_GATES.md

Inspecciona también:

- src/design-system/stitch/stitchAssets.ts
- src/design-system/stitch/stitchAssets.test.ts
- src/design-system/stitch/stitchVisualParity.css
- public/ui-assets/**
- src/App.tsx
- src/app/AppShell.tsx
- src/app/AppNav.tsx
- src/app/AppShellViewRenderer.tsx
- src/app/AppShellPages.ts
- src/pages/HomePage.tsx
- src/pages/ClientsPage.tsx
- src/pages/PropertiesPage.tsx
- ClientWorkspace y PropertyWorkspace
- CSS real del shell, dashboard, clientes y propiedades

# 3. FUENTES ORIGINALES DE STITCH

Comprueba que existan localmente:

.project-agent/private/stitch-source/

con los seis ZIP originales.

Extrae temporalmente en:

.project-agent/private/stitch-extracted/

La carpeta está ignorada por Git.
No subas ZIPs, HTML exportado, capturas privadas ni URLs remotas de Stitch.

Si los ZIP no existen, detente y comunica exactamente qué archivos faltan. No simules el análisis.

Audita:

- 58 code.html;
- 59 screen.png;
- 7 DESIGN.md;
- handoff técnico;
- dimensiones;
- Tailwind classes;
- responsive;
- iconos;
- tipografía;
- imágenes;
- estados;
- duplicados y versiones corregidas.

No copies HTML completo a src/.

# 4. PRIMER INFORME ANTES DE EDITAR

Entrega un diagnóstico breve con:

- inventario de pantallas;
- pantallas canónicas;
- pantallas descartadas;
- mapa Stitch → componentes reales;
- archivos que se tocarán;
- riesgos;
- lógica protegida;
- orden de implementación.

Después implementa. No esperes otra confirmación salvo que exista una condición de parada real.

# 5. IMPLEMENTACIÓN POR BLOQUES

Trabaja en el siguiente orden. Cada bloque termina con validación, commit y push.

BLOCK 1 — Integración segura de primitives y assets

- valida `stitchAssets.ts`, sus tests y los SVG locales;
- importa `stitchVisualParity.css` de forma controlada;
- activa `.cc-stitch-prototype` únicamente en la rama prototipo;
- no permitas que la cascada rompa rutas públicas o documentos;
- crea avatar presentacional reutilizable solo si la arquitectura real lo justifica;
- usa avatar_url real, fallback local y finalmente iniciales;
- empresa = icono de edificio, nunca retrato inventado.

Commit sugerido:
feat(frontend): integrate Stitch visual primitives and assets

BLOCK 2 — Shell y navegación

Reconstruye visualmente AppShell/AppNav para obtener:

- rail desktop de 64–80 px;
- topbar de 64 px;
- logo compacto;
- active tile cian;
- búsqueda, alertas, tema y avatar en una línea;
- contenido inmediatamente visible;
- mobile header de 56–64 px;
- dock inferior Inicio, Clientes, Servicios, Facturas y Más;
- safe-area;
- cero etiquetas GENERAL/BASE/OPERACIONES repetidas dentro de botones;
- cero gran tarjeta de navegación.

Mantén exactamente:

- AppView;
- destinos;
- props;
- callbacks;
- alertas;
- tema;
- cuenta;
- logout;
- guard de navegación.

Commit sugerido:
prototype(frontend): rebuild shell and navigation from Stitch

BLOCK 3 — Splash, Login e Inicio

- splash equivalente a Stitch;
- login de 420–440 px, inputs/CTA de 56 px;
- dashboard con header compacto;
- CTA dominante;
- KPI pequeños;
- prioridades y servicios del día arriba;
- menos texto y menos tarjetas anidadas;
- primeros datos útiles sin scroll.

Mantén métricas, acciones, filtros y datos existentes.

Commit sugerido:
prototype(frontend): migrate splash login and home visuals

BLOCK 4 — Clientes, Propiedades y Workspaces

- directorios densos;
- buscador dominante;
- CTA junto al título;
- KPI compactos;
- avatar/icono, nombre, código, ubicación, estado y chevron;
- mobile cards compactas;
- identidad de Workspace de 64–80 px;
- KPI strip;
- siguiente acción;
- tabs y actividad como Stitch;
- imagen de propiedad 16:9 cuando aporte contexto;
- sin nested-card inflation.

Mantén duplicados, creación, guard de cambios, tabs reales y navegación contextual.

Commit sugerido:
prototype(frontend): migrate clients properties and workspaces

BLOCK 5 — StepFlows

Aplica la composición Stitch a:

- cliente;
- propiedad;
- presupuesto;
- servicio;
- factura;
- cobro;
- automatización de factura;
- duplicados;
- cambios sin guardar;
- éxito y recuperación.

Mobile full-height, progreso visible, primer campo arriba y footer sticky.
No cambies campos, pasos funcionales, validación ni persistencia.

Commit sugerido:
prototype(frontend): migrate guided creation flows

BLOCK 6 — Servicios, Presupuestos, Facturas y Cobros

Implementa master-detail:

- list pane 360–400 px;
- búsqueda y filtros compactos;
- selected row con borde cian;
- detail pane;
- entity header;
- estado;
- tabs;
- CTA arriba a la derecha;
- resumen/documento secundario;
- adaptación mobile de las pantallas exportadas.

No cambies estados, numeración, impuestos, totales, pagos ni documentos.

Commit sugerido:
prototype(frontend): migrate operational master-detail modules

BLOCK 7 — Alertas, Gastos y Cierre Fiscal

- listas compactas;
- panel de detalle;
- estados semánticos;
- importes jerarquizados;
- cierre fiscal ejecutivo;
- reemplaza contenido Aura Maritime por entidades reales;
- no inventes automatizaciones;
- no cambies cálculos ni advertencias deterministas.

Commit sugerido:
prototype(frontend): migrate alerts expenses and fiscal closing

BLOCK 8 — Responsive, accesibilidad y QA final

Viewports:

- 390x844
- 430x932
- 768x1024
- 1024x768
- 1366x900
- 1440x900

Valida dark y light:

- cero overflow horizontal;
- cero solapamientos;
- 44 px touch target;
- safe-area;
- focus-visible;
- navegación estable;
- avatar y assets correctos;
- primer contenido útil visible;
- loading/empty/error/success;
- misma acción = misma consecuencia;
- capturas comparativas sin datos personales.

Commit sugerido:
qa(frontend): close Stitch visual parity prototype

# 6. INVARIANCIA FUNCIONAL

Se permite:

- CSS;
- assets locales;
- reorganizar JSX presentacional;
- cambiar wrappers;
- extraer componentes visuales;
- cambiar layout y responsive;
- ordenar visualmente sin alterar orden funcional.

Prohibido:

- Supabase;
- SQL/RLS/RPC;
- queries o mutaciones;
- auth o sesión;
- rutas o AppView;
- props/callbacks públicos;
- validaciones;
- datos;
- estados de dominio;
- importes;
- impuestos;
- numeración;
- documentos;
- cálculos financieros/fiscales;
- mocks sustituyendo datos reales;
- nuevas dependencias;
- refactors ajenos.

INVARIANTE:
MISMAS ENTRADAS + MISMOS DATOS + MISMAS ACCIONES = MISMOS RESULTADOS FUNCIONALES.

# 7. VALIDACIÓN POR BLOQUE

Ejecuta:

pnpm exec eslint <todos-los-ts-tsx-modificados>
pnpm exec vitest run src/design-system/stitch/stitchAssets.test.ts --config vitest.config.mjs
pnpm run build
git diff --check
git status --short
git diff --stat

Ejecuta tests focalizados adicionales del shell, navegación y módulo afectado.

Reproduce los fallos globales preexistentes sin corregir deuda ajena.

Clasifica:

- PASS
- FAIL_PREEXISTING
- FAIL_NEW
- BLOCKED
- NOT_EXECUTED

No cierres ningún bloque con FAIL_NEW.

# 8. PR Y DEPLOYMENT

Abre o actualiza una PR en borrador:

HEAD:
prototype/stitch-full-visual-parity

BASE:
agent/stitch-fe-02-token-theme-fundamentals

TÍTULO:
prototype(frontend): full Stitch visual parity preview

La PR debe generar Vercel Preview.
No apuntes a main.
No fusiones.

# 9. INFORME FINAL

Entrega:

- HEAD inicial y final;
- commits por bloque;
- PR;
- URL Preview;
- archivos modificados;
- pantallas migradas;
- assets y avatar;
- QA por viewport;
- dark/light;
- pruebas;
- deuda preexistente;
- deuda nueva;
- limitaciones;
- diferencias restantes frente a Stitch;
- recomendación visual.

VEREDICTO OBLIGATORIO:
La rama cambia composición y presentación visual, pero mantiene datos,
props, callbacks, navegación, autenticación, Supabase, cálculos,
documentos y consecuencias operativas sin cambios.

Detente después de publicar la preview final. No fusiones ninguna PR.
```
