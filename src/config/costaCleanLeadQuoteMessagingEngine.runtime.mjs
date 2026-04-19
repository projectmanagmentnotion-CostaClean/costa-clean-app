export const costaCleanLeadQuoteMessagingEngine = {
  systemName: 'Costa Clean BCN Quote Engine',
  engineId: 'costa_clean_bcn_lead_quote_messaging_engine',
  version: '1.0.0',
  pricingVersion: 'pricing_v1',
  currency: 'EUR',
  locale: 'es-ES',
  businessName: 'Costa Clean BCN',
  quotePolicy: {
    objective: [
      'Generar presupuestos coherentes con la operativa real',
      'Generar presupuestos rentables',
      'Generar presupuestos claros para el cliente',
      'Generar presupuestos escalables',
    ],
    philosophy: ['Claridad', 'Sin sorpresas', 'Escalabilidad', 'Profesionalidad'],
  },
  pricing: {
    baseHourlyRateStandard: 20,
    b2bVolumeHourlyRateRange: { min: 14, max: 14.5 },
    defaultTaxRate: 0.21,
    internalOperatorCostPerHour: 10,
    internalMonthlyFixedCostsPerSite: {
      products: 100,
      fuel: 40,
      estimatedTotalPerSite: 1785,
    },
  },
  serviceMinimums: {
    minimumHoursPerOperator: 3,
    neverGenerateUnder: [1, 2],
    specialCases: {
      smallApartment: { minimumTotalHours: 3 },
      airbnb: { minimumTotalHours: 3 },
      deepCleaning: { minimumTotalHours: 6 },
      postConstruction: { minimumTotalHours: 6 },
    },
  },
  staffingRules: {
    basicApartmentCleaning: [
      { minM2: 0, maxM2: 40, operators: 1, hoursPerOperator: 3, minimumTotalHours: 3 },
      { minM2: 41, maxM2: 70, operators: 1, hoursPerOperator: 3, minimumTotalHours: 3 },
      { minM2: 71, maxM2: 100, operators: 1, hoursPerOperator: 4, minimumTotalHours: 4 },
    ],
    houseOrVilla: { operators: 2, hoursPerOperator: 3, minimumTotalHours: 6 },
    deepCleaning: { operators: 2, hoursPerOperator: 3, minimumTotalHours: 6 },
    postConstruction: { operators: 2, hoursPerOperator: 3, minimumTotalHours: 6 },
    hotelOrMultiroom: {
      defaultOperators: 2,
      defaultHoursPerDayPerTeam: 4,
      calculationMode: 'adjust_by_volume',
    },
    gymFixedModel: {
      mondayToFriday: { operators: 2, hoursPerOperator: 3, totalHoursPerDay: 6 },
      saturdayAndSunday: { operators: 1, hoursPerOperator: 4, totalHoursPerDay: 4 },
      weeklyTotalHours: 38,
      monthlyTotalHours: 164.5,
    },
  },
  serviceTypes: {
    basicCleaning: { includes: ['Cocina', 'Bano', 'Habitaciones', 'Suelos', 'Polvo'] },
    deepCleaning: { includes: ['Interior de cocina', 'Horno', 'Nevera', 'Grasa', 'Juntas', 'Detalles'] },
    airbnbTourist: { includes: ['Limpieza completa', 'Preparacion para huesped', 'Revision final'] },
  },
  supplements: {
    linenChange: {
      rulePriority: 'manual_review_recommended_due_to_business_rule_ambiguity',
      rules: [
        { condition: 'bedrooms_less_than_3', pricePerBedroom: 15 },
        { condition: 'bedrooms_equal_3', pricePerBedroom: 10 },
        { condition: 'bedrooms_greater_or_equal_3', pricePerBedroom: 10 },
      ],
    },
    terrace: { small: 10, large: 25 },
    garden: {
      estimatedExtraHoursRange: { min: 2, max: 3 },
      calculationMode: 'add_extra_hours',
    },
    windows: { calculationMode: 'manual_adjustment_by_size' },
  },
  forbiddenServices: [
    'Limpieza de tapiceria',
    'Limpieza de tapicería',
    'Limpieza de sofas',
    'Limpieza de sofás',
    'Limpieza de colchones',
  ],
  priceStructure: {
    standardModel: { formula: 'total = total_hours * hourly_rate' },
    mixedModel: {
      enabled: true,
      description: 'El precio puede dividirse entre una parte facturada con IVA y otra parte no facturada',
      defaultSplit: { invoicedRatio: 0.5, nonInvoicedRatio: 0.5 },
      criticalRule: 'Cualquier ajuste o descuento debe aplicarse siempre a la parte facturada',
    },
  },
  taxRules: {
    vatRate: 0.21,
    customerView: 'show_price_with_vat',
    systemCalculation: 'calculate_base_without_vat',
    mandatoryNote: 'Precios sin IVA.',
  },
  discountRules: {
    mainRule: 'Nunca bajar precio sin volumen',
    volumeHourlyRates: [
      { sitesMin: 1, sitesMax: 2, hourlyRate: 14.5 },
      { sitesMin: 3, sitesMax: 3, hourlyRate: 14 },
      { sitesMin: 4, sitesMax: 4, hourlyRate: 13.8 },
      { sitesMin: 5, sitesMax: 999, hourlyRate: 13.5 },
    ],
    alternativeDiscountModel: {
      type: 'fixed_discount_on_invoiced_part_only',
      amountPerSite: 90,
    },
  },
  mandatoryMessages: [
    'Si el servicio finaliza antes, solo se cobran las horas realmente trabajadas.',
    'Si se necesita mas tiempo, se informara previamente.',
    'Precios sin IVA.',
  ],
  businessLogic: {
    coreRule: 'El margen por sede puede bajar, pero el margen total debe subir',
    goal: 'Escalar el negocio, no optimizar solamente horas individuales',
  },
  forbiddenErrors: [
    'Generar presupuestos sin minimo de horas',
    'No incluir condiciones obligatorias',
    'Mezclar IVA con beneficio',
    'Bajar precio sin estructura de volumen',
    'No diferenciar tipos de servicio',
  ],
  leadInputFields: {
    required: ['client_name', 'location', 'service_type', 'property_type'],
    recommended: [
      'square_meters',
      'bedrooms',
      'bathrooms',
      'has_terrace',
      'terrace_size',
      'has_garden',
      'needs_linen_change',
      'window_cleaning_required',
      'urgency',
      'frequency',
      'site_count',
      'is_b2b',
    ],
  },
  calculationEngine: {
    stepOrder: [
      'Validate forbidden services',
      'Classify service type',
      'Determine staffing rule',
      'Apply minimum hours',
      'Calculate base hours',
      'Assign hourly rate',
      'Add supplements',
      'Apply discount logic if eligible',
      'Split invoiced vs non_invoiced if mixed model is enabled',
      'Calculate VAT only on invoiced amount',
      'Attach mandatory messages',
      'Return structured quote',
    ],
    hourlyRateSelection: {
      default: 20,
      b2bVolumeRule: 'Use discount_rules.volume_hourly_rates when site_count > 0 and volume agreement exists',
    },
    minimumHoursEnforcement: true,
    rounding: { moneyDecimals: 2, hoursDecimals: 2 },
  },
  quoteOutputSchema: {
    client: 'string',
    location: 'string',
    service_type: 'string',
    description: 'string',
    operators: 'number',
    hours_per_operator: 'number',
    total_hours: 'number',
    hourly_rate: 'number',
    base_amount_without_vat: 'number',
    supplements_total: 'number',
    discount_total: 'number',
    invoiced_base: 'number',
    invoiced_vat: 'number',
    invoiced_total_with_vat: 'number',
    non_invoiced_amount: 'number',
    grand_total_customer_view: 'number',
    conditions: ['string'],
  },
  decisionRules: [
    { id: 'R001', if: { service_type: 'basic_cleaning', property_type: 'apartment', square_meters_max: 40 }, then: { operators: 1, hours_per_operator: 3, minimum_total_hours: 3, hourly_rate: 20 } },
    { id: 'R002', if: { service_type: 'basic_cleaning', property_type: 'apartment', square_meters_min: 41, square_meters_max: 70 }, then: { operators: 1, hours_per_operator: 3, minimum_total_hours: 3, hourly_rate: 20 } },
    { id: 'R003', if: { service_type: 'basic_cleaning', property_type: 'apartment', square_meters_min: 71, square_meters_max: 100 }, then: { operators: 1, hours_per_operator: 4, minimum_total_hours: 4, hourly_rate: 20 } },
    { id: 'R004', if: { property_type: 'house_or_villa' }, then: { operators: 2, hours_per_operator: 3, minimum_total_hours: 6 } },
    { id: 'R005', if: { service_type: 'deep_cleaning' }, then: { operators: 2, hours_per_operator: 3, minimum_total_hours: 6 } },
    { id: 'R006', if: { service_type: 'post_construction' }, then: { operators: 2, hours_per_operator: 3, minimum_total_hours: 6 } },
    { id: 'R007', if: { service_type: 'airbnb_tourist' }, then: { minimum_total_hours: 3 } },
    { id: 'R008', if: { has_terrace: true, terrace_size: 'small' }, then: { extra_charge: 10 } },
    { id: 'R009', if: { has_terrace: true, terrace_size: 'large' }, then: { extra_charge: 25 } },
    { id: 'R010', if: { has_garden: true }, then: { extra_hours_min: 2, extra_hours_max: 3, calculation_mode: 'manual_or_estimated' } },
    { id: 'R011', if: { forbidden_service_requested: true }, then: { reject_quote: true, reason: 'Servicio prohibido por politica interna' } },
    { id: 'R012', if: { site_count_min: 1, site_count_max: 2, is_b2b: true }, then: { hourly_rate: 14.5 } },
    { id: 'R013', if: { site_count: 3, is_b2b: true }, then: { hourly_rate: 14 } },
    { id: 'R014', if: { site_count: 4, is_b2b: true }, then: { hourly_rate: 13.8 } },
    { id: 'R015', if: { site_count_min: 5, is_b2b: true }, then: { hourly_rate: 13.5 } },
    { id: 'R016', if: { mixed_model_enabled: true }, then: { split_invoiced_ratio: 0.5, split_non_invoiced_ratio: 0.5, apply_discounts_only_to_invoiced_part: true } },
  ],
  outputTemplateRules: {
    mustIncludeFields: ['client', 'location', 'service_type', 'description', 'operators', 'hours_per_operator', 'total_hours', 'price', 'total', 'conditions'],
    mustIncludeMessages: [
      'Si el servicio finaliza antes, solo se cobran las horas realmente trabajadas.',
      'Si se necesita mas tiempo, se informara previamente.',
      'Precios sin IVA.',
    ],
  },
  manualReview: {
    customerFacingOutputsRequireReview: true,
    autoSendCustomerMessages: false,
    reviewedDraftStatus: 'reviewed',
    neverAutoSend: true,
  },
  mandatoryConditions: {
    intake: {
      fullName: 'El nombre completo es obligatorio.',
      phone: 'El telefono es obligatorio.',
      serviceNeedLabel: 'El tipo de servicio es obligatorio.',
      serviceFrequencyLabel: 'La frecuencia del servicio es obligatoria.',
      propertyType: 'El tipo de propiedad es obligatorio.',
      sqmBand: 'La franja de metros cuadrados es obligatoria.',
      city: 'La poblacion es obligatoria.',
      postalCode: 'El codigo postal es obligatorio.',
      preferredQuoteChannel: 'El canal preferido es obligatorio.',
      consentQuoteProcessing: 'El consentimiento es obligatorio.',
    },
    conversion: {
      requiresReviewedLeadDraft: true,
      createsQuoteInStatus: 'draft',
      createsOrLinksClientBeforeQuote: true,
      doesNotSendCommunications: true,
    },
  },
  messaging: {
    generationProvider: 'placeholder',
    openAiLiveGenerationEnabled: false,
    emotionalBiasByLeadType: {
      default: {
        tone: 'calm_reassuring_practical',
        emphasis: ['claridad', 'sin sorpresas', 'revision final del equipo'],
      },
      urgent: {
        tone: 'fast_reassuring',
        emphasis: ['rapidez', 'confirmacion previa si se necesita mas tiempo'],
      },
      previousIssues: {
        tone: 'trust_repair',
        emphasis: ['profesionalidad', 'alcance claro', 'sin sorpresas'],
      },
      b2b: {
        tone: 'professional_operational',
        emphasis: ['escalabilidad', 'volumen', 'margen total', 'condiciones revisables'],
      },
      forbiddenService: {
        tone: 'polite_boundary',
        emphasis: ['servicio no disponible', 'politica interna', 'alternativa si procede'],
      },
    },
  },
}

function normalizeLabel(value) {
  return String(value || '').toLocaleLowerCase(costaCleanLeadQuoteMessagingEngine.locale)
}

function includesAny(value, terms) {
  const normalized = normalizeLabel(value)
  return terms.some((term) => normalized.includes(normalizeLabel(term)))
}

function estimateSquareMeters(sqmBand) {
  if (!sqmBand) return null
  const numbers = sqmBand.match(/\d+/g)?.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite) ?? []
  if (numbers.length >= 2) return (numbers[0] + numbers[1]) / 2
  if (numbers.length === 1) return numbers[0]
  if (includesAny(sqmBand, ['menos', '<50'])) return 40
  return null
}

function resolveServiceType(input) {
  const label = `${input.serviceNeedLabel ?? ''} ${input.serviceFrequencyLabel ?? ''}`
  if (includesAny(label, ['obra', 'post construction', 'post-construction', 'fin de obra'])) return 'post_construction'
  if (includesAny(label, ['profunda', 'deep'])) return 'deep_cleaning'
  if (includesAny(label, ['airbnb', 'tur', 'huesped', 'huésped'])) return 'airbnb_tourist'
  if (includesAny(label, ['hotel', 'multiroom', 'multi-room'])) return 'hotel_or_multiroom'
  if (includesAny(label, ['gym', 'gimnasio'])) return 'gym_fixed_model'
  return 'basic_cleaning'
}

function resolvePropertyType(input) {
  const label = `${input.propertyType ?? ''} ${input.serviceNeedLabel ?? ''}`
  if (includesAny(label, ['casa', 'villa'])) return 'house_or_villa'
  if (includesAny(label, ['oficina'])) return 'office'
  if (includesAny(label, ['local'])) return 'local'
  if (includesAny(label, ['tur', 'airbnb'])) return 'tourist_apartment'
  return 'apartment'
}

function resolveStaffingRule(input) {
  const serviceType = resolveServiceType(input)
  const propertyType = resolvePropertyType(input)
  const squareMeters = estimateSquareMeters(input.sqmBand)

  if (serviceType === 'deep_cleaning') return costaCleanLeadQuoteMessagingEngine.staffingRules.deepCleaning
  if (serviceType === 'post_construction') return costaCleanLeadQuoteMessagingEngine.staffingRules.postConstruction
  if (propertyType === 'house_or_villa') return costaCleanLeadQuoteMessagingEngine.staffingRules.houseOrVilla

  if (propertyType === 'apartment' && squareMeters !== null) {
    return costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning.find(
      (rule) => squareMeters >= rule.minM2 && squareMeters <= rule.maxM2,
    ) ?? costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning.at(-1)
  }

  return costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning[0]
}

export function getLeadQuoteEngine() {
  return costaCleanLeadQuoteMessagingEngine
}

export function getPricingRules() {
  return {
    currency: costaCleanLeadQuoteMessagingEngine.currency,
    pricingVersion: costaCleanLeadQuoteMessagingEngine.pricingVersion,
    pricing: costaCleanLeadQuoteMessagingEngine.pricing,
    taxRules: costaCleanLeadQuoteMessagingEngine.taxRules,
    serviceMinimums: costaCleanLeadQuoteMessagingEngine.serviceMinimums,
    staffingRules: costaCleanLeadQuoteMessagingEngine.staffingRules,
    supplements: costaCleanLeadQuoteMessagingEngine.supplements,
    discountRules: costaCleanLeadQuoteMessagingEngine.discountRules,
    priceStructure: costaCleanLeadQuoteMessagingEngine.priceStructure,
  }
}

export function getWorkflowRules() {
  return costaCleanLeadQuoteMessagingEngine.mandatoryConditions.conversion
}

export function getMessagingRules() {
  return costaCleanLeadQuoteMessagingEngine.messaging
}

export function getManualReviewRules() {
  return costaCleanLeadQuoteMessagingEngine.manualReview
}

export function getMandatoryIntakeMessages() {
  return costaCleanLeadQuoteMessagingEngine.mandatoryConditions.intake
}

export function parseCount(value) {
  const parsed = Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export function roundMoney(value) {
  const factor = 10 ** costaCleanLeadQuoteMessagingEngine.calculationEngine.rounding.moneyDecimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function getDefaultTaxRate() {
  return costaCleanLeadQuoteMessagingEngine.taxRules.vatRate
}

export function getSqmBaseAmount(sqmBand) {
  const squareMeters = estimateSquareMeters(sqmBand ?? null)
  const fallbackRule = costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning[0]
  const staffingRule = squareMeters === null
    ? fallbackRule
    : costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning.find(
      (rule) => squareMeters >= rule.minM2 && squareMeters <= rule.maxM2,
    ) ?? costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning.at(-1)

  return staffingRule.minimumTotalHours * costaCleanLeadQuoteMessagingEngine.pricing.baseHourlyRateStandard
}

export function getServiceMultiplier() {
  return 1
}

function buildLinenAdjustment(rooms) {
  if (rooms <= 0) return null
  const linenRule = costaCleanLeadQuoteMessagingEngine.supplements.linenChange.rules.find((rule) => {
    if (rule.condition === 'bedrooms_less_than_3') return rooms < 3
    if (rule.condition === 'bedrooms_equal_3') return rooms === 3
    return rooms >= 3
  })
  if (!linenRule) return null
  return {
    code: 'linen_change',
    label: `Cambio de ropa de cama (${rooms})`,
    amount: rooms * linenRule.pricePerBedroom,
  }
}

export function buildSupplementAdjustments(input) {
  const rooms = parseCount(input.rooms)
  const adjustments = []

  if (input.hasOutdoorAreas === true) {
    adjustments.push({
      code: 'terrace_large',
      label: 'Terraza o zona exterior',
      amount: costaCleanLeadQuoteMessagingEngine.supplements.terrace.large,
    })
  }

  if (includesAny(input.scopeNotes, ['ropa de cama', 'sabanas', 'sábanas', 'linen'])) {
    const linenAdjustment = buildLinenAdjustment(rooms)
    if (linenAdjustment) adjustments.push(linenAdjustment)
  }

  if (includesAny(input.scopeNotes, ['jardin', 'jardín', 'garden'])) {
    const gardenHours = costaCleanLeadQuoteMessagingEngine.supplements.garden.estimatedExtraHoursRange.min
    adjustments.push({
      code: 'garden_extra_hours',
      label: `Jardin (${gardenHours}h extra estimadas)`,
      amount: gardenHours * costaCleanLeadQuoteMessagingEngine.pricing.baseHourlyRateStandard,
    })
  }

  return adjustments
}

export function calculatePricing(input) {
  const staffingRule = resolveStaffingRule(input)
  const totalHours = Math.max(
    staffingRule.minimumTotalHours,
    staffingRule.operators * staffingRule.hoursPerOperator,
  )
  const hourlyRate = costaCleanLeadQuoteMessagingEngine.pricing.baseHourlyRateStandard
  const baseAmount = roundMoney(totalHours * hourlyRate)
  const serviceMultiplier = 1
  const serviceAdjustedAmount = baseAmount
  const adjustments = buildSupplementAdjustments(input)
  const subtotal = roundMoney(serviceAdjustedAmount + adjustments.reduce((sum, item) => sum + item.amount, 0))
  const taxRate = getDefaultTaxRate()
  const taxAmount = roundMoney(subtotal * taxRate)
  const total = roundMoney(subtotal + taxAmount)

  return {
    version: costaCleanLeadQuoteMessagingEngine.pricingVersion,
    currency: costaCleanLeadQuoteMessagingEngine.currency,
    baseAmount,
    serviceMultiplier,
    serviceAdjustedAmount,
    adjustments,
    subtotal,
    taxRate,
    taxAmount,
    total,
    confidence: 'estimate',
  }
}

export function mapServiceType(label) {
  if (includesAny(label, ['obra', 'post construction', 'fin de obra'])) return 'post_construction'
  if (includesAny(label, ['profunda'])) return 'deep_cleaning'
  if (includesAny(label, ['airbnb', 'tur'])) return 'airbnb_tourist'
  return 'basic_cleaning'
}

export function mapPropertyType(label) {
  if (includesAny(label, ['casa', 'villa'])) return 'house_or_villa'
  if (includesAny(label, ['oficina'])) return 'office'
  if (includesAny(label, ['local'])) return 'local'
  if (includesAny(label, ['tur', 'airbnb'])) return 'tourist_apartment'
  return 'apartment'
}

export function buildNotes(input, pricing) {
  return [
    input.scopeNotes,
    input.rooms ? `Habitaciones: ${input.rooms}` : null,
    input.bathrooms ? `Banos: ${input.bathrooms}` : null,
    input.hasOutdoorAreas === null ? null : `Zonas exteriores: ${input.hasOutdoorAreas ? 'si' : 'no'}`,
    input.hasPets === null ? null : `Mascotas: ${input.hasPets ? 'si' : 'no'}`,
    input.requestedServiceDate ? `Fecha solicitada: ${input.requestedServiceDate}` : null,
    input.preferredTimeSlot ? `Horario preferido: ${input.preferredTimeSlot}` : null,
    input.urgencyLabel ? `Urgencia: ${input.urgencyLabel}` : null,
    input.previousCleaningIssues ? `Historial: ${input.previousCleaningIssues}` : null,
    `Estimacion ${pricing.version}: ${pricing.subtotal.toFixed(2)} EUR + IVA (${pricing.total.toFixed(2)} EUR total).`,
    ...costaCleanLeadQuoteMessagingEngine.mandatoryMessages,
  ].filter(Boolean).join('\n')
}

export function buildQuoteDraftSeed(input, pricing) {
  return {
    status: 'draft',
    serviceSummary: [
      input.serviceNeedLabel,
      input.serviceFrequencyLabel,
      input.propertyType,
      input.sqmBand,
    ].filter(Boolean).join(' · ') || 'Solicitud de presupuesto de limpieza',
    notes: buildNotes(input, pricing),
    requestedServiceDate: input.requestedServiceDate,
    preferredTimeSlot: input.preferredTimeSlot,
    preferredQuoteChannel: input.preferredQuoteChannel,
    pricingBreakdown: pricing,
  }
}

export function resolveMessageBias(input) {
  const context = `${input.serviceNeedLabel ?? ''} ${input.scopeNotes ?? ''}`
  if (isForbiddenServiceRequested(input)) {
    return costaCleanLeadQuoteMessagingEngine.messaging.emotionalBiasByLeadType.forbiddenService
  }
  if (input.previousCleaningIssues) return costaCleanLeadQuoteMessagingEngine.messaging.emotionalBiasByLeadType.previousIssues
  if (includesAny(input.urgencyLabel, ['antes', 'posible', 'semana'])) {
    return costaCleanLeadQuoteMessagingEngine.messaging.emotionalBiasByLeadType.urgent
  }
  if (includesAny(`${input.serviceNeedLabel ?? ''} ${input.propertyType ?? ''}`, ['oficina', 'local', 'b2b'])) {
    return costaCleanLeadQuoteMessagingEngine.messaging.emotionalBiasByLeadType.b2b
  }

  return costaCleanLeadQuoteMessagingEngine.messaging.emotionalBiasByLeadType.default
}

export function isForbiddenServiceRequested(input) {
  const context = `${input.serviceNeedLabel ?? ''} ${input.scopeNotes ?? ''}`
  return costaCleanLeadQuoteMessagingEngine.forbiddenServices.some((service) => includesAny(context, [service]))
}

export function buildCommunicationDraftPlaceholders(input, pricing) {
  const greetingName = input.fullName.split(' ')[0] || input.fullName
  const estimate = `${pricing.total.toFixed(2)} EUR IVA incluido`
  const messageBias = resolveMessageBias(input)

  return {
    ai_email_draft: [
      `Hola ${greetingName},`,
      '',
      `Gracias por contactar con ${costaCleanLeadQuoteMessagingEngine.businessName}. Hemos recibido tu solicitud para ${input.serviceNeedLabel || 'un servicio de limpieza'} en ${input.city || 'tu zona'}.`,
      `La estimacion inicial es ${estimate}, pendiente de revision final del equipo.`,
      '',
      ...costaCleanLeadQuoteMessagingEngine.mandatoryMessages,
      'No se ha enviado este mensaje automaticamente.',
    ].join('\n'),
    ai_whatsapp_draft: `Hola ${greetingName}, gracias por contactar con ${costaCleanLeadQuoteMessagingEngine.businessName}. Hemos recibido tu solicitud y la estimacion inicial es ${estimate}, pendiente de revision final. No enviado automaticamente.`,
    ai_draft_status: 'drafted',
    ai_generation_metadata: {
      provider: costaCleanLeadQuoteMessagingEngine.messaging.generationProvider,
      integration_status: 'openai_hook_not_enabled',
      auto_send: costaCleanLeadQuoteMessagingEngine.manualReview.autoSendCustomerMessages,
      engine_id: costaCleanLeadQuoteMessagingEngine.engineId,
      engine_version: costaCleanLeadQuoteMessagingEngine.version,
      pricing_version: costaCleanLeadQuoteMessagingEngine.pricingVersion,
      message_bias: messageBias,
      generated_at: new Date().toISOString(),
    },
  }
}
