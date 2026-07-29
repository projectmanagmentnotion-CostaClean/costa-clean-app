# Codex Prompt — Billing Automation Sprint 0 Audit

Copy and paste the complete prompt below into a new Codex session opened on the Costa Clean repository.

---

Actúa como arquitecto de software senior y auditor técnico principal de la aplicación Costa Clean.

Vas a ejecutar únicamente el Sprint 0 del roadmap de automatización de facturación. Este bloque es de diagnóstico y documentación. No debes implementar funcionalidades ni modificar código de producto.

## REPOSITORIO Y RAMA

Repositorio:

`projectmanagmentnotion-CostaClean/costa-clean-app`

Crea y trabaja en una rama nueva basada en el `main` remoto actualizado:

`codex/billing-s0-audit`

No trabajes directamente en `main`.

Antes de crear la rama:

1. comprueba el repositorio y el remote real;
2. revisa `git status`;
3. actualiza referencias remotas;
4. confirma que no vas a mezclar cambios locales ajenos;
5. registra el HEAD inicial local y remoto.

## LECTURA OBLIGATORIA

Lee completamente, en este orden, antes de editar cualquier archivo:

1. `AGENTS.md`
2. `docs/UX_APP_MANUAL.md`
3. `docs/CODEX_WORKFLOW.md`
4. `docs/APP_QUALITY_GATES.md`
5. `docs/APP_TRANSFORMATION_ROADMAP.md`
6. `docs/BILLING_AUTOMATION_ROADMAP_20260729.md`
7. `docs/workflow/BILLING_AUTOMATION_AGENT_RUNBOOK_20260729.md`

Lee también los documentos enlazados que resulten obligatorios para Supabase, facturación, numeración, fiscalidad, auditoría, documentos privados o el portal cliente.

Las reglas del repositorio tienen prioridad sobre este prompt cuando sean más estrictas.

## OBJETIVO DEL SPRINT

Construir una auditoría verificable y un contrato técnico del ecosistema de facturación actual antes de iniciar cualquier implementación.

Debes determinar con evidencia real:

- cómo funciona actualmente `Crear factura como esta`;
- qué datos copia y cuáles reinicia;
- si crea siempre un borrador independiente;
- cómo se evita copiar numeración fiscal, display code, pagos, documentos y estados;
- cómo se conserva o no la procedencia de la factura origen;
- cómo se crean facturas desde servicio, presupuesto, recurrencia y entrada manual;
- cómo se guardan factura y líneas;
- cómo se validan escrituras, filas afectadas, readback y errores RLS/RPC;
- cómo funcionan numeración, snapshot fiscal, estados administrativos y estados de pago;
- cómo se relacionan clientes, propiedades, presupuestos, servicios, facturas, pagos e ingresos;
- cómo se detectan servicios completados pendientes de facturar;
- qué protección existe frente a facturación duplicada, reintentos y concurrencia;
- de dónde salen actualmente los conceptos de línea y su historial;
- cómo se muestran `created_at` y otras fechas en cada módulo;
- cómo se registran eventos de auditoría;
- cómo se generan, almacenan, regeneran y exponen PDFs/documentos;
- qué parte de este dominio coincide o entra en conflicto con el roadmap activo del portal cliente.

## HECHOS INICIALES QUE DEBES VERIFICAR EN CÓDIGO

No los aceptes como completos sin trazar sus consumidores y efectos:

- `src/features/invoices/InvoiceDetailCard.tsx` expone `onCreateSimilarInvoice` y la acción visible `Crear factura como esta`.
- `src/features/invoices/invoiceCreatePrefill.ts` define `InvoiceCreatePrefill` y, en la versión revisada al abrir el roadmap, no incluía un origen explícito `invoice`.
- `src/features/financial/financialWriteApi.ts` utiliza `save_invoice_with_lines_v2`, elimina `invoice_number` y `display_code` del payload del navegador, verifica una única factura persistida/readback, compara numeración esperada y registra auditoría.
- El detalle de factura ya contiene gates de snapshot fiscal, numeración, borrador, pago, cancelación y lifecycle.
- Existe un bloqueo permanente para `supabase db push` y cualquier cambio remoto necesita un gate independiente.

Tu obligación es confirmar el estado exacto del HEAD actual y detectar cualquier cambio posterior.

## ALCANCE OBLIGATORIO

### 1. Mapa de interfaz y flujo

Localiza y documenta:

- página/workspace principal de facturas;
- formulario o StepFlow de creación;
- callback y handler completo de factura similar;
- creación desde job/servicio;
- creación desde presupuesto;
- creación desde recurrencia;
- edición, emisión, cancelación, archivo y papelera;
- cobros parciales y completos;
- apertura/generación de documento;
- puntos de entrada móvil y escritorio.

### 2. Mapa de código

Lista archivos, funciones, hooks y componentes reales relacionados con:

- invoices;
- invoice lines;
- jobs/services and billing lines;
- quotes and quote lines;
- recurring work;
- clients and fiscal snapshots;
- payments and income;
- audit trail;
- documents/PDF/storage;
- formatting of dates and creation metadata;
- concept normalization/search/catalogue;
- lifecycle/archive/delete/cancel;
- tests and fixtures.

No inventes rutas o nombres. Incluye solo lo encontrado.

### 3. Mapa de datos y Supabase

En modo lectura, identifica:

- tablas y vistas;
- columnas relevantes;
- claves y relaciones;
- constraints e índices;
- RPCs y firmas;
- triggers;
- RLS policies;
- grants;
- migraciones fuente relacionadas;
- Storage buckets y metadatos documentales;
- límites entre browser, RPC, Edge/server y trusted runtime.

No ejecutes migraciones, `db push`, repair, apply, escritura remota ni cambios de Auth/Storage/Edge.

### 4. Contratos y reglas de negocio

Documenta mediante tablas de decisión:

- campos permitidos y prohibidos al repetir una factura;
- cuándo un borrador consume o no numeración;
- transición de draft a emitted/sent/cancelled según estados reales;
- relación entre estado administrativo y estado financiero derivado de pagos;
- reglas de subtotal, impuestos, total y redondeo;
- snapshot fiscal requerido;
- definición actual de servicio facturable;
- duplicidad, reintento e idempotencia;
- corrección, cancelación y reversión;
- reglas de fecha de emisión y vencimiento si existen;
- texto `Precios sin IVA` y su fuente de verdad.

Separa siempre:

- regla confirmada;
- inferencia;
- ausencia de contrato;
- decisión humana pendiente.

### 5. Conceptos y autocompletado

Determina:

- dónde se almacenan o derivan los conceptos;
- si existe catálogo canónico;
- qué listas largas o selects existen hoy;
- si se descarga el dataset completo;
- qué datos permiten ranking por cliente, propiedad, frecuencia y recencia;
- cómo se normalizan conceptos;
- qué arquitectura compartida ya existe;
- qué módulos duplican lógica.

No implementes el autocompletado en este sprint.

### 6. Created-at y zona horaria

Audita clientes, propiedades, leads, presupuestos, facturas, servicios, pagos, ingresos, gastos y recurrencias.

Para cada entidad identifica:

- campo real de creación;
- campo de actualización si existe;
- tipo/formato recibido;
- utilidad/componente de visualización;
- zonas donde no se muestra;
- formatos inconsistentes;
- valores nulos o históricos problemáticos;
- supuesto o contrato de zona horaria.

No añadas columnas ni cambies UI en este sprint.

### 7. PDF y comunicaciones

Traza:

- generación del PDF;
- datos usados;
- snapshot o lectura viva;
- almacenamiento;
- nombre/clave del objeto;
- privacidad y URL;
- regeneración;
- versión asociada a emisión;
- preview/download;
- email/WhatsApp actual si existe;
- audit events.

Distingue el flujo interno actual del futuro portal cliente.

### 8. Tests y QA disponibles

Localiza:

- tests unitarios;
- tests de integración;
- E2E/Playwright;
- fixtures financieras;
- comandos `package.json`;
- validadores de agentes;
- gates relacionados con facturas, pagos, RLS, portal y documentos.

No declares que un test pasa sin ejecutarlo.

En este sprint documental, ejecuta solo validaciones seguras y locales necesarias para verificar que los Markdown no rompen controles. No ejecutes acciones remotas.

## ENTREGABLES

Crea exactamente estos archivos:

1. `docs/billing/BILLING_CURRENT_STATE_AUDIT.md`
2. `docs/billing/BILLING_DATA_CONTRACT.md`
3. `docs/billing/BILLING_RISK_REGISTER.md`

Actualiza `docs/BILLING_AUTOMATION_ROADMAP_20260729.md` únicamente para:

- registrar Sprint 0 como `DONE` si toda la evidencia requerida está completa;
- o dejarlo `BLOCKED`/`PARTIAL` con motivos exactos;
- indicar el primer sprint implementable recomendado según dependencias reales.

No marques ningún sprint de implementación como completado.

## ESTRUCTURA DE LOS ENTREGABLES

### BILLING_CURRENT_STATE_AUDIT.md

Incluye:

- status and audit date;
- repository/branch/HEAD;
- mandatory documents read;
- architecture summary;
- end-to-end flow maps;
- verified similar-invoice behavior;
- module/file/function inventory;
- test inventory;
- current UX findings;
- current PDF/document behavior;
- current created-at behavior;
- evidence gaps;
- recommended first implementation slice.

### BILLING_DATA_CONTRACT.md

Incluye:

- entity relationship map;
- tables/views/functions/RPCs/triggers/policies/grants;
- invoice and line payloads;
- prefill contracts;
- allowlist/denylist for invoice reuse;
- numbering and fiscal snapshot contract;
- state-transition tables;
- monetary precision contract;
- service eligibility and duplicate-prevention contract;
- audit/provenance contract;
- document version contract;
- proposed changes clearly labelled as proposals, not facts.

### BILLING_RISK_REGISTER.md

Clasifica P0-P3 e incluye:

- risk;
- affected file/data contract;
- evidence;
- impact;
- probability;
- recommended mitigation;
- target sprint;
- whether it blocks implementation;
- rollback/recovery concern.

Debe cubrir como mínimo:

- fiscal numbering;
- duplicated invoices/drafts;
- duplicated service billing;
- RLS/zero-row writes;
- payment status contradictions;
- mutable emitted PDF;
- PII/document exposure;
- automation permissions;
- migration-history lock;
- interference with client portal work.

## PROHIBICIONES

- No modifiques `src/`, `supabase/`, `scripts/`, tests de producto, dependencias, workflows o configuración ejecutable.
- No crees migraciones.
- No cambies tablas, RLS, RPC, grants, Auth, Edge Functions o Storage.
- No ejecutes `supabase db push` ni equivalentes.
- No escribas en QA ni producción.
- No uses service role.
- No cambies facturas, pagos, clientes o servicios reales.
- No corrijas hallazgos durante la auditoría.
- No mezcles trabajo del portal cliente.
- No abras un PR de implementación.
- No declares pruebas, dispositivos o flujos como validados si no se ejecutaron.

## VALIDACIÓN

Antes de cerrar:

1. revisa que solo existan cambios Markdown del Sprint 0;
2. ejecuta los validadores documentales/agentes disponibles que sean seguros;
3. ejecuta `npm run lint` y `npm run build` si las reglas obligatorias del repositorio lo requieren también para un bloque documental;
4. registra comandos y resultados reales;
5. revisa `git diff --check`;
6. revisa `git diff` completo;
7. revisa `git status`;
8. confirma que no hay secretos, perfiles de navegador, capturas privadas ni datos reales.

## GIT

Cierra el bloque con un único commit intencional y push de la rama:

`docs(billing): audit current billing contracts`

No hagas merge.

## INFORME FINAL OBLIGATORIO

Usa este formato:

```text
VERDICT: PLAN_READY | PLAN_READY_WITH_OPEN_DECISIONS | BLOCKED
SPRINT: 0 - Evidence audit and contract map
BRANCH:
BASE_HEAD:
FINAL_HEAD:
MANDATORY_DOCS_READ:
DELIVERABLES:
CURRENT_SIMILAR_INVOICE_BEHAVIOR:
DATA_CONTRACT_SUMMARY:
KEY_CONFIRMED_RULES:
KEY_GAPS:
P0_FINDINGS:
P1_FINDINGS:
P2_FINDINGS:
P3_FINDINGS:
VALIDATIONS_EXECUTED:
VALIDATIONS_NOT_EXECUTED:
REMOTE_WRITES: 0
PRODUCTION_WRITES: 0
COMMIT:
PUSH:
WORKTREE_STATUS:
RECOMMENDED_FIRST_IMPLEMENTATION_SPRINT:
EXACT_NEXT_PROMPT_SCOPE:
```

Trabaja con evidencia real, mantén el alcance estrictamente documental y no pidas confirmación para continuar dentro de este Sprint 0 salvo que exista un bloqueo real de seguridad o acceso.
