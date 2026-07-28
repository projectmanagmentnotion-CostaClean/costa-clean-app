# Production Agents Pilot — Costa Clean App

## Fuente

- Biblioteca: `projectmanagmentnotion-CostaClean/production-agents`
- Release candidate: `v1.0.0-rc.1`
- Commit fuente: `b908f6cd33751e5d5d899cc3a74e4084bb245fbc`
- Fecha de instalación: 2026-07-27

## Perfiles instalados

- `implementation-planner`
- `pr-quality-gate`
- `frontend-ux-accessibility`
- `supabase-guardian`
- `business-rules-test-engineer`

Todos mantienen `disable-model-invocation: true` y deben seleccionarse manualmente.

## Gobierno local

Los perfiles quedan subordinados al `AGENTS.md` de Costa Clean App y a su orden de lectura obligatorio:

1. `docs/UX_APP_MANUAL.md`
2. `docs/CODEX_WORKFLOW.md`
3. `docs/APP_QUALITY_GATES.md`
4. `docs/APP_TRANSFORMATION_ROADMAP.md`

La instalación no modifica código, Supabase, Auth, facturación, rutas, dependencias ni producción.

## Escenarios piloto

### 1. Planificación read-only

Seleccionar `implementation-planner` y pedir:

```text
Analiza el siguiente bloque pendiente del roadmap de Costa Clean App. Trabaja únicamente en lectura y crea un plan Markdown con alcance, riesgos, criterios de aceptación y validaciones. No modifiques código, Supabase ni producción.
```

### 2. Auditoría Supabase read-only

Seleccionar `supabase-guardian` y pedir:

```text
Audita en modo read-only el estado local de migraciones, RLS, Auth y Storage. No ejecutes db push, repair, reset ni escrituras remotas. Separa PASS, FAIL, NOT_AVAILABLE y NOT_EXECUTED.
```

### 3. Reglas económicas

Seleccionar `business-rules-test-engineer` y pedir:

```text
Localiza las reglas actuales de presupuestos, facturas, IVA, redondeo y numeración. No cambies precios ni datos. Produce una matriz de reglas confirmadas, pruebas existentes, límites y decisiones pendientes.
```

### 4. UX y accesibilidad

Seleccionar `frontend-ux-accessibility` y pedir una auditoría read-only de una ruta concreta en 390x844 y 768x1024, sin modificar lógica de negocio.

### 5. Gate independiente

Usar `pr-quality-gate` sobre el PR resultante de cualquier piloto. El agente que implementa nunca aprueba su propio cambio.

## Criterios de éxito

- Los perfiles aparecen en GitHub Copilot Agents tras el merge.
- Respetan el `AGENTS.md` local.
- No realizan acciones remotas ni destructivas.
- No inventan validaciones o resultados.
- Producen salida conforme a su contrato.
- Cualquier cambio queda en rama y PR revisable.

## Rollback

Eliminar mediante PR los archivos instalados en `.github/agents/` y este documento. No hay cambios de runtime que revertir.

## Promotion to Full Costa Clean Project Pack

- Fecha de promoción: 2026-07-28.
- Fuente fijada: `projectmanagmentnotion-CostaClean/production-agents`.
- Nuevo commit fuente exacto: `e08e4fdd77a3d1672dad51cebabf03e5e67196d0`.
- Resultado: piloto promovido a pack completo de 15 agentes.
- Selección: exclusivamente manual; `disable-model-invocation: true`.
- Autoridad: `AGENTS.md` sigue siendo la autoridad principal.
- Validación estructural: `npm run qa:agents`.
- Runtime: sin cambios.
- Supabase/Auth/Storage/Edge: sin cambios.
- Despliegues: ninguno.
- Rollback: PR que elimine los diez perfiles añadidos, restaure el manifiesto
  previo y retire el tooling/documentación del pack; no existe runtime que
  revertir.
