# Roadmap de facturación y automatización

**Proyecto:** Costa Clean App  
**Fecha de apertura:** 2026-07-29  
**Estado inicial:** `OPEN — BA-0 NOT_STARTED`  
**Rama de preparación:** `agent/billing-automation-roadmap`  
**Ámbito:** CRM interno de Costa Clean; clientes, propiedades, presupuestos, servicios, facturas, pagos, ingresos, gastos, recurrencias, documentos y comunicaciones.

## 1. Motivo de este roadmap

El roadmap general de transformación de la app quedó cerrado el 2026-07-23. Esta iniciativa abre un alcance transversal nuevo y separado para convertir la facturación en un sistema más rápido, reutilizable, auditable y automatizable sin debilitar numeración fiscal, RLS, autenticación, trazabilidad ni estabilidad operativa.

El resultado esperado es que Costa Clean pueda:

- crear una factura nueva a partir de una factura anterior sin copiar identidad, número, pagos ni estado;
- sugerir conceptos cuando el usuario empieza a escribir, sin listas permanentes ni scroll infinito;
- mostrar fecha y hora de creación de manera consistente en todo el ecosistema;
- identificar servicios pendientes de facturar y evitar facturación duplicada;
- guardar preferencias de facturación por cliente;
- generar borradores recurrentes con revisión humana;
- conservar historial, PDF emitido y evidencia de envío;
- preparar futuras automatizaciones deterministas y agentes limitados por permisos.

## 2. Autoridad y documentos obligatorios

Antes de cualquier cambio deben leerse, en este orden:

1. `AGENTS.md`
2. `docs/UX_APP_MANUAL.md`
3. `docs/CODEX_WORKFLOW.md`
4. `docs/APP_QUALITY_GATES.md`
5. `docs/APP_TRANSFORMATION_ROADMAP.md`
6. este documento
7. documentación específica encontrada durante la auditoría

Cuando exista contradicción, prevalecen `AGENTS.md`, `CODEX_WORKFLOW.md`, los quality gates y una autorización humana exacta para el sprint activo.

## 3. Restricciones permanentes

- No escribir directamente en `main`.
- No ejecutar `supabase db push`, `npm run db:push` ni equivalentes.
- No modificar migraciones remotas, historial de migraciones, RLS, RPC, Auth, Storage o producción sin un gate específico y autorización humana separada.
- No utilizar `service_role` en navegador.
- No emitir automáticamente una factura fiscal definitiva.
- No asignar un número definitivo antes del punto autorizado por el contrato fiscal real.
- No duplicar pagos, ingresos, PDF, referencias únicas, IDs, fechas ni estados al crear una factura similar.
- No interpretar `HTTP 200` como éxito cuando no existe evidencia de una fila creada o modificada.
- No introducir un segundo catálogo de conceptos si el repositorio ya dispone de uno.
- No crear nuevos agentes por defecto: el paquete de agentes existente cubre este roadmap y está protegido por `npm run qa:agents`.
- No declarar `PASS` una prueba no ejecutada. Usar `PASS`, `FAIL`, `NOT_AVAILABLE` o `NOT_EXECUTED`.
- Cada bloque cerrado debe acabar con diff revisado, validaciones, commit y push.
- El implementador nunca aprueba su propio trabajo.

## 4. Resultado funcional objetivo

### 4.1 Crear factura similar

Desde una factura existente debe existir una acción secundaria clara, como `Crear factura similar`, que abra un nuevo borrador independiente.

Datos potencialmente reutilizables, sujetos al contrato real:

- cliente y propiedad;
- dirección de facturación;
- líneas, descripción, cantidad, unidad y precio;
- descuentos y notas;
- idioma y condiciones de pago;
- configuración fiscal y plantilla visual compatibles.

Datos que nunca deben heredarse como definitivos:

- ID y número de factura;
- `created_at`, fecha de emisión y vencimiento sin recalcular;
- estado;
- pagos e ingresos;
- PDF y hash documental;
- referencias bancarias únicas;
- eventos contables anteriores;
- relaciones de servicios que puedan provocar doble facturación.

El borrador debe poder editarse sin alterar la factura de origen. La trazabilidad debe usar el mecanismo existente de actividad o, solo si no existe alternativa, un contrato nuevo aprobado.

### 4.2 Autocompletado contextual de conceptos

El campo debe permanecer limpio hasta que el usuario escriba. Las sugerencias deben tener límite, debounce, navegación por teclado, accesibilidad y estados de carga/error/vacío.

Orden esperado, sujeto a evidencia del repositorio:

1. coincidencia textual;
2. uso previo para el cliente;
3. uso previo para la propiedad;
4. frecuencia y recencia;
5. catálogo activo;
6. líneas históricas compatibles.

Seleccionar una sugerencia rellena datos editables. Si no existe coincidencia, se ofrece crear un concepto sin duplicar registros.

### 4.3 Metadatos de creación

Clientes, propiedades, leads, presupuestos, facturas, servicios, trabajos, pagos, ingresos, gastos y recurrencias deben usar el timestamp real existente y una utilidad compartida. El detalle puede mostrar `Creado el 29 de julio de 2026 a las 10:20`; las listas deben usar una versión compacta y discreta.

### 4.4 Automatización segura

La automatización debe generar propuestas o borradores, nunca consecuencias fiscales irreversibles sin revisión humana. Toda ejecución debe ser idempotente, auditable y recuperable.

## 5. Modelo de gates

| Gate | Tipo de trabajo | Escrituras remotas | Autorización |
|---|---|---:|---|
| `BA-DOC` | documentación, auditoría de código y planificación | 0 | prompt normal |
| `BA-FE` | frontend y utilidades sin cambiar contrato de datos | 0 | sprint aprobado |
| `BA-DATA-SOURCE` | migración/RPC/policy preparada y probada localmente | 0 | prompt exacto del sprint |
| `BA-QA-REMOTE` | aplicación o escritura en Supabase QA | solo QA exacta | autorización humana separada, ref y HEAD exactos, backup y recovery |
| `BA-PROD` | producción o datos reales | producción exacta | autorización humana separada posterior a QA independiente |

Ningún gate autoriza el siguiente automáticamente.

## 6. Agentes asignados

No se añaden perfiles nuevos. Se reutiliza el paquete validado existente y su invocación sigue siendo manual.

| Responsabilidad | Agente principal | Revisor independiente |
|---|---|---|
| reconstruir estado y elegir siguiente bloque | `project-continuation` | `pr-quality-gate` |
| convertir un gate en plan ejecutable | `implementation-planner` | `pr-quality-gate` |
| implementar slices aprobados | `senior-fullstack-builder` | `pr-quality-gate` |
| UX mobile-first, accesibilidad y StepFlow | `frontend-ux-accessibility` | `pr-quality-gate` |
| reglas de factura, pago, IVA, redondeo y numeración | `business-rules-test-engineer` | `pr-quality-gate` |
| Auth, RLS, RPC, Storage y Supabase | `supabase-guardian` | `security-privacy-auditor` |
| diagnóstico de defectos reproducibles | `bug-root-cause-investigator` | `pr-quality-gate` |
| QA funcional, E2E, viewports y limpieza | `qa-e2e-specialist` | `pr-quality-gate` |
| seguridad, secretos, PII y documentos | `security-privacy-auditor` | `pr-quality-gate` |
| email, adaptadores, colas y agentes futuros | `enterprise-agent-architect` | `security-privacy-auditor` |
| estado canónico y evidencia | `documentation-roadmap` | `pr-quality-gate` |
| release, rollback y despliegue autorizado | `release-deployment-guardian` | `pr-quality-gate` |

`performance-gsap-motion` solo participa si una transición funcional necesita motion; no se añade animación decorativa. `seo-local-structured-data` queda fuera de alcance.

## 7. Roadmap por sprints

### BA-0 — Auditoría real y contrato de facturación

**Estado:** `NOT_STARTED`  
**Gate:** `BA-DOC`  
**Agentes:** `project-continuation` + `implementation-planner`; revisión `business-rules-test-engineer` y `pr-quality-gate`.

**Objetivo**

Reconstruir el flujo real de cliente → propiedad → presupuesto → servicio → factura → pago → ingreso → cierre fiscal y producir un contrato de datos verificable antes de editar código funcional.

**Entregables**

- mapa de rutas, páginas, componentes, hooks y APIs implicados;
- tablas, vistas, funciones, triggers, RPC, policies y Storage relacionados;
- estados reales de factura y transiciones permitidas;
- momento real de asignación de número fiscal;
- modelo real de líneas, impuestos, descuentos y redondeo;
- relación actual entre servicios y facturas;
- matriz de writes con método, token, respuesta y evidencia de filas afectadas;
- inventario de `created_at` y formateadores existentes;
- inventario de catálogos o historiales de conceptos;
- mapa del PDF, almacenamiento, regeneración y envío;
- riesgos, deuda y decisiones humanas pendientes;
- plan afinado para BA-1 a BA-11.

**No objetivos**

- cero cambios funcionales;
- cero migraciones nuevas;
- cero escrituras QA/producción;
- cero refactors oportunistas.

**Cierre**

Documento de auditoría con evidencia de archivos reales; `npm run qa:agents`, `npm run lint`, `npm run test` y `npm run build` ejecutados cuando el entorno esté disponible; commit y push.

---

### BA-1 — Timestamp y metadatos compartidos

**Gate:** `BA-FE` salvo que la auditoría detecte datos ausentes.  
**Agentes:** `senior-fullstack-builder` + `frontend-ux-accessibility`; revisión `pr-quality-gate`.

**Alcance**

- crear o consolidar una utilidad/componente compartido de fecha y hora;
- respetar zona horaria y locale del producto;
- integrar detalle y lista sin inflar tarjetas;
- cubrir timestamps nulos o inválidos con estado honesto;
- eliminar duplicación solo dentro del alcance probado.

**Aceptación**

- el mismo timestamp produce formato coherente;
- ningún campo redundante de fecha es creado;
- listas siguen compactas en `390x844` y `768x1024`;
- tests de utilidad y regresión de módulos implicados pasan.

---

### BA-2 — Autocompletado reutilizable de conceptos

**Gate:** `BA-FE` si usa contratos existentes; `BA-DATA-SOURCE` si requiere búsqueda server-side nueva.  
**Agentes:** `implementation-planner`, `senior-fullstack-builder`, `frontend-ux-accessibility`; revisión `business-rules-test-engineer` y `pr-quality-gate`.

**Alcance**

- contrato único para facturas, presupuestos, servicios y recurrencias;
- consulta limitada, debounce y cancelación de respuestas obsoletas;
- ranking contextual sin descargar el historial completo;
- teclado, foco, lector de pantalla, touch y cierre exterior;
- prevención de duplicados y creación segura de concepto nuevo.

**Aceptación**

- no aparece una lista infinita antes de escribir;
- máximo de resultados definido y probado;
- resultados ordenados con criterios documentados;
- selección rellena campos editables;
- error y ausencia de resultados no bloquean el formulario.

---

### BA-3 — Crear factura similar como borrador independiente

**Gate:** comienza en `BA-FE`; cualquier cambio de RPC/esquema pasa a `BA-DATA-SOURCE`.  
**Agentes:** `business-rules-test-engineer`, `senior-fullstack-builder`, `frontend-ux-accessibility`; `supabase-guardian` solo si hay contrato de datos; revisión `pr-quality-gate`.

**Alcance**

- acción secundaria desde el detalle de factura;
- función pura de clonación permitida/prohibida;
- nuevo borrador con identidad y fechas nuevas;
- vencimiento recalculado por regla real;
- factura origen inmutable;
- trazabilidad mediante mecanismo existente o propuesta documentada;
- write validado por fila retornada o resultado equivalente.

**Aceptación**

- editar el borrador no cambia el origen;
- no se copian ID, número, estado, pagos, servicios ya facturados ni PDF;
- el nuevo número se asigna solo en el punto fiscal autorizado;
- un fallo RLS o una respuesta con cero filas nunca muestra éxito;
- flujo mobile-first y revisión antes de emitir.

---

### BA-4 — Servicios pendientes de facturar e idempotencia

**Gate:** probablemente `BA-DATA-SOURCE`, pendiente de BA-0.  
**Agentes:** `business-rules-test-engineer` + `supabase-guardian` + `senior-fullstack-builder`; revisión `security-privacy-auditor` y `pr-quality-gate`.

**Alcance**

- definir elegibilidad: completado, pendiente, asociado, parcialmente facturado, excluido;
- impedir doble asociación y doble facturación;
- resolver concurrencia e idempotencia;
- mostrar una lectura clara dentro del workspace de factura;
- conservar rollback y evidencia.

**Aceptación**

- dos intentos concurrentes no generan doble factura ni doble línea;
- los servicios ya facturados no reaparecen como elegibles;
- las exclusiones y parciales son explícitas;
- la matriz local/disposable cubre casos positivos, negativos y rollback.

---

### BA-5 — Perfil de facturación por cliente

**Gate:** `BA-DATA-SOURCE` si no existe almacenamiento compatible.  
**Agentes:** `implementation-planner`, `business-rules-test-engineer`, `supabase-guardian`, `senior-fullstack-builder`, `frontend-ux-accessibility`; revisión `security-privacy-auditor` y `pr-quality-gate`.

**Alcance**

Preferencias habituales de cliente: propiedad, conceptos, precios, idioma, condiciones, vencimiento, email de facturación, método de pago, periodicidad, plantilla y preferencia de envío.

**Aceptación**

- preferencias separadas de hechos fiscales emitidos;
- defaults editables por factura;
- desactivar automatización detiene futuras propuestas;
- no se usa email como prueba de identidad;
- auditoría de cambios disponible.

---

### BA-6 — Recurrencias y generación de borradores

**Gate:** `BA-DATA-SOURCE`; QA remota solo mediante `BA-QA-REMOTE`.  
**Agentes:** `enterprise-agent-architect`, `business-rules-test-engineer`, `supabase-guardian`, `senior-fullstack-builder`; revisión `security-privacy-auditor` y `pr-quality-gate`.

**Alcance**

- semanal, quincenal, mensual y posterior a servicio;
- agrupación por cliente o propiedad;
- ejecución idempotente con clave de periodo;
- borrador pendiente de revisión humana;
- reintentos limitados sin duplicación;
- desactivación y recuperación.

**Aceptación**

- ejecutar dos veces el mismo periodo produce un único borrador lógico;
- no se emite ni envía una factura definitiva;
- errores quedan visibles y recuperables;
- existe historial de la regla y de cada ejecución.

---

### BA-7 — Historial y auditoría financiera

**Gate:** depende del mecanismo actual; preferir contratos existentes.  
**Agentes:** `business-rules-test-engineer`, `security-privacy-auditor`, `senior-fullstack-builder`; revisión `pr-quality-gate`.

**Eventos mínimos**

- borrador creado;
- factura duplicada desde origen;
- edición relevante;
- emisión;
- PDF generado/versionado;
- envío solicitado y resultado;
- pago registrado;
- anulación;
- automatización ejecutada o fallida.

**Aceptación**

- actor, tiempo, entidad y resultado verificables;
- no se registran secretos ni PII innecesaria;
- el historial no puede fingir que una operación fallida tuvo éxito.

---

### BA-8 — PDF inmutable, previsualización y entrega

**Gate:** frontend/documental primero; Storage/Edge/email requieren gates separados.  
**Agentes:** `enterprise-agent-architect`, `security-privacy-auditor`, `business-rules-test-engineer`, `senior-fullstack-builder`; revisión `pr-quality-gate`.

**Alcance**

- previsualizar y descargar;
- conservar snapshot/version de factura emitida;
- impedir alteración silenciosa del documento fiscal;
- compartir por WhatsApp mediante acción explícita;
- email con adaptador server-side y resultado auditable;
- nota comercial de IVA conforme a la configuración real de Costa Clean.

**Aceptación**

- modificar un borrador posterior no cambia el PDF ya emitido;
- URL privada y acceso temporal cuando aplique;
- ningún secreto de envío llega al frontend;
- reenvío usa el documento correcto y deja evidencia.

---

### BA-9 — Automatizaciones y agentes operativos limitados

**Gate:** diseño documental antes de cualquier integración.  
**Agentes:** `enterprise-agent-architect`, `security-privacy-auditor`, `business-rules-test-engineer`; revisión `pr-quality-gate`.

**Alcance**

- eventos deterministas antes de IA;
- matriz de herramientas y permisos por agente;
- propuesta de conceptos/precios sin escritura irreversible;
- recordatorios de vencimiento;
- resúmenes mensuales;
- conciliación asistida con confirmación;
- observabilidad, dead-letter/recovery y kill switch.

**Aceptación**

- cada agente tiene entrada, salida, permisos y prohibiciones explícitas;
- ningún agente emite, anula, cobra o concilia de forma irreversible sin gate humano;
- toda recomendación de IA es distinguible de un dato confirmado.

---

### BA-10 — QA integral, accesibilidad, seguridad y regresión

**Gate:** local primero; QA remota mediante autorización separada.  
**Agentes:** `qa-e2e-specialist`, `frontend-ux-accessibility`, `security-privacy-auditor`, `business-rules-test-engineer`; revisión `pr-quality-gate`.

**Matriz mínima**

- crear factura normal y similar;
- independencia entre origen y borrador;
- numeración y vencimiento;
- líneas, conceptos y cálculo;
- servicio pendiente, parcial, excluido y ya facturado;
- respuesta RLS fallida y cero filas;
- pago e ingreso sin duplicación;
- PDF y reenvío;
- recurrencia idempotente;
- teclado, foco, lector de pantalla y reduced motion;
- `390x844`, `768x1024`, desktop y sin overflow;
- secretos, PII, permisos y contratos de Auth.

**Cierre**

Pruebas focalizadas y suite completa; `qa:agents`, lint, test y build; evidencia honesta de dispositivos físicos no ejecutados.

---

### BA-11 — Release, documentación y cierre

**Gate:** `BA-PROD` solo tras QA aprobada y autorización exacta.  
**Agentes:** `release-deployment-guardian` + `documentation-roadmap`; revisión `security-privacy-auditor` y `pr-quality-gate`.

**Entregables**

- plan de release y rollback;
- backup y prestate verificables;
- smoke funcional limitado;
- monitorización y recuperación;
- roadmap actualizado con evidencia;
- deuda P0/P1/P2/P3 real;
- manual operativo de facturación y automatización.

## 8. Orden obligatorio de ejecución

1. Ejecutar BA-0 completo.
2. Reescribir BA-1 a BA-11 con nombres de archivos, contratos y riesgos reales encontrados.
3. Cerrar primero slices que no requieran base de datos: BA-1 y parte de BA-2/BA-3.
4. Preparar contratos de datos localmente; nunca aplicar remoto desde un prompt genérico.
5. Autorizar QA con prompt exacto por gate.
6. Ejecutar revisión independiente.
7. Autorizar producción en un prompt separado.

No se permite iniciar BA-3, BA-4, BA-5 o BA-6 suponiendo tablas o columnas.

## 9. Formato de cierre de cada sprint

```text
VERDICT: APPROVED | APPROVED_WITH_DOCUMENTED_DEBT | CHANGES_REQUIRED | BLOCKED
SPRINT:
GATE:
REPOSITORY_STATE:
SELECTED_SCOPE:
CHANGES:
FILES_CHANGED:
DATABASE_EFFECTS:
VALIDATIONS_EXECUTED:
VALIDATIONS_NOT_EXECUTED:
FUNCTIONAL_QA:
SECURITY_AND_PRIVACY:
RISKS:
DOCUMENTED_DEBT:
GIT_BRANCH:
GIT_COMMIT:
GIT_PUSH:
ROADMAP_UPDATE:
NEXT_ACTION:
```

## 10. Primer prompt para Codex — BA-0

Copiar este prompt completo en una sesión nueva de Codex abierta en el repositorio `projectmanagmentnotion-CostaClean/costa-clean-app`.

```text
Actúa como arquitecto senior y auditor técnico del repositorio real de Costa Clean.

REPOSITORIO OBJETIVO
projectmanagmentnotion-CostaClean/costa-clean-app

SPRINT AUTORIZADO
BA-0 — Auditoría real y contrato de facturación.
Gate: BA-DOC.

OBJETIVO
Reconstruir con evidencia el flujo actual cliente → propiedad → presupuesto → servicio → factura → pago → ingreso → cierre fiscal y dejar un contrato de datos y un plan de implementación afinado para el roadmap de facturación y automatización.

LECTURA OBLIGATORIA ANTES DE ACTUAR
1. AGENTS.md
2. docs/UX_APP_MANUAL.md
3. docs/CODEX_WORKFLOW.md
4. docs/APP_QUALITY_GATES.md
5. docs/APP_TRANSFORMATION_ROADMAP.md
6. docs/BILLING_AUTOMATION_ROADMAP_20260729.md
7. cualquier documentación específica que esos archivos enlacen para facturación, Supabase, QA, migraciones o continuidad.

AGENTES DE REFERENCIA PARA ESTE BLOQUE
- project-continuation para reconstruir el estado real;
- implementation-planner para convertir hallazgos en slices cerrables;
- business-rules-test-engineer para revisar numeración, impuestos, redondeo, estados, pagos e invariantes;
- pr-quality-gate como revisor independiente.
La invocación es manual. No modifiques los perfiles de agentes ni config/project-agents.json.

RESTRICCIONES ABSOLUTAS
- No cambies código funcional, UI, esquema, migraciones, RLS, RPC, Auth, Storage ni datos.
- No ejecutes supabase db push, npm run db:push ni equivalentes.
- No hagas escrituras en QA o producción.
- No uses service_role en frontend ni busques secretos.
- No inventes tablas, columnas, archivos, resultados ni estados.
- No arregles problemas encontrados dentro de BA-0; documéntalos y asígnalos al sprint correcto.
- No escribas directamente en main.
- No cierres BA-0 sin commit y push de la documentación producida.

SECUENCIA OBLIGATORIA
1. Comprueba rama, HEAD, git status, remote, divergencia, PRs abiertos relevantes y CI disponible.
2. Lee los documentos obligatorios y resume las restricciones que afectan a facturación.
3. Localiza por búsqueda real todos los archivos de clientes, propiedades, leads, presupuestos, servicios/jobs, facturas, pagos, ingresos, gastos, recurrencias y cierre fiscal.
4. Traza rutas, páginas, componentes, hooks, stores, APIs de lectura/escritura, tipos, tests y generación de PDF.
5. Localiza tablas, vistas, triggers, funciones, RPC, policies, buckets y migraciones relacionadas sin aplicar nada.
6. Documenta para cada write:
   - entidad y acción;
   - archivo y función;
   - SDK/REST/RPC utilizado;
   - identidad/token esperado;
   - payload;
   - respuesta;
   - cómo se confirma exactamente una fila afectada;
   - error cuando hay 0 filas o RLS bloquea.
7. Reconstruye el ciclo de vida real de la factura:
   - borrador;
   - asignación de número;
   - emisión;
   - envío;
   - vencimiento;
   - pago parcial/total;
   - anulación;
   - relación con servicio, presupuesto, ingreso y cierre fiscal.
8. Identifica qué campos de una factura pueden reutilizarse y cuáles deben regenerarse al crear una factura similar.
9. Audita el catálogo/historial de conceptos y define si el autocompletado puede hacerse con contratos existentes.
10. Audita created_at/updated_at y formateadores de fecha en todos los módulos objetivo.
11. Audita PDF: origen de datos, snapshot, almacenamiento, URL, regeneración, descarga, email y WhatsApp.
12. Ejecuta solo validaciones locales no destructivas disponibles. Como mínimo intenta:
    - npm run qa:agents
    - npm run lint
    - npm run test
    - npm run build
13. Crea docs/BILLING_AUTOMATION_AUDIT_BA0_20260729.md con evidencia real.
14. Actualiza docs/BILLING_AUTOMATION_ROADMAP_20260729.md solo para sustituir supuestos por hallazgos comprobados y marcar BA-0 de forma honesta.
15. Revisa diff y secretos, crea un commit documental y haz push de la rama activa.

CONTENIDO MÍNIMO DEL INFORME BA-0
- estado exacto del repositorio;
- arquitectura detectada;
- mapa de archivos por dominio;
- diagrama textual de flujo;
- tablas/RPC/policies/migraciones implicadas;
- matriz de writes y verificación de filas;
- estados e invariantes fiscales;
- contrato preliminar de Crear factura similar;
- contrato preliminar del autocompletado;
- inventario de timestamps;
- contrato de servicios pendientes de facturar;
- contrato de PDF y comunicaciones;
- riesgos P0/P1/P2/P3;
- decisiones humanas pendientes;
- roadmap BA-1 a BA-11 corregido con dependencias reales;
- primer slice de implementación recomendado.

FORMATO FINAL
VERDICT: APPROVED | APPROVED_WITH_DOCUMENTED_DEBT | CHANGES_REQUIRED | BLOCKED
SPRINT: BA-0
GATE: BA-DOC
REPOSITORY_STATE:
ARCHITECTURE:
CURRENT_BILLING_FLOW:
DATA_CONTRACTS:
WRITE_MATRIX:
RISKS:
DECISIONS_REQUIRED:
FILES_CHANGED:
VALIDATIONS_EXECUTED:
VALIDATIONS_NOT_EXECUTED:
GIT_BRANCH:
GIT_COMMIT:
GIT_PUSH:
ROADMAP_UPDATE:
NEXT_ACTION:

No comiences BA-1 en esta misma ejecución. BA-0 termina con auditoría, documentación, commit y push; la implementación funcional requiere un prompt nuevo y un alcance aprobado.
```

## 11. Estado de apertura

- `BA-0`: `NOT_STARTED`
- `BA-1` a `BA-11`: `BLOCKED_PENDING_BA0`
- escrituras Supabase QA: `0`
- escrituras producción: `0`
- cambios funcionales autorizados por este documento: `0`
