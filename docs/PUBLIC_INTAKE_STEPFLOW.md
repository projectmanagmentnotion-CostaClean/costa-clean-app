# Public Intake StepFlow

## Estado anterior

Antes de Sprint 6, `src/features/publicIntake/PublicQuoteRequestForm.tsx` ya era secuencial, pero usaba un stepper propio con 6 pasos:

1. contacto
2. servicio
3. propiedad
4. fecha y zona
5. detalles
6. consentimiento

El flujo era funcional, pero tenia tres limites claros:

- no usaba el StepFlow oficial del repo
- no tenia un paso de revision final separado antes del submit
- el success state vivia dentro del ultimo paso y no como estado de cierre propio

## Campos existentes auditados

Todos los campos del contrato `QuoteRequestNormalizedInput` se mantienen:

- `submittedAt`
- `fullName`
- `phone`
- `email`
- `serviceNeedLabel`
- `scopeNotes`
- `propertyType`
- `sqmBand`
- `rooms`
- `bathrooms`
- `hasOutdoorAreas`
- `hasPets`
- `requestedServiceDate`
- `preferredTimeSlot`
- `serviceFrequencyLabel`
- `preferredQuoteChannel`
- `consentQuoteProcessing`
- `postalCode`
- `city`
- `urgencyLabel`
- `previousCleaningIssues`
- `legacyUnusedField`

## Campos obligatorios y opcionales

### Obligatorios

Reglas preservadas desde `validateInput` y la validacion visual del formulario:

- `fullName`
- `phone`
- `serviceNeedLabel`
- `serviceFrequencyLabel`
- `propertyType`
- `sqmBand`
- `city`
- `postalCode`
- `preferredQuoteChannel`
- `consentQuoteProcessing`

### Opcionales

- `email`
- `scopeNotes`
- `rooms`
- `bathrooms`
- `hasOutdoorAreas`
- `hasPets`
- `requestedServiceDate`
- `preferredTimeSlot`
- `urgencyLabel`
- `previousCleaningIssues`
- `legacyUnusedField`

## Pasos finales

Sprint 6 deja el flujo publico en 7 pasos:

1. Datos de contacto
2. Tipo de servicio
3. Datos de propiedad
4. Fecha, urgencia y disponibilidad
5. Detalles adicionales
6. Revision final
7. Confirmacion / success

## Decision tecnica

Decision tomada: **migracion completa a `FullscreenStepFlow`**.

Motivo:

- el formulario actual vivia enteramente en estado local
- el submit ya estaba encapsulado en `submitPublicQuoteRequest`
- no hacia falta tocar ni `api/public-quote-request.js` ni `intakePipeline.mjs`
- `FullscreenStepFlow` ya soportaba progreso, side content, footer sticky, resumen y navegacion entre pasos

No fue necesaria una adaptacion progresiva porque el riesgo real estaba en el pipeline, no en la orquestacion visual del formulario.

## Pipeline preservado

No se tocaron estos contratos ni su secuencia:

- `normalizeRequestInput`
- `validateInput`
- `calculatePricing`
- insercion en `intake_submissions`
- `createOrUpdateLead`
- insercion en `lead_drafts`
- `buildQuoteDraftSeed`
- `buildCommunicationDraftPlaceholders`
- placeholders de `ai_email_draft`
- placeholders de `ai_whatsapp_draft`
- compatibilidad con `nativeQuoteRequestFieldMap`
- compatibilidad legacy con Google Forms / CSV

Tampoco se cambiaron:

- rutas publicas
- auth
- Supabase contracts
- `appDataApi`
- `financialWriteApi`
- modulos internos

## Cambios UX realizados

- Se sustituye el stepper propio por el StepFlow oficial.
- Se conserva el branding publico de Costa Clean.
- Se separa el consentimiento del submit final y se integra en la fase previa a revision.
- Se añade un paso de revision final obligatorio antes de confirmar.
- Se crea un success state propio con:
  - solicitud recibida
  - referencia
  - canal de contacto
  - expectativa de respuesta
- Se añade resumen lateral y contexto persistente durante el flujo.
- Se mejoran mensajes de ayuda por paso y el ritmo mobile-first.
- Se mantienen labels visibles, botones grandes y CTA claras.

## Que no se toco

- normalizacion
- validacion de negocio
- proteccion antispam / timing / honeypot
- deteccion de duplicados recientes
- lead matching
- lead draft creation
- quote draft seed
- placeholders de borradores comerciales
- envio automatico de emails, WhatsApps o presupuestos

## Riesgos pendientes

- El flujo publico depende de un pipeline legacy sensible y acoplado a `lead_drafts`.
- La capa visual ya esta unificada, pero la logica de validacion sigue embebida en el propio formulario.
- El success state informa correctamente, pero no verifica entrega real por canal; solo confirma registro del pipeline.
- `legacyUnusedField` sigue preservado por compatibilidad aunque no tenga protagonismo UX.
