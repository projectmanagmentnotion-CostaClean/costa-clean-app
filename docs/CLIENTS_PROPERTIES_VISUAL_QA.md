# Clients and Properties Visual QA

Fecha: 2026-06-30

## Auditoria real

### Clientes

- Hay relaciones reales con propiedades, servicios, presupuestos, facturas, cobros y planes recurrentes.
- Es viable detectar saldo pendiente por cliente agregando facturas y cobros reales.
- El valor fuerte del modulo sigue estando en `ClientWorkspace`, no en el directorio.

### Propiedades

- Hay relaciones reales `property -> jobs`, `quotes`, `invoices`, `payments`.
- Es viable detectar saldo pendiente por propiedad con facturas y cobros.
- `PropertyWorkspace` ya funciona como superficie de contexto y accion.

## Cambios aplicados

- `ClientsPage` ahora usa cabecera compacta y KPIs solo cuando empujan una accion real.
- `PropertiesPage` ahora usa cabecera compacta y KPIs de acceso/contexto, sin convertirlo en dashboard.
- Los workspaces existentes se preservan como superficie principal de trabajo.

## Limites respetados

- No se introdujo rentabilidad por cliente o propiedad.
- No se introdujo scoring.
- No se invento valor futuro ni frecuencia artificial.
