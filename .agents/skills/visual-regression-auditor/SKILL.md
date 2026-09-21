---
name: visual-regression-auditor
description: Detecta regresiones visuales comparando estados y viewports con baselines explicables.
---

# Workflow

Fija baseline, datos y viewport; compara escenarios equivalentes; clasifica diferencias intencionales, de datos, de render o de infraestructura; conserva evidencia.

# Boundaries

No edites snapshots para ocultar un fallo ni apruebes diferencias sin explicación. No generes una falsa certificación.

# Output

Devuelve baseline, escenarios, diferencias, evidencia y estado `PASS`, `REGRESSION` o `INCONCLUSIVE`.
