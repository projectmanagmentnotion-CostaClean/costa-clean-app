# Universal Release Log

Registro transversal para cambios que adopten el sistema universal. Los proyectos con changelog propio pueden enlazarlo aquí sin duplicar todo su historial.

## Unreleased

### Costa Clean

#### 2026-07-21 — Full App Production Audit and Correction Pass

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: audit / patch
- resumen: audita arquitectura, módulos, UX/UI, responsive, accesibilidad, clientes API/Supabase y QA; corrige identidad del target QA y primer paso del servicio contextual
- commit: commit de esta entrega; el identificador final se informa en el cierre
- validación: lint/build y 177 tests, QA visual sandbox `360/360` y dry-run sandbox `588/588`, con 0 entidades creadas
- riesgo: bajo en cambios aplicados; writes autenticados directos y optimización de assets quedan como sprints separados
- rollback: `git revert <commit-de-esta-entrega>` y repetir gates completos

Evidencia: [FULL_APP_AUDIT_20260721.md](FULL_APP_AUDIT_20260721.md) y [FULL_APP_AUDIT_FIXES_20260721.md](FULL_APP_AUDIT_FIXES_20260721.md).

#### 2026-07-21 — Universal Product Correction and Release System

- fecha: 2026-07-21
- proyecto: Costa Clean CRM
- tipo: docs / patch
- resumen: incorpora metodología universal de corrección, UX/UI, releases, riesgos, protocolo Codex y plantillas reutilizables
- commit: commit de documentación de esta entrega; el identificador final se informa en el cierre
- validación: `npm run lint`, `npm run build` y `npm run test`
- riesgo: bajo; cambios limitados a documentación
- rollback: `git revert <commit-de-esta-entrega>` y volver a ejecutar los gates documentales

### Ridaos Print

Sin entradas.

### Webs / Landings

Sin entradas.

### Otros proyectos

Sin entradas.

## Formato de nuevas entradas

Cada entrada debe incluir:

- fecha
- proyecto
- tipo
- resumen
- commit
- validación
- riesgo
- rollback

No se registra como publicado un cambio que solo esté validado en fuente local. Los bloqueos o validaciones parciales se describen explícitamente.
