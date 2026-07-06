# Visual Home, Pro Forms And Smart Suggestions

## Objetivo

Esta fase convierte `Home` en una superficie mas visual y compacta y añade mejoras de formulario reutilizables sin tocar logica de negocio, persistencia, rutas, auth, Supabase ni dominios fiscales criticos.

## Alcance real aplicado

### Home visual

Archivos principales:

- `src/pages/HomePage.tsx`
- `src/features/dashboard/home-gsap-dashboard.css`
- `src/components/visual-ux-system.css`
- `src/features/dashboard/components/HomeQuickActionsPanel.tsx`
- `src/features/dashboard/components/HomeFiscalKpiGrid.tsx`
- `src/features/dashboard/components/HomeGsapChartCard.tsx`

Cambios aplicados:

- copy del header mas corto y mas operativo
- bloque lateral de dinero simplificado
- quick actions mas compactas
- densidad menor en cards y charts
- titulos y descripciones de seccion reducidos
- tipografia de KPI compactas ajustada para evitar overflow y ruido

### Formularios pro y sugerencias locales

Nuevas primitives:

- `src/design-system/components/DSProFormField.tsx`
- `src/design-system/components/DSInlineSuggestionList.tsx`
- `src/design-system/components/DSSmartPostalCodeInput.tsx`
- `src/design-system/components/DSConceptAutocomplete.tsx`
- `src/features/concepts/useRecentConceptSuggestions.ts`
- `src/features/locations/postalCodeSuggestions.ts`

Patrones introducidos:

- campo profesional con label, hint y error mas compactos
- lista inline de sugerencias con CTA minima
- sugerencias locales de CP y ciudad sin backend externo
- autocompletado de conceptos con memoria local reciente y memoria historica ya existente

### Integraciones aplicadas

CP / ciudad:

- `src/features/publicIntake/PublicQuoteRequestForm.tsx`
- `src/features/properties/PropertyCreateFlow.tsx`

Conceptos inline:

- `src/features/quotes/QuoteCreateFlow.tsx`
- `src/features/quotes/QuoteEditFlow.tsx`
- `src/features/invoices/InvoiceCreateFlow.tsx`
- `src/features/invoices/InvoiceEditFlow.tsx`
- `src/features/expenses/ExpenseCreateFlow.tsx`
- `src/features/expenses/ExpenseEditFlow.tsx`
- `src/features/jobs/JobCreateFlow.tsx`

## Estrategia de sugerencias

### CP y ciudad

- dataset local y extensible en `src/features/locations/postalCodeSuggestions.ts`
- sin llamadas externas
- sin dependencia nueva
- aplicar sugerencia es una accion explicita

### Conceptos

- se conserva `conceptMemory` como fuente principal de historial de dominio
- se añade memoria local reciente en `localStorage` con namespace propio
- no se guardan entradas que parezcan sensibles
- el usuario puede seguir escribiendo libremente

## Que no se toco

- Supabase
- SQL
- RPC
- migrations
- auth
- rutas
- `?view=`
- `appDataApi`
- `financialWriteApi`
- numeracion de facturas
- `invoice_number`
- `display_code`
- `save_invoice_with_lines`
- `save_invoice_with_lines_v2`
- calculos, totales, fiscalidad y persistencia

## Limitaciones y decisiones de seguridad

- `PropertyCreateForm.tsx` no se migro en esta fase porque existe una variante StepFlow ya viva y el valor principal estaba en intake + create flow principal
- las sugerencias locales de CP/city son deliberadamente acotadas y deben ampliarse solo con evidencia operativa
- el autocompletado de conceptos no fuerza estructuras ni rellena importes salvo cuando el usuario elige una sugerencia estructurada ya soportada por la app

## Validacion

- `npm run lint` OK
- `npm run build` OK

## Siguiente paso recomendado

- extender `DSSmartPostalCodeInput` solo a superficies create/edit donde `city` y `postal_code` ya existan como campos separados
- seguir absorbiendo `ConceptSuggestions` legacy en superficies no criticas restantes
- mantener cualquier ampliacion de motion dentro de la capa compartida y sin invadir dominios fiscales sensibles
