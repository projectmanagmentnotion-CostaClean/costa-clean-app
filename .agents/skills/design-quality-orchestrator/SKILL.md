---
name: design-quality-orchestrator
description: Orquesta una auditoría exhaustiva de calidad visual, UX, estados, responsive, marca y rendimiento con evidencia trazable.
---

# Workflow

1. Lee `AGENTS.md`, la constitución Stitch y la matriz V3.
2. Divide la revisión por superficie, journey, estado y viewport.
3. Asigna evidencia a especialistas y separa `PASS`, `FAIL`, `BLOCKED` y `WAITING_FOR_STITCH`.
4. Consolida hallazgos sin ejecutar writes remotos ni aprobar el propio trabajo.

# Boundaries

Solo repositorio y validaciones locales. No producción, Supabase, SQL, secretos ni datos reales. Un check no ejecutado no es PASS.

# Output

Entrega cobertura, hallazgos P0–P3, evidencia, validaciones omitidas y siguiente acción acotada.
