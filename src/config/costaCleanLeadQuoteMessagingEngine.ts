import type { PublicQuotePricingAdjustment, PublicQuotePricingBreakdown, QuoteRequestNormalizedInput } from '../features/publicIntake/types'

export type CostaCleanEngineVersion = '1.0.0'
export type CostaCleanPricingVersion = 'pricing_v1'
export type CostaCleanCurrency = 'EUR'
export type CostaCleanLocale = 'es-ES'
export type LeadDraftReviewStatus = 'not_generated' | 'drafted' | 'reviewed'
export type QuoteConversionStatus = 'draft'
export type MessageGenerationProvider = 'placeholder' | 'openai'
export type ServiceTypeCode = 'basic_cleaning' | 'deep_cleaning' | 'airbnb_tourist' | 'post_construction' | 'hotel_or_multiroom' | 'gym_fixed_model'
export type PropertyTypeCode = 'apartment' | 'house_or_villa' | 'office' | 'local' | 'tourist_apartment'

export interface QuotePolicyRules {
  objective: readonly string[]
  philosophy: readonly string[]
}

export interface PricingRules {
  baseHourlyRateStandard: number
  b2bVolumeHourlyRateRange: { min: number; max: number }
  defaultTaxRate: number
  internalOperatorCostPerHour: number
  internalMonthlyFixedCostsPerSite: {
    products: number
    fuel: number
    estimatedTotalPerSite: number
  }
}

export interface ServiceMinimumRules {
  minimumHoursPerOperator: number
  neverGenerateUnder: readonly number[]
  specialCases: {
    smallApartment: { minimumTotalHours: number }
    airbnb: { minimumTotalHours: number }
    deepCleaning: { minimumTotalHours: number }
    postConstruction: { minimumTotalHours: number }
  }
}

export interface StaffingRule {
  operators: number
  hoursPerOperator: number
  minimumTotalHours: number
}

export interface ApartmentStaffingRule extends StaffingRule {
  minM2: number
  maxM2: number
}

export interface StaffingRules {
  basicApartmentCleaning: readonly ApartmentStaffingRule[]
  houseOrVilla: StaffingRule
  deepCleaning: StaffingRule
  postConstruction: StaffingRule
  hotelOrMultiroom: {
    defaultOperators: number
    defaultHoursPerDayPerTeam: number
    calculationMode: 'adjust_by_volume'
  }
  gymFixedModel: {
    mondayToFriday: {
      operators: number
      hoursPerOperator: number
      totalHoursPerDay: number
    }
    saturdayAndSunday: {
      operators: number
      hoursPerOperator: number
      totalHoursPerDay: number
    }
    weeklyTotalHours: number
    monthlyTotalHours: number
  }
}

export interface ServiceTypeRules {
  basicCleaning: { includes: readonly string[] }
  deepCleaning: { includes: readonly string[] }
  airbnbTourist: { includes: readonly string[] }
}

export interface SupplementRules {
  linenChange: {
    rulePriority: 'manual_review_recommended_due_to_business_rule_ambiguity'
    rules: ReadonlyArray<{
      condition: 'bedrooms_less_than_3' | 'bedrooms_equal_3' | 'bedrooms_greater_or_equal_3'
      pricePerBedroom: number
    }>
  }
  terrace: { small: number; large: number }
  garden: {
    estimatedExtraHoursRange: { min: number; max: number }
    calculationMode: 'add_extra_hours'
  }
  windows: { calculationMode: 'manual_adjustment_by_size' }
}

export interface PriceStructureRules {
  standardModel: { formula: string }
  mixedModel: {
    enabled: boolean
    description: string
    defaultSplit: {
      invoicedRatio: number
      nonInvoicedRatio: number
    }
    criticalRule: string
  }
}

export interface TaxRules {
  vatRate: number
  customerView: 'show_price_with_vat'
  systemCalculation: 'calculate_base_without_vat'
  mandatoryNote: string
}

export interface VolumeHourlyRateTier {
  sitesMin: number
  sitesMax?: number
  hourlyRate: number
}

export interface DiscountRules {
  mainRule: string
  volumeHourlyRates: ReadonlyArray<VolumeHourlyRateTier>
  alternativeDiscountModel: {
    type: 'fixed_discount_on_invoiced_part_only'
    amountPerSite: number
  }
}

export interface BusinessLogicRules {
  coreRule: string
  goal: string
}

export interface LeadInputFieldRules {
  required: readonly string[]
  recommended: readonly string[]
}

export interface CalculationEngineRules {
  stepOrder: readonly string[]
  hourlyRateSelection: {
    default: number
    b2bVolumeRule: string
  }
  minimumHoursEnforcement: boolean
  rounding: {
    moneyDecimals: number
    hoursDecimals: number
  }
}

export interface QuoteOutputSchemaRules {
  client: 'string'
  location: 'string'
  service_type: 'string'
  description: 'string'
  operators: 'number'
  hours_per_operator: 'number'
  total_hours: 'number'
  hourly_rate: 'number'
  base_amount_without_vat: 'number'
  supplements_total: 'number'
  discount_total: 'number'
  invoiced_base: 'number'
  invoiced_vat: 'number'
  invoiced_total_with_vat: 'number'
  non_invoiced_amount: 'number'
  grand_total_customer_view: 'number'
  conditions: readonly ['string']
}

export interface DecisionRule {
  id: string
  if: Record<string, string | number | boolean>
  then: Record<string, string | number | boolean>
}

export interface OutputTemplateRules {
  mustIncludeFields: readonly string[]
  mustIncludeMessages: readonly string[]
}

export interface IntakeMandatoryMessages {
  fullName: string
  phone: string
  serviceNeedLabel: string
  serviceFrequencyLabel: string
  propertyType: string
  sqmBand: string
  city: string
  postalCode: string
  preferredQuoteChannel: string
  consentQuoteProcessing: string
}

export interface ConversionRules {
  requiresReviewedLeadDraft: boolean
  createsQuoteInStatus: QuoteConversionStatus
  createsOrLinksClientBeforeQuote: boolean
  doesNotSendCommunications: boolean
}

export interface ManualReviewRules {
  customerFacingOutputsRequireReview: boolean
  autoSendCustomerMessages: false
  reviewedDraftStatus: 'reviewed'
  neverAutoSend: true
}

export interface MessageBiasRule {
  tone: string
  emphasis: readonly string[]
}

export interface MessagingRules {
  generationProvider: MessageGenerationProvider
  openAiLiveGenerationEnabled: boolean
  emotionalBiasByLeadType: {
    default: MessageBiasRule
    urgent: MessageBiasRule
    previousIssues: MessageBiasRule
    b2b: MessageBiasRule
    forbiddenService: MessageBiasRule
  }
}

export interface CostaCleanLeadQuoteMessagingEngine {
  systemName: 'Costa Clean BCN Quote Engine'
  engineId: 'costa_clean_bcn_lead_quote_messaging_engine'
  version: CostaCleanEngineVersion
  pricingVersion: CostaCleanPricingVersion
  currency: CostaCleanCurrency
  locale: CostaCleanLocale
  businessName: 'Costa Clean BCN'
  quotePolicy: QuotePolicyRules
  pricing: PricingRules
  serviceMinimums: ServiceMinimumRules
  staffingRules: StaffingRules
  serviceTypes: ServiceTypeRules
  supplements: SupplementRules
  forbiddenServices: readonly string[]
  priceStructure: PriceStructureRules
  taxRules: TaxRules
  discountRules: DiscountRules
  mandatoryMessages: readonly string[]
  businessLogic: BusinessLogicRules
  forbiddenErrors: readonly string[]
  leadInputFields: LeadInputFieldRules
  calculationEngine: CalculationEngineRules
  quoteOutputSchema: QuoteOutputSchemaRules
  decisionRules: readonly DecisionRule[]
  outputTemplateRules: OutputTemplateRules
  manualReview: ManualReviewRules
  mandatoryConditions: {
    intake: IntakeMandatoryMessages
    conversion: ConversionRules
  }
  messaging: MessagingRules
}

export interface CommunicationDraftResult {
  ai_email_draft: string
  ai_whatsapp_draft: string
  ai_draft_status: Extract<LeadDraftReviewStatus, 'drafted'>
  ai_generation_metadata: {
    provider: MessageGenerationProvider
    integration_status: 'openai_hook_not_enabled'
    auto_send: false
    engine_id: CostaCleanLeadQuoteMessagingEngine['engineId']
    engine_version: CostaCleanEngineVersion
    pricing_version: CostaCleanPricingVersion
    message_bias: MessageBiasRule
    generated_at: string
  }
}

export interface QuoteDraftSeedFromEngine {
  status: 'draft'
  serviceSummary: string
  notes: string
  requestedServiceDate: string | null
  preferredTimeSlot: string | null
  preferredQuoteChannel: QuoteRequestNormalizedInput['preferredQuoteChannel']
  pricingBreakdown: PublicQuotePricingBreakdown
}

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
} as const satisfies CostaCleanLeadQuoteMessagingEngine

function normalizeLabel(value: string | null | undefined): string {
  return String(value || '').toLocaleLowerCase(costaCleanLeadQuoteMessagingEngine.locale)
}

function includesAny(value: string | null | undefined, terms: readonly string[]): boolean {
  const normalized = normalizeLabel(value)
  return terms.some((term) => normalized.includes(normalizeLabel(term)))
}

function estimateSquareMeters(sqmBand: string | null): number | null {
  if (!sqmBand) return null
  const numbers = sqmBand.match(/\d+/g)?.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite) ?? []
  if (numbers.length >= 2) return (numbers[0] + numbers[1]) / 2
  if (numbers.length === 1) return numbers[0]
  if (includesAny(sqmBand, ['menos', '<50'])) return 40
  return null
}

function resolveServiceType(input: QuoteRequestNormalizedInput): ServiceTypeCode {
  const label = `${input.serviceNeedLabel ?? ''} ${input.serviceFrequencyLabel ?? ''}`
  if (includesAny(label, ['obra', 'post construction', 'post-construction', 'fin de obra'])) return 'post_construction'
  if (includesAny(label, ['profunda', 'deep'])) return 'deep_cleaning'
  if (includesAny(label, ['airbnb', 'tur', 'huesped', 'huésped'])) return 'airbnb_tourist'
  if (includesAny(label, ['hotel', 'multiroom', 'multi-room'])) return 'hotel_or_multiroom'
  if (includesAny(label, ['gym', 'gimnasio'])) return 'gym_fixed_model'
  return 'basic_cleaning'
}

function resolvePropertyType(input: QuoteRequestNormalizedInput): PropertyTypeCode {
  const label = `${input.propertyType ?? ''} ${input.serviceNeedLabel ?? ''}`
  if (includesAny(label, ['casa', 'villa'])) return 'house_or_villa'
  if (includesAny(label, ['oficina'])) return 'office'
  if (includesAny(label, ['local'])) return 'local'
  if (includesAny(label, ['tur', 'airbnb'])) return 'tourist_apartment'
  return 'apartment'
}

function getServiceTypeLabel(serviceType: ServiceTypeCode): string {
  const labels: Record<ServiceTypeCode, string> = {
    basic_cleaning: 'Limpieza basica',
    deep_cleaning: 'Limpieza profunda',
    airbnb_tourist: 'Airbnb / apartamento turistico',
    post_construction: 'Limpieza fin de obra',
    hotel_or_multiroom: 'Hotel / multiroom',
    gym_fixed_model: 'Gimnasio con modelo fijo',
  }

  return labels[serviceType]
}

function getPropertyTypeLabel(propertyType: PropertyTypeCode): string {
  const labels: Record<PropertyTypeCode, string> = {
    apartment: 'Piso',
    house_or_villa: 'Casa o villa',
    office: 'Oficina',
    local: 'Local',
    tourist_apartment: 'Apartamento turistico',
  }

  return labels[propertyType]
}

function resolveStaffingRule(input: QuoteRequestNormalizedInput): StaffingRule {
  const serviceType = resolveServiceType(input)
  const propertyType = resolvePropertyType(input)
  const squareMeters = estimateSquareMeters(input.sqmBand)

  if (serviceType === 'deep_cleaning') return costaCleanLeadQuoteMessagingEngine.staffingRules.deepCleaning
  if (serviceType === 'post_construction') return costaCleanLeadQuoteMessagingEngine.staffingRules.postConstruction
  if (propertyType === 'house_or_villa') return costaCleanLeadQuoteMessagingEngine.staffingRules.houseOrVilla

  if (propertyType === 'apartment' && squareMeters !== null) {
    return costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning.find(
      (rule) => squareMeters >= rule.minM2 && squareMeters <= rule.maxM2,
    ) ?? costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning.at(-1)!
  }

  return costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning[0]
}

export function getB2BHourlyRate(siteCount: number): number | null {
  const tier = costaCleanLeadQuoteMessagingEngine.discountRules.volumeHourlyRates.find((item) => (
    siteCount >= item.sitesMin && siteCount <= (item.sitesMax ?? Number.POSITIVE_INFINITY)
  ))
  return tier?.hourlyRate ?? null
}

function buildLinenAdjustment(rooms: number): PublicQuotePricingAdjustment | null {
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

export function getLeadQuoteEngine(): CostaCleanLeadQuoteMessagingEngine {
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

export function getMandatoryIntakeMessages(): IntakeMandatoryMessages {
  return costaCleanLeadQuoteMessagingEngine.mandatoryConditions.intake
}

export function parseCount(value: string | null | undefined): number {
  const parsed = Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export function roundMoney(value: number): number {
  const factor = 10 ** costaCleanLeadQuoteMessagingEngine.calculationEngine.rounding.moneyDecimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function getDefaultTaxRate(): number {
  return costaCleanLeadQuoteMessagingEngine.taxRules.vatRate
}

export function getSqmBaseAmount(sqmBand: string | null | undefined): number {
  const squareMeters = estimateSquareMeters(sqmBand ?? null)
  const fallbackRule = costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning[0]
  const staffingRule = squareMeters === null
    ? fallbackRule
    : costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning.find(
      (rule) => squareMeters >= rule.minM2 && squareMeters <= rule.maxM2,
    ) ?? costaCleanLeadQuoteMessagingEngine.staffingRules.basicApartmentCleaning.at(-1)!

  return staffingRule.minimumTotalHours * costaCleanLeadQuoteMessagingEngine.pricing.baseHourlyRateStandard
}

export function getServiceMultiplier(): number {
  return 1
}

export function buildSupplementAdjustments(input: QuoteRequestNormalizedInput): PublicQuotePricingAdjustment[] {
  const rooms = parseCount(input.rooms)
  const adjustments: PublicQuotePricingAdjustment[] = []

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

export function calculatePricing(input: QuoteRequestNormalizedInput): PublicQuotePricingBreakdown {
  const serviceType = resolveServiceType(input)
  const propertyType = resolvePropertyType(input)
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
  const supplementsTotal = roundMoney(adjustments.reduce((sum, item) => sum + item.amount, 0))
  const discountTotal = 0
  const subtotal = roundMoney(serviceAdjustedAmount + supplementsTotal - discountTotal)
  const taxRate = getDefaultTaxRate()
  const mixedModel = costaCleanLeadQuoteMessagingEngine.priceStructure.mixedModel
  const priceStructure = mixedModel.enabled ? 'mixed' : 'standard'
  const invoicedBase = priceStructure === 'mixed'
    ? roundMoney(subtotal * mixedModel.defaultSplit.invoicedRatio)
    : subtotal
  const nonInvoicedAmount = roundMoney(subtotal - invoicedBase)
  const taxAmount = roundMoney(invoicedBase * taxRate)
  const total = roundMoney(invoicedBase + taxAmount + nonInvoicedAmount)
  const limitations = [
    input.hasOutdoorAreas === true
      ? 'El formulario no captura tamano de terraza; se aplica suplemento alto hasta revision manual.'
      : null,
    includesAny(input.scopeNotes, ['jardin', 'jardÃ­n', 'garden'])
      ? 'El jardin se estima con el minimo de horas extra del motor hasta medir alcance real.'
      : null,
    includesAny(input.scopeNotes, ['ventana', 'cristal', 'window'])
      ? 'El formulario no captura tamano/cantidad de ventanas; limpieza de cristales queda para ajuste manual.'
      : null,
    'El formulario no captura numero de sedes ni acuerdo B2B de volumen; no se aplica tarifa de volumen.',
    'El formulario no captura preferencia fiscal del cliente; se aplica el modelo mixto por defecto del motor y revision manual obligatoria.',
  ].filter((item): item is string => Boolean(item))

  return {
    version: costaCleanLeadQuoteMessagingEngine.pricingVersion,
    currency: costaCleanLeadQuoteMessagingEngine.currency,
    engineId: costaCleanLeadQuoteMessagingEngine.engineId,
    engineVersion: costaCleanLeadQuoteMessagingEngine.version,
    serviceType,
    propertyType,
    operators: staffingRule.operators,
    hoursPerOperator: staffingRule.hoursPerOperator,
    totalHours,
    minimumTotalHours: staffingRule.minimumTotalHours,
    hourlyRate,
    baseAmount,
    serviceMultiplier,
    serviceAdjustedAmount,
    adjustments,
    supplementsTotal,
    discountTotal,
    invoicedBase,
    invoicedVat: taxAmount,
    invoicedTotalWithVat: roundMoney(invoicedBase + taxAmount),
    nonInvoicedAmount,
    grandTotalCustomerView: total,
    priceStructure,
    mandatoryMessages: [...costaCleanLeadQuoteMessagingEngine.mandatoryMessages],
    limitations,
    forbiddenServiceRequested: isForbiddenServiceRequested(input),
    subtotal,
    taxRate,
    taxAmount,
    total,
    confidence: 'estimate',
  }
}

export function mapServiceType(label: string | null | undefined): string {
  if (includesAny(label, ['obra', 'post construction', 'fin de obra'])) return 'post_construction'
  if (includesAny(label, ['profunda'])) return 'deep_cleaning'
  if (includesAny(label, ['airbnb', 'tur'])) return 'airbnb_tourist'
  return 'basic_cleaning'
}

export function mapPropertyType(label: string | null | undefined): string {
  if (includesAny(label, ['casa', 'villa'])) return 'house_or_villa'
  if (includesAny(label, ['oficina'])) return 'office'
  if (includesAny(label, ['local'])) return 'local'
  if (includesAny(label, ['tur', 'airbnb'])) return 'tourist_apartment'
  return 'apartment'
}

export function buildNotes(input: QuoteRequestNormalizedInput, pricing: PublicQuotePricingBreakdown): string {
  return [
    input.scopeNotes,
    pricing.serviceType ? `Tipo de servicio motor: ${getServiceTypeLabel(pricing.serviceType as ServiceTypeCode)}` : null,
    pricing.propertyType ? `Tipo de propiedad motor: ${getPropertyTypeLabel(pricing.propertyType as PropertyTypeCode)}` : null,
    pricing.totalHours ? `Equipo motor: ${pricing.operators ?? '-'} operador(es) x ${pricing.hoursPerOperator ?? '-'}h = ${pricing.totalHours}h.` : null,
    input.rooms ? `Habitaciones: ${input.rooms}` : null,
    input.bathrooms ? `Banos: ${input.bathrooms}` : null,
    input.hasOutdoorAreas === null ? null : `Zonas exteriores: ${input.hasOutdoorAreas ? 'si' : 'no'}`,
    input.hasPets === null ? null : `Mascotas: ${input.hasPets ? 'si' : 'no'}`,
    input.requestedServiceDate ? `Fecha solicitada: ${input.requestedServiceDate}` : null,
    input.preferredTimeSlot ? `Horario preferido: ${input.preferredTimeSlot}` : null,
    input.urgencyLabel ? `Urgencia: ${input.urgencyLabel}` : null,
    input.previousCleaningIssues ? `Historial: ${input.previousCleaningIssues}` : null,
    `Estimacion ${pricing.version}: ${pricing.subtotal.toFixed(2)} EUR base + IVA ${pricing.taxAmount.toFixed(2)} EUR (${pricing.total.toFixed(2)} EUR total cliente).`,
    pricing.priceStructure === 'mixed'
      ? `Modelo mixto motor: base facturada ${pricing.invoicedBase?.toFixed(2)} EUR, no facturada ${pricing.nonInvoicedAmount?.toFixed(2)} EUR; IVA solo sobre parte facturada.`
      : null,
    ...(pricing.mandatoryMessages ?? costaCleanLeadQuoteMessagingEngine.mandatoryMessages),
    ...(pricing.limitations ?? []),
  ].filter(Boolean).join('\n')
}

export function buildQuoteDraftSeed(
  input: QuoteRequestNormalizedInput,
  pricing: PublicQuotePricingBreakdown,
): QuoteDraftSeedFromEngine {
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

export function resolveMessageBias(input: QuoteRequestNormalizedInput): MessageBiasRule {
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

export function isForbiddenServiceRequested(input: QuoteRequestNormalizedInput): boolean {
  const context = `${input.serviceNeedLabel ?? ''} ${input.scopeNotes ?? ''}`
  return costaCleanLeadQuoteMessagingEngine.forbiddenServices.some((service) => includesAny(context, [service]))
}

export function buildCommunicationDraftPlaceholders(
  input: QuoteRequestNormalizedInput,
  pricing: PublicQuotePricingBreakdown,
): CommunicationDraftResult {
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
