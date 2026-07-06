# Invoice 2026-045 Execution Blocked

## Estado

La correccion real de la factura `2026-045` no pudo aplicarse en este turno.

## Fecha y hora

- `2026-07-06T18:34:58.1921019+02:00`

## Metodo preparado

- script operativo: `scripts/ops/correct-invoice-2026-045.mjs`
- comando de aplicacion: `node scripts/ops/correct-invoice-2026-045.mjs --apply`
- write path objetivo: RPC `save_invoice_with_lines_v2`
- fallback preparado: RPC `save_invoice_with_lines`

## Precondiciones verificadas

- factura localizada por `invoice_number = 2026-045`
- `display_code` persistido actual: `INV-0045`
- cliente real: `FUSTERIA PINEDA MAR SL`
- linea objetivo encontrada: `limpieza de taller`
- cantidad actual: `1`
- unidad: `Horas`
- precio unitario: `18,00 EUR`
- subtotal actual factura: `234,00 EUR`
- IVA actual: `49,14 EUR`
- total actual: `283,14 EUR`
- pagos asociados: `0`
- una sola coincidencia para `invoice_number = 2026-045`
- señal disponible de no enviada en `pricing_metadata.renumbered_reason`

## Bloqueo exacto

El intento de escritura devolvio:

- `Authentication required for financial writes.`

## Evidencia adicional

- con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de `.env.local` se pudo leer la factura real
- con esas mismas credenciales no se pudo ejecutar el RPC de escritura financiera
- el navegador interno abierto desde Codex carga la app en pantalla de login, no en una sesion ya autenticada

## Que falta

Se necesita una de estas dos condiciones para completar la correccion real:

1. sesion autenticada valida en la app / navegador que pueda ejecutar el write path financiero, o
2. credencial de servidor autorizada para el mismo write path (`SUPABASE_SERVICE_ROLE_KEY` u otra via aprobada)

## Que no se hizo

- no se aplico ninguna modificacion en datos reales
- no se creo factura nueva
- no se creo rectificativa
- no se cambio `invoice_number`
- no se cambio `display_code`
- no se toco SQL
- no se tocaron migrations
- no se cambio `appDataApi`
- no se cambio `financialWriteApi`
- no se altero la numeracion global

## Siguiente paso seguro

Con una sesion autenticada valida o una credencial de servidor autorizada, reejecutar:

```bash
node scripts/ops/correct-invoice-2026-045.mjs --apply
```
