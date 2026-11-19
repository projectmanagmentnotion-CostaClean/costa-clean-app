# Smart Expense: preparación local para prueba controlada

Estado: `PREPARADO_LOCAL`; no se ha invocado OpenAI, desplegado una Edge Function, escrito en Supabase ni creado un gasto.

## Fixtures sintéticos

Se reutilizan los documentos de `src/features/expenses/fixtures/` y se copian a Descargas como `CostaClean-SmartExpense-Synthetic-Invoice.pdf` y `.png`. No se utilizaron los PDFs de Descargas cuyos nombres corresponden a facturas de negocio.

| Campo | PDF | PNG |
|---|---|---|
| Proveedor | Proveedor Ficticio Norte S.L. | Suministros Demo Mediterraneo S.L. |
| Identificador | B00000002, ficticio e inválido | B00000001, ficticio e inválido |
| Número | SYN-PDF-2026-001 | SYN-IMG-2026-002 |
| Fecha | 12/11/2026 | 13/11/2026 |
| Concepto | Consumibles de limpieza sintéticos | Material de prueba sintético |
| Base | 100,00 EUR | 80,00 EUR |
| IVA 21 % | 21,00 EUR | 16,80 EUR |
| Total | 121,00 EUR | 96,80 EUR |

La prueba automatizada lee el texto del PDF y los campos incrustados en el PNG, comprueba cabeceras de archivo y verifica aritmética y rechazo fiscal de los NIF ficticios. La inspección visual local confirmó que los campos requeridos también son visibles y legibles en ambas páginas/imágenes.

## Diagnóstico seguro de esquema

`validateOpenAiProposal` distingue `schema_object`, `schema_keys`, `schema_version` y `schema_document_type`. Las pruebas de `openAiExpenseExtractionAdapter.test.ts` incluyen propuesta válida y casos inválidos para esas categorías, además de errores de NIF, importes, IVA y evidencia. La Edge Function registra únicamente el código fijo de rechazo; no devuelve el código detallado ni el contenido del proveedor al cliente.

## Revisión humana y límites

El flujo presenta los datos como pendientes de confirmar; el gasto no se crea automáticamente. `confirmExpenseCapture` exige confirmación humana y la conciliación fiscal debe estar en `MATCH`; las pruebas rechazan propuestas sin confirmar o con importes/NIF no válidos.

La validación del visor del contenido PDF en una sesión QA sigue `PENDIENTE` y es independiente de la extracción. Los tests locales no prueban el visor en Preview ni acreditan una respuesta real del proveedor. La siguiente prueba de extracción requerirá autorización específica antes de la llamada facturable y de cualquier despliegue necesario.
