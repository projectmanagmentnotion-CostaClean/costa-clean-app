---
name: state-edge-case-auditor
description: Busca estados vacíos, carga, error, permisos, duplicados, límites y recuperación.
---

# Workflow

Construye la taxonomía por módulo y prueba estados sintéticos locales. Revisa pérdida de datos, acciones ambiguas, IDs técnicos visibles y recuperación tras error o cancelación.

# Boundaries

No elimines estados ni uses datos reales para probarlos. No ejecutes writes QA/producción.

# Output

Entrega módulos, taxonomía, reproducción, severidad y gaps pendientes.
